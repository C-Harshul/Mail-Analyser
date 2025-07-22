const { execSync } = require('child_process');
const colors = require('colors/safe');
const readline = require('readline');

const log = (message, color = colors.white) => {
  console.log(color(message));
};

// Ask for the Heroku app name interactively
const askQuestion = (query) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

(async () => {
  const appName = await askQuestion(colors.yellow('Enter your Heroku app name: '));
  const actualAppName = appName;

  if (!actualAppName) {
    log('❌ Heroku app name is required. Aborting.', colors.red);
    process.exit(1);
  }

  // Optional: push code to Heroku
  try {
    log('\n🚀 Pushing code to Heroku...', colors.cyan);
    execSync('git add . && git commit -m "Deploying latest changes" || true', { stdio: 'inherit' });
    execSync(`git push https://git.heroku.com/${actualAppName}.git HEAD:main`, { stdio: 'inherit' });
    log('✅ Code pushed to Heroku', colors.green);
  } catch (err) {
    log('⚠️  Failed to push to Heroku. Check git remote or branch name.', colors.red);
    console.error(err.message);
  }
})();
