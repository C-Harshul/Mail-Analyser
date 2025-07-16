const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const path = require('path');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});
// Root route for server health check
app.get('/', (req, res) => {
  console.log('📊 Health check requested');
  res.json({ 
    message: 'Gmail Viewer API Server is running',
    status: 'healthy',
    endpoints: [
      '/auth/url',
      '/auth/status', 
      '/emails',
      '/emails/mock'
    ]
  });
});

// OAuth2 configuration
console.log('🔧 Initializing OAuth2 client...');

// Log environment variables (safely)
console.log('🔑 Environment check:');
console.log('   GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` : 'NOT SET');
console.log('   GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET (hidden)' : 'NOT SET');
console.log('   Redirect URI: http://localhost:3001/auth/callback');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || '942878270431-9t2cm2qrmfvvcrvstm4g83v590cnq00u.apps.googleusercontent.com',
  process.env.GOOGLE_CLIENT_SECRET || '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',
  'http://localhost:3001/auth/callback'
);

console.log('🔑 OAuth2 Client configured with:', process.env.GOOGLE_CLIENT_ID ? 'Custom credentials' : 'Default credentials');
// Scopes for Gmail read-only access
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// Store tokens in memory (for demo purposes)
let tokens = null;

// Gmail API instance
let gmail = null;

// Generate auth URL
app.get('/auth/url', (req, res) => {
  console.log('🔗 Generating auth URL...');
  console.log('🔧 Using OAuth2 client with redirect URI: http://localhost:3001/auth/callback');
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  console.log('✅ Auth URL generated:', authUrl.substring(0, 100) + '...');
  res.json({ authUrl });
});

// Handle OAuth callback
app.get('/auth/callback', async (req, res) => {
  const { code, error, error_description } = req.query;
  console.log('🔄 Processing OAuth callback...');
  console.log('📥 Callback received with:', { 
    hasCode: !!code, 
    error: error || 'none',
    errorDescription: error_description || 'none'
  });
  
  if (error) {
    console.error('❌ OAuth error from Google:', error, error_description);
    return res.redirect('http://localhost:5173?auth=error&reason=' + encodeURIComponent(error));
  }

  if (!code) {
    console.error('❌ No authorization code received');
    return res.redirect('http://localhost:5173?auth=error&reason=no_code');
  }

  try {
    console.log('🔑 Exchanging code for tokens...');
    const { tokens: newTokens } = await oauth2Client.getAccessToken(code);
    tokens = newTokens;
    oauth2Client.setCredentials(tokens);
    gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    console.log('✅ Authentication successful! Tokens received.');
    res.redirect('http://localhost:5173?auth=success');
  } catch (error) {
    console.error('❌ Token exchange failed:', error.message);
    console.error('❌ Full error:', error);
    res.redirect('http://localhost:5173?auth=error&reason=token_exchange');
  }
});

// Check auth status
app.get('/auth/status', (req, res) => {
  const isAuthenticated = !!tokens;
  console.log('🔍 Auth status check:', isAuthenticated ? 'Authenticated' : 'Not authenticated');
  res.json({ authenticated: isAuthenticated });
});

// Helper function to decode base64url
function decodeBase64Url(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  return Buffer.from(base64 + padding, 'base64').toString('utf-8');
}

// Helper function to extract email body
function extractEmailBody(payload) {
  let body = '';
  let isHtml = false;

  function extractFromPart(part) {
    if (part.mimeType === 'text/html' && part.body && part.body.data) {
      body = decodeBase64Url(part.body.data);
      isHtml = true;
    } else if (part.mimeType === 'text/plain' && part.body && part.body.data && !body) {
      body = decodeBase64Url(part.body.data);
    } else if (part.parts) {
      part.parts.forEach(extractFromPart);
    }
  }

  if (payload.parts) {
    payload.parts.forEach(extractFromPart);
  } else if (payload.body && payload.body.data) {
    body = decodeBase64Url(payload.body.data);
    isHtml = payload.mimeType === 'text/html';
  }

  return { body, isHtml };
}

