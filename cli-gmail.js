#!/usr/bin/env node

const { google } = require('googleapis');
const express = require('express');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Configuration
const CREDENTIALS_PATH = 'credentials.json';
const TOKEN_PATH = 'token.json';
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class GmailCLI {
  constructor() {
    this.oauth2Client = null;
    this.gmail = null;
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  async initialize() {
    this.log('🚀 Gmail CLI Viewer Starting...', colors.cyan);
    
    // Check for credentials
    if (!this.loadCredentials()) {
      this.log('❌ No credentials found. Please set up OAuth credentials first.', colors.red);
      this.showSetupInstructions();
      return false;
    }

    // Try to load existing token
    if (this.loadToken()) {
      this.log('✅ Using existing authentication token', colors.green);
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      return true;
    }

    // Need to authenticate
    this.log('🔐 Authentication required...', colors.yellow);
    return await this.authenticate();
  }

  loadCredentials() {
    try {
      // Try environment variables first
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      if (clientId && clientSecret) {
        this.log('🔑 Using credentials from environment variables', colors.blue);
        this.oauth2Client = new google.auth.OAuth2(
          clientId,
          clientSecret,
          'http://localhost:3000/auth/callback'
        );
        return true;
      }

      // Try credentials file
      if (fs.existsSync(CREDENTIALS_PATH)) {
        const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
        const { client_id, client_secret } = credentials.web || credentials.installed;
        
        this.oauth2Client = new google.auth.OAuth2(
          client_id,
          client_secret,
          'http://localhost:3000/auth/callback'
        );
        this.log('🔑 Using credentials from credentials.json', colors.blue);
        return true;
      }

      return false;
    } catch (error) {
      this.log(`❌ Error loading credentials: ${error.message}`, colors.red);
      return false;
    }
  }

  loadToken() {
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
        this.oauth2Client.setCredentials(token);
        return true;
      }
      return false;
    } catch (error) {
      this.log(`❌ Error loading token: ${error.message}`, colors.red);
      return false;
    }
  }

  saveToken(token) {
    try {
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
      this.log('💾 Token saved successfully', colors.green);
    } catch (error) {
      this.log(`❌ Error saving token: ${error.message}`, colors.red);
    }
  }

  async authenticate() {
    return new Promise((resolve) => {
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
      });

      this.log('\n📋 Please visit this URL to authorize the application:', colors.yellow);
      this.log(authUrl, colors.cyan);
      this.log('\n🔄 Starting temporary server for OAuth callback...', colors.blue);

      // Start temporary server for OAuth callback
      const app = express();
      const server = app.listen(3000, () => {
        this.log('🌐 Callback server running on http://localhost:3000', colors.blue);
      });

      app.get('/auth/callback', async (req, res) => {
        const { code, error } = req.query;

        if (error) {
          res.send(`<h1>Authentication Error</h1><p>${error}</p>`);
          this.log(`❌ Authentication error: ${error}`, colors.red);
          server.close();
          resolve(false);
          return;
        }

        if (!code) {
          res.send('<h1>Error</h1><p>No authorization code received</p>');
          this.log('❌ No authorization code received', colors.red);
          server.close();
          resolve(false);
          return;
        }

        try {
          const { tokens } = await this.oauth2Client.getToken(code);
          this.oauth2Client.setCredentials(tokens);
          this.saveToken(tokens);
          
          this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
          
          res.send('<h1>Success!</h1><p>Authentication successful! You can close this window and return to the terminal.</p>');
          this.log('✅ Authentication successful!', colors.green);
          
          server.close();
          resolve(true);
        } catch (error) {
          res.send(`<h1>Token Error</h1><p>${error.message}</p>`);
          this.log(`❌ Token exchange error: ${error.message}`, colors.red);
          server.close();
          resolve(false);
        }
      });
    });
  }

  showSetupInstructions() {
    this.log('\n📋 Setup Instructions:', colors.yellow);
    this.log('1. Go to https://console.cloud.google.com/', colors.reset);
    this.log('2. Create a new project or select existing one', colors.reset);
    this.log('3. Enable Gmail API', colors.reset);
    this.log('4. Create OAuth 2.0 credentials', colors.reset);
    this.log('5. Add http://localhost:3000/auth/callback as redirect URI', colors.reset);
    this.log('6. Either:', colors.reset);
    this.log('   - Set environment variables: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET', colors.cyan);
    this.log('   - Or download credentials.json to this directory', colors.cyan);
  }

  decodeBase64Url(str) {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    return Buffer.from(base64 + padding, 'base64').toString('utf-8');
  }

  extractEmailBody(payload) {
    let body = '';
    let isHtml = false;

    const extractFromPart = (part) => {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        body = this.decodeBase64Url(part.body.data);
        isHtml = true;
      } else if (part.mimeType === 'text/plain' && part.body && part.body.data && !body) {
        body = this.decodeBase64Url(part.body.data);
      } else if (part.parts) {
        part.parts.forEach(extractFromPart);
      }
    };

    if (payload.parts) {
      payload.parts.forEach(extractFromPart);
    } else if (payload.body && payload.body.data) {
      body = this.decodeBase64Url(payload.body.data);
      isHtml = payload.mimeType === 'text/html';
    }

    return { body: body.substring(0, 200) + (body.length > 200 ? '...' : ''), isHtml };
  }

  formatEmail(email, index) {
    const separator = '─'.repeat(80);
    const date = new Date(email.date).toLocaleString();
    
    this.log(`\n${separator}`, colors.blue);
    this.log(`📧 Email ${index + 1}`, colors.bright);
    this.log(`${separator}`, colors.blue);
    this.log(`From: ${colors.green}${email.from}${colors.reset}`);
    this.log(`Subject: ${colors.yellow}${email.subject}${colors.reset}`);
    this.log(`Date: ${colors.cyan}${date}${colors.reset}`);
    this.log(`\nPreview:`);
    this.log(`${colors.magenta}${email.snippet}${colors.reset}`);
    
    if (email.body) {
      this.log(`\nBody Preview:`);
      this.log(`${email.body}`);
    }
  }

  async fetchEmails(count = 10) {
    try {
      this.log(`📥 Fetching last ${count} emails...`, colors.blue);
      
      const listResponse = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults: count,
        q: 'in:inbox'
      });

      const messages = listResponse.data.messages || [];
      
      if (messages.length === 0) {
        this.log('📭 No emails found in inbox', colors.yellow);
        return;
      }

      this.log(`📬 Found ${messages.length} emails. Processing...`, colors.green);

      const emails = [];
      for (let i = 0; i < messages.length; i++) {
        const messageResponse = await this.gmail.users.messages.get({
          userId: 'me',
          id: messages[i].id,
          format: 'full'
        });

        const msg = messageResponse.data;
        const headers = msg.payload.headers;
        
        const from = headers.find(h => h.name === 'From')?.value || '';
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        
        const { body } = this.extractEmailBody(msg.payload);
        
        emails.push({
          id: msg.id,
          from: from.replace(/<.*?>/g, '').trim(),
          subject,
          date: new Date(date).toISOString(),
          snippet: msg.snippet || '',
          body
        });

        // Show progress
        process.stdout.write(`\r⏳ Processing email ${i + 1}/${messages.length}`);
      }

      console.log(); // New line after progress
      this.log(`✅ Successfully processed ${emails.length} emails\n`, colors.green);

      // Display emails
      emails.forEach((email, index) => {
        this.formatEmail(email, index);
      });

    } catch (error) {
      this.log(`❌ Error fetching emails: ${error.message}`, colors.red);
    }
  }

  async promptForCount() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(`${colors.cyan}How many emails would you like to fetch? (default: 10): ${colors.reset}`, (answer) => {
        rl.close();
        const count = parseInt(answer) || 10;
        resolve(Math.min(Math.max(count, 1), 50)); // Limit between 1-50
      });
    });
  }

  async run() {
    if (!(await this.initialize())) {
      process.exit(1);
    }

    const count = await this.promptForCount();
    await this.fetchEmails(count);
    
    this.log('\n✨ Done! Run the script again to fetch more emails.', colors.green);
  }
}

