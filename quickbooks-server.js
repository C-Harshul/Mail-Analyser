// quickbooks-server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const qs = require('querystring');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());

// Environment variables
const CLIENT_ID = process.env.QB_CLIENT_ID;
const CLIENT_SECRET = process.env.QB_CLIENT_SECRET;
const REDIRECT_URI = process.env.QB_REDIRECT_URI || 'http://localhost:4000/callback';
const COMPANY_ID = process.env.QB_COMPANY_ID || '9341454938935261'; // Replace with your company ID

let access_token = null;
let refresh_token = null;

// Step 1: Redirect user to QuickBooks for authorization
app.get('/auth/quickbooks', (req, res) => {
  const url = `https://appcenter.intuit.com/connect/oauth2?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=com.intuit.quickbooks.accounting&state=12345`;
  res.redirect(url);
});

// Step 2: OAuth callback (redirect URI)
app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    return res.status(400).send(`OAuth Error: ${error}`);
  }
  if (!code) {
    return res.status(400).send('No code received');
  }
  try {
    // Exchange code for tokens
    const tokenRes = await axios.post('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      qs.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
        }
      }
    );
    access_token = tokenRes.data.access_token;
    refresh_token = tokenRes.data.refresh_token;
    res.send('QuickBooks OAuth successful! You can now access /api/{entities}');
  } catch (err) {
    res.status(500).send('Token exchange failed: ' + err.message);
  }
});


// Step 3: API route to get a sample record for any entity
app.get('/api/sample/:entity', async (req, res) => {
  if (!access_token) {
    return res.status(401).send('Not authenticated. Please visit /auth/quickbooks first.');
  }
  const entity = req.params.entity;
  if (!entity || !entity.trim()) {
    return res.status(400).send('No entity provided.');
  }
  try {
    const query = `SELECT * FROM ${entity} MAXRESULTS 15`;
    const qbRes = await axios.get(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${COMPANY_ID}/query`,
      {
        params: { query },
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${access_token}`
        }
      }
    );
    res.json(qbRes.data);
  } catch (err) {
    res.status(500).send('QuickBooks API error: ' + (err.response?.data || err.message));
  }
});

