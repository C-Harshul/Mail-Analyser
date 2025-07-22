#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function setupHerokuDeployment() {
  log('🚀 Heroku Deployment Setup for Mail-Analyser CLI', colors.cyan);
  log('=' .repeat(50), colors.blue);
  
  // Check if Heroku CLI is installed
  try {
    execSync('heroku --version', { stdio: 'ignore' });
    log('✅ Heroku CLI is installed', colors.green);
  } catch (error) {
    log('❌ Heroku CLI not found. Please install it first:', colors.red);
    log('   Visit: https://devcenter.heroku.com/articles/heroku-cli', colors.yellow);
    process.exit(1);
  }

  // Check if user is logged in to Heroku
  try {
    execSync('heroku auth:whoami', { stdio: 'ignore' });
    log('✅ You are logged in to Heroku', colors.green);
  } catch (error) {
    log('❌ Please log in to Heroku first:', colors.red);
    log('   Run: heroku login', colors.yellow);
    process.exit(1);
  }

  // Get app name
  const appName = await promptUser(`${colors.cyan}Enter your Heroku app name (or press Enter for auto-generated): ${colors.reset}`);
  
  // Create Heroku app
  try {
    let createCommand = 'heroku create';
    if (appName) {
      createCommand += ` ${appName}`;
    }
    
    log('\n🔨 Creating Heroku app...', colors.blue);
    const output = execSync(createCommand, { encoding: 'utf8' });
    log('✅ Heroku app created successfully', colors.green);
    
    // Extract app URL from output
    const urlMatch = output.match(/https:\/\/([^\.]+)\.herokuapp\.com/);
    const herokuUrl = urlMatch ? urlMatch[0] : '';
    const actualAppName = urlMatch ? urlMatch[1] : appName;
    
    if (herokuUrl) {
      log(`📱 App URL: ${herokuUrl}`, colors.cyan);
      
      // Update environment variables with Heroku URL
      log('\n🔧 Setting up environment variables...', colors.blue);
      
      // Read current .env file
      let envVars = {};
      if (fs.existsSync('.env')) {
        const envContent = fs.readFileSync('.env', 'utf8');
        envContent.split('\n').forEach(line => {
          const [key, value] = line.split('=');
          if (key && value) {
            envVars[key.trim()] = value.trim();
          }
        });
      }
      
      // Update redirect URIs for Heroku
      envVars.QB_REDIRECT_URI = `${herokuUrl}/callback`;
      
      // Set environment variables on Heroku
      for (const [key, value] of Object.entries(envVars)) {
        if (value && !value.startsWith('$')) {
          try {
            execSync(`heroku config:set ${key}="${value}" --app ${actualAppName}`, { stdio: 'ignore' });
            log(`✅ Set ${key}`, colors.green);
          } catch (error) {
            log(`⚠️  Failed to set ${key}`, colors.yellow);
          }
        }
      }
      
      log('\n📋 Important Setup Steps:', colors.yellow);
      log('1. Update your QuickBooks app redirect URI to:', colors.reset);
      log(`   ${herokuUrl}/callback`, colors.cyan);
      log('2. Update your Google OAuth redirect URI to:', colors.reset);
      log(`   ${herokuUrl}/auth/callback`, colors.cyan);
      log('3. Deploy your app:', colors.reset);
      log('   git add .', colors.cyan);
      log('   git commit -m "Deploy to Heroku"', colors.cyan);
      log('   git push heroku main', colors.cyan);
      log('\n4. After deployment, visit:', colors.reset);
      log(`   ${herokuUrl}/auth/quickbooks`, colors.cyan);
      
    }
    
  } catch (error) {
    log('❌ Failed to create Heroku app:', colors.red);
    log(error.message, colors.red);
    process.exit(1);
  }
}

if (require.main === module) {
  setupHerokuDeployment();
}

module.exports = { setupHerokuDeployment };