// Get emails endpoint
app.get('/emails', async (req, res) => {
  console.log('📧 Real emails requested...');
  if (!tokens || !gmail) {
    console.log('❌ Not authenticated - cannot fetch real emails');
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    console.log('📥 Fetching emails from Gmail API...');
    // Get list of messages
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50,
      q: 'in:inbox'
    });

    const messages = listResponse.data.messages || [];
    console.log(`📬 Found ${messages.length} messages in inbox`);
    
    // Get detailed information for each message
    console.log('📄 Fetching detailed message data...');
    const emailPromises = messages.map(async (message) => {
      const messageResponse = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full'
      });

      const msg = messageResponse.data;
      const headers = msg.payload.headers;
      
      // Extract headers
      const from = headers.find(h => h.name === 'From')?.value || '';
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      
      // Extract body
      const { body, isHtml } = extractEmailBody(msg.payload);
      
      return {
        id: msg.id,
        from,
        subject,
        date: new Date(date).toISOString(),
        snippet: msg.snippet || '',
        body,
        isHtml
      };
    });

    const emails = await Promise.all(emailPromises);
    console.log(`✅ Successfully processed ${emails.length} emails`);
    
    res.json(emails);
  } catch (error) {
    console.error('❌ Error fetching emails:', error.message);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// For demo purposes, if no auth is set up, return mock data
app.get('/emails/mock', (req, res) => {
  console.log('🎭 Mock emails requested - returning sample data');
  const mockEmails = [
    {
      id: '1',
      from: 'vendor@acmesupplies.com',
      subject: 'Invoice #INV-2024-001 - Office Supplies Order',
      date: new Date(Date.now() - 86400000).toISOString(),
      snippet: 'Please find attached invoice for your recent office supplies order. Total amount: $1,247.50',
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>Invoice #INV-2024-001</h2>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Vendor:</strong> ACME Supplies Ltd.</p>
          <p><strong>Customer:</strong> Your Company</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background-color: #f4f4f4;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Item</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Qty</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Price</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total</th>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Office Paper (A4, 500 sheets)</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">50</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$8.50</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$425.00</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Printer Cartridges (HP 305XL)</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">15</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$54.83</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$822.50</td>
            </tr>
            <tr style="background-color: #f9f9f9; font-weight: bold;">
              <td colspan="3" style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total:</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$1,247.50</td>
            </tr>
          </table>
          
          <p><strong>Payment Terms:</strong> Net 30 days</p>
          <p><strong>Due Date:</strong> ${new Date(Date.now() + 30 * 86400000).toLocaleDateString()}</p>
        </div>
      `,
      isHtml: true
    },
    {
      id: '2',
      from: 'billing@cloudservices.com',
      subject: 'Monthly Statement - December 2024',
      date: new Date(Date.now() - 172800000).toISOString(),
      snippet: 'Your monthly cloud services statement is ready. Total charges: $890.25',
      body: `Monthly Cloud Services Statement\n\nAccount: CS-789123\nBilling Period: December 1-31, 2024\n\nServices:\n- Database Hosting: $345.00\n- Storage (2.5TB): $125.25\n- Bandwidth: $420.00\n\nTotal: $890.25\n\nPayment due by January 15, 2025`,
      isHtml: false
    },
    {
      id: '3',
      from: 'orders@techequipment.com',
      subject: 'Order Confirmation #ORD-456789',
      date: new Date(Date.now() - 259200000).toISOString(),
      snippet: 'Thank you for your order. 2x Laptops, 1x Monitor. Total: $3,299.97',
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>Order Confirmation</h2>
          <p><strong>Order #:</strong> ORD-456789</p>
          <p><strong>Date:</strong> ${new Date(Date.now() - 259200000).toLocaleDateString()}</p>
          
          <h3>Items Ordered:</h3>
          <ul>
            <li>Dell Latitude 7420 Laptop (Qty: 2) - $1,299.99 each</li>
            <li>Samsung 27" 4K Monitor (Qty: 1) - $699.99</li>
          </ul>
          
          <p><strong>Subtotal:</strong> $3,299.97</p>
          <p><strong>Tax:</strong> $0.00</p>
          <p><strong>Total:</strong> $3,299.97</p>
          
          <p><strong>Expected Delivery:</strong> 3-5 business days</p>
        </div>
      `,
      isHtml: true
    }
  ];
  
  console.log(`✅ Returning ${mockEmails.length} mock emails`);
  res.json(mockEmails);
});

app.listen(port, () => {
  console.log(`🚀 Gmail Viewer API Server running at http://localhost:${port}`);
  console.log('📋 Available endpoints:');
  console.log('   GET  /              - Health check');
  console.log('   GET  /auth/url      - Get OAuth URL');
  console.log('   GET  /auth/status   - Check auth status');
  console.log('   GET  /auth/callback - OAuth callback');
  console.log('   GET  /emails        - Get real emails (requires auth)');
  console.log('   GET  /emails/mock   - Get mock emails');
  console.log('');
});