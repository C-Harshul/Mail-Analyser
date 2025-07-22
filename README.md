# Mail-Analyser CLI

A comprehensive CLI tool that integrates Gmail and QuickBooks to automatically extract purchase data from emails and create QuickBooks transactions using AI.

## Features

- 📧 Gmail integration with OAuth authentication
- 💼 QuickBooks Online API integration
- 🤖 AI-powered email parsing using Google Gemini
- 🔄 Automated purchase creation workflow
- 🖥️ Interactive CLI interface
- ☁️ Heroku deployment ready

## Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file with:
   ```
   QB_CLIENT_ID=your_quickbooks_client_id
   QB_CLIENT_SECRET=your_quickbooks_client_secret
   QB_COMPANY_ID=your_company_id
   GEMINI_API_KEY=your_gemini_api_key
   VITE_GEMINI_API_KEY=your_gemini_api_key
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

3. **Run the server:**
   ```bash
   npm run server
   ```

4. **Run the CLI:**
   ```bash
   npm start
   ```

## Heroku Deployment

1. **Run the setup script:**
   ```bash
   node heroku-setup.js
   ```

2. **Follow the prompts to:**
   - Create Heroku app
   - Set environment variables
   - Update OAuth redirect URIs

3. **Deploy:**
   ```bash
   git add .
   git commit -m "Deploy to Heroku"
   git push heroku main
   ```

## Usage

### CLI Options:
1. **Gmail** - View and analyze Gmail emails
2. **QuickBooks Entity Sample** - Fetch sample data from QuickBooks
3. **Extract & Create Purchase** - Full AI workflow to create QuickBooks purchases from emails

### API Endpoints:
- `GET /auth/quickbooks` - QuickBooks OAuth flow
- `GET /api/sample/:entity` - Get sample QuickBooks entity
- `GET /api/extract-purchase-from-email` - Extract purchase data from latest email
- `POST /api/create-purchase` - Create purchase in QuickBooks
- `GET /api/extract-and-create-purchase` - Complete workflow

## Authentication Setup

### QuickBooks:
1. Create app at [Intuit Developer](https://developer.intuit.com)
2. Add redirect URI: `https://your-app.herokuapp.com/callback`
3. Get Client ID and Secret

### Gmail:
1. Create project at [Google Cloud Console](https://console.cloud.google.com)
2. Enable Gmail API
3. Create OAuth credentials
4. Add redirect URI: `https://your-app.herokuapp.com/auth/callback`

### Gemini AI:
1. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

## Important Notes for Heroku

- The CLI functionality is limited on Heroku due to the ephemeral file system
- The web server component works fully on Heroku
- Token storage will be temporary - consider using a database for production
- Update all OAuth redirect URIs to use your Heroku app URL

## License

MIT
