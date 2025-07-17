// quickbooks-server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const qs = require('querystring');

const app = express();
const PORT = process.env.PORT || 4000;

// Environment variables
const CLIENT_ID = process.env.QB_CLIENT_ID;
const CLIENT_SECRET = process.env.QB_CLIENT_SECRET;
const REDIRECT_URI = process.env.QB_REDIRECT_URI || 'http://localhost:4000/purchase';
const COMPANY_ID = process.env.QB_COMPANY_ID || '9341454938935261'; // Replace with your company ID

let access_token = null;
let refresh_token = null;

// Step 1: Redirect user to QuickBooks for authorization
app.get('/auth/quickbooks', (req, res) => {
  const url = `https://appcenter.intuit.com/connect/oauth2?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=com.intuit.quickbooks.accounting&state=12345`;
  res.redirect(url);
});

// Step 2: OAuth callback (redirect URI)
app.get('/purchase', async (req, res) => {
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
    res.send('QuickBooks OAuth successful! You can now access /api/purchases');
  } catch (err) {
    res.status(500).send('Token exchange failed: ' + err.message);
  }
});

// Step 3: API route to get Purchase entities
app.get('/api/purchases', async (req, res) => {
  if (!access_token) {
    return res.status(401).send('Not authenticated. Please visit /auth/quickbooks first.');
  }
  try {
    const qbRes = await axios.get(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${COMPANY_ID}/query`,
      {
        params: { query: 'SELECT * FROM Purchase' },
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

app.listen(PORT, () => {
  console.log(`QuickBooks server running on http://localhost:${PORT}`);
  console.log(`Start OAuth flow at http://localhost:${PORT}/auth/quickbooks`);
}); 