// Endpoint to extract structured QuickBooks purchase data from the latest email
app.get('/api/extract-purchase-from-email', async (req, res) => {
  try {
    console.log('Step 1: Fetching QuickBooks Purchase data...');
    const qbRes = await axios.get('http://localhost:4000/api/sample/Purchase');
    const quickbooks_data = qbRes.data;
    console.log('Step 1: QuickBooks data fetched:', JSON.stringify(quickbooks_data, null, 2));

    // 2. Fetch latest Gmail email body (replace with real endpoint if available)
    let gmailData;
    try {
      console.log('Step 2: Fetching latest Gmail email...');
      const gmailRes = await axios.get('http://localhost:4000/api/gmail/latest');
      gmailData = gmailRes.data.body;
      console.log('Step 2: Gmail data fetched:', gmailData);
    } catch (e) {
      console.log('Step 2: Failed to fetch Gmail data, using sample. Error:', e.message);
      gmailData = 'Sample email content: Vendor: Acme Corp, Amount: $123.45, Date: 2024-07-01, Paid via Credit Card.';
    }

    // 3. Compose the prompt
    console.log('Step 3: Composing prompt...');
    const prompt = `You are a system that extracts structured QuickBooks purchase data from emails using existing QuickBooks entries as reference.\n\nBelow is:\n\n1. A list of real QuickBooks Purchase objects (quickbooks_data). This data defines the structure, field names, nesting, and values used in the system (like VendorRef, AccountRef, Line, etc.). Use this to learn the expected schema.\n\n2. An email (email_content) containing the details for a new purchase (e.g., vendor, amount, items, payment info).\n\nYour task:\n- Read the email.\n- Use the structure and fields from the quickbooks_data to create a new Purchase entry.\n- Match vendors, accounts, and fields from the reference data.\n- Do NOT assume a fixed format — infer everything from the QuickBooks data.\n- Output only a single valid JSON object for the new purchase.\n\nquickbooks_data:\n${JSON.stringify(quickbooks_data, null, 2)}\n\nemail_content:\n${gmailData}`;
    console.log('Step 3: Prompt composed.');

    // 4. Send to Gemini
    console.log('Step 4: Sending prompt to Gemini...');
    const geminiRes = await axios.post('http://localhost:4000/api/gemini/generate', { prompt });
    console.log('Step 4: Gemini response:', JSON.stringify(geminiRes.data, null, 2));
    res.json(geminiRes.data);
  } catch (err) {
    console.log('Error in /api/extract-purchase-from-email:', err.message, err.response?.data || '');
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to fetch the latest Gmail email
app.get('/api/gmail/latest', async (req, res) => {
  try {
    // Load Gmail token and credentials
    const fs = require('fs');
    const { google } = require('googleapis');
    const TOKEN_PATH = 'token.json';
    const CREDENTIALS_PATH = 'credentials.json';
    let oAuth2Client;
    let credentials;
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      oAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'http://localhost:3000/auth/callback'
      );
    } else if (fs.existsSync(CREDENTIALS_PATH)) {
      credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
      const { client_id, client_secret } = credentials.web || credentials.installed;
      oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        'http://localhost:3000/auth/callback'
      );
    } else {
      return res.status(401).json({ error: 'No Gmail credentials found.' });
    }
    if (!fs.existsSync(TOKEN_PATH)) {
      return res.status(401).json({ error: 'No Gmail token found. Please authenticate Gmail first.' });
    }
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oAuth2Client.setCredentials(token);
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    // Fetch the latest email
    const listRes = await gmail.users.messages.list({ userId: 'me', maxResults: 1, q: 'in:inbox' });
    const messages = listRes.data.messages || [];
    if (messages.length === 0) {
      return res.status(404).json({ error: 'No emails found in inbox.' });
    }
    const msgRes = await gmail.users.messages.get({ userId: 'me', id: messages[0].id, format: 'full' });
    const msg = msgRes.data;
    // Extract body (prefer text/plain)
    function decodeBase64Url(str) {
      const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - base64.length % 4) % 4);
      return Buffer.from(base64 + padding, 'base64').toString('utf-8');
    }
    function extractPlainTextBody(payload) {
      let body = '';
      const extractFromPart = (part) => {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          body = decodeBase64Url(part.body.data);
        } else if (part.parts) {
          part.parts.forEach(extractFromPart);
        }
      };
      if (payload.parts) {
        payload.parts.forEach(extractFromPart);
      } else if (payload.body && payload.body.data && payload.mimeType === 'text/plain') {
        body = decodeBase64Url(payload.body.data);
      }
      return body;
    }
    let body = extractPlainTextBody(msg.payload);
    // Fallback to HTML if no plain text found
    if (!body) {
      function extractHtmlBody(payload) {
        let html = '';
        const extractFromPart = (part) => {
          if (part.mimeType === 'text/html' && part.body && part.body.data) {
            html = decodeBase64Url(part.body.data);
          } else if (part.parts) {
            part.parts.forEach(extractFromPart);
          }
        };
        if (payload.parts) {
          payload.parts.forEach(extractFromPart);
        } else if (payload.body && payload.body.data && payload.mimeType === 'text/html') {
          html = decodeBase64Url(payload.body.data);
        }
        return html;
      }
      body = extractHtmlBody(msg.payload);
    }
    // Extract metadata
    const headers = msg.payload.headers;
    const from = headers.find(h => h.name === 'From')?.value || '';
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const date = headers.find(h => h.name === 'Date')?.value || '';
    res.json({
      id: msg.id,
      from,
      subject,
      date,
      snippet: msg.snippet || '',
      body
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mount Gemini proxy router
const geminiProxyRouter = require('./gemini-proxy.js');
app.use('/api/gemini', geminiProxyRouter);

// Endpoint to create a new Purchase in QuickBooks using Gemini-generated JSON
app.post('/api/create-purchase', async (req, res) => {
  console.log('\n=== CREATE PURCHASE ENDPOINT STARTED ===');
  console.log('Timestamp:', new Date().toISOString());
  
  if (!access_token) {
    console.log('❌ Authentication failed: No access token available');
    return res.status(401).json({ error: 'Not authenticated. Please visit /auth/quickbooks first.' });
  }
  console.log('✅ Authentication check passed');

  const purchaseData = req.body;
  
  if (!purchaseData) {
    console.log('❌ Validation failed: No purchase data in request body');
    return res.status(400).json({ error: 'No purchase data provided in request body.' });
  }
  console.log('✅ Request validation passed');
  console.log('📦 Purchase data received:', JSON.stringify(purchaseData, null, 2));

  try {
    console.log('\n🚀 Step 1: Preparing QuickBooks API request...');
    console.log('   - Company ID:', COMPANY_ID);
    console.log('   - Endpoint: https://sandbox-quickbooks.api.intuit.com/v3/company/' + COMPANY_ID + '/purchase?minorversion=69');
    console.log('   - Access token available:', !!access_token);
    
    console.log('\n🚀 Step 2: Sending POST request to QuickBooks API...');
    const startTime = Date.now();
    
    const qbRes = await axios.post(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${COMPANY_ID}/purchase?minorversion=69`,
      purchaseData,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}`
        }
      }
    );

    const endTime = Date.now();
    console.log(`✅ QuickBooks API request completed in ${endTime - startTime}ms`);
    console.log('📊 Response status:', qbRes.status);
    console.log('📊 Response headers:', JSON.stringify(qbRes.headers, null, 2));
    console.log('📊 Response data:', JSON.stringify(qbRes.data, null, 2));

    console.log('\n🎉 SUCCESS: Purchase created successfully in QuickBooks!');
    console.log('=== CREATE PURCHASE ENDPOINT COMPLETED ===\n');
    
    res.json({
      success: true,
      message: 'Purchase created successfully in QuickBooks',
      data: qbRes.data,
      requestTime: `${endTime - startTime}ms`
    });

  } catch (err) {
    console.log('\n❌ ERROR: Failed to create Purchase in QuickBooks');
    console.log('Error details:', {
      message: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      headers: err.response?.headers
    });
    console.log('Full error response:', JSON.stringify(err.response?.data, null, 2));
    console.log('=== CREATE PURCHASE ENDPOINT FAILED ===\n');
    
    res.status(500).json({
      error: 'Failed to create Purchase in QuickBooks',
      details: err.response?.data || err.message,
      status: err.response?.status,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint to extract and create purchase in one step
app.get('/api/extract-and-create-purchase', async (req, res) => {
  console.log('\n=== EXTRACT AND CREATE PURCHASE WORKFLOW STARTED ===');
  console.log('Timestamp:', new Date().toISOString());
  
  if (!access_token) {
    console.log('❌ Authentication failed: No access token available');
    return res.status(401).json({ error: 'Not authenticated. Please visit /auth/quickbooks first.' });
  }
  console.log('✅ Authentication check passed');

  try {
    console.log('\n🚀 Step 1: Extracting purchase data from email...');
    const extractStartTime = Date.now();
    
    // First, extract the purchase data from email
    const extractRes = await axios.get('http://localhost:4000/api/extract-purchase-from-email');
    const purchaseData = extractRes.data;
    
    const extractEndTime = Date.now();
    console.log(`✅ Email extraction completed in ${extractEndTime - extractStartTime}ms`);
    console.log('📦 Extracted purchase data:', JSON.stringify(purchaseData, null, 2));
    
    // Then, create the purchase in QuickBooks
    console.log('\n🚀 Step 2: Creating purchase in QuickBooks...');
    console.log('   - Company ID:', COMPANY_ID);
    console.log('   - Endpoint: https://sandbox-quickbooks.api.intuit.com/v3/company/' + COMPANY_ID + '/purchase?minorversion=69');
    
    const createStartTime = Date.now();
    const createRes = await axios.post(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${COMPANY_ID}/purchase?minorversion=69`,
      purchaseData,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}`
        }
      }
    );

    const createEndTime = Date.now();
    console.log(`✅ QuickBooks creation completed in ${createEndTime - createStartTime}ms`);
    console.log('📊 QuickBooks response status:', createRes.status);
    console.log('📊 Created purchase data:', JSON.stringify(createRes.data, null, 2));

    const totalTime = createEndTime - extractStartTime;
    console.log('\n🎉 SUCCESS: Complete workflow completed successfully!');
    console.log('📈 Performance metrics:');
    console.log('   - Email extraction time:', `${extractEndTime - extractStartTime}ms`);
    console.log('   - QuickBooks creation time:', `${createEndTime - createStartTime}ms`);
    console.log('   - Total workflow time:', `${totalTime}ms`);
    console.log('=== EXTRACT AND CREATE PURCHASE WORKFLOW COMPLETED ===\n');
    
    res.json({
      success: true,
      message: 'Purchase extracted from email and created successfully in QuickBooks',
      extractedData: purchaseData,
      createdPurchase: createRes.data,
      performance: {
        extractionTime: `${extractEndTime - extractStartTime}ms`,
        creationTime: `${createEndTime - createStartTime}ms`,
        totalTime: `${totalTime}ms`
      }
    });

  } catch (err) {
    console.log('\n❌ ERROR: Failed in extract-and-create workflow');
    console.log('Error details:', {
      message: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data
    });
    console.log('Full error response:', JSON.stringify(err.response?.data, null, 2));
    console.log('=== EXTRACT AND CREATE PURCHASE WORKFLOW FAILED ===\n');
    
    res.status(500).json({
      error: 'Failed to extract and create purchase',
      details: err.response?.data || err.message,
      status: err.response?.status,
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(PORT, () => {
  console.log(`QuickBooks server running on http://localhost:${PORT}`);
  console.log(`Start OAuth flow at http://localhost:${PORT}/auth/quickbooks`);
}); 