// Run the CLI
if (require.main === module) {
  const axios = require('axios');

  async function mainMenu() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    console.log('\n=== Mail-Analyser CLI ===');
    console.log('1) Gmail');
    console.log('2) QuickBooks Purchases');
    console.log('q) Quit');
    rl.question('Choose an option (1, 2, or q): ', async (answer) => {
      rl.close();
      if (answer.trim().toLowerCase() === 'q') {
        process.exit(0);
      } else if (answer.trim() === '2') {
        // QuickBooks Purchases
        try {
          const res = await axios.get('http://localhost:4000/api/purchases');
          console.log('\n=== QuickBooks Purchases ===');
          if (res.data && res.data.QueryResponse && res.data.QueryResponse.Purchase) {
            res.data.QueryResponse.Purchase.forEach((purchase, idx) => {
              console.log(`\nPurchase #${idx + 1}:`);
              console.log(JSON.stringify(purchase, null, 2));
            });
          } else {
            console.log('No purchases found or invalid response.');
          }
        } catch (err) {
          if (err.response && err.response.status === 401) {
            console.log('\nYou need to authenticate with QuickBooks first.');
            console.log('Please open http://localhost:4000/auth/quickbooks in your browser and complete the authentication.');
          } else {
            console.log('Error fetching purchases:', err.message);
          }
        }
        mainMenu();
      } else if (answer.trim() === '1') {
        // Gmail (default)
        const cli = new GmailCLI();
        await cli.run();
        mainMenu();
      } else {
        console.log('Invalid option. Please choose 1, 2, or q.');
        mainMenu();
      }
    });
  }

  mainMenu();
}

module.exports = GmailCLI;