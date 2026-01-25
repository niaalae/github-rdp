// Orchestration script for Codespace automation
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
// No axios needed, using gh CLI

// CONFIGURATION
const tokensPath = path.join(__dirname, 'github_tokens.json');
const repo = 'complexorganizations/github-rdp'; // Change if needed
const machineType = 'standardLinux32gb'; // Updated to valid machine type
const idleTimeout = 240; // minutes
const displayNum = 20;
const scriptsToRun = [
  'signup_single_direct.js',
  'spam_tor.js',
  'spam.js'
];

function readTokens() {
  if (!fs.existsSync(tokensPath)) throw new Error('github_tokens.json not found');
  const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  if (!Array.isArray(tokens) || tokens.length === 0) throw new Error('No tokens found');
  return tokens;
}

function createCodespaceWithGh(token) {
  // Use gh CLI to create codespace
  const env = { ...process.env, GH_TOKEN: token };
  try {
    // Removed --json as it's not supported in newer gh versions for create
    const createCmd = `gh codespace create --repo ${repo} --machine ${machineType} --idle-timeout ${idleTimeout}m`;
    const result = execSync(createCmd, { env, encoding: 'utf8' }).trim();
    // In newer gh versions, stdout is just the codespace name
    const lines = result.split('\n');
    const name = lines[lines.length - 1].trim();
    console.log(`Created codespace: ${name}`);
    return { name };
  } catch (err) {
    console.error('gh codespace create failed:', err.message);
    throw err;
  }
}

function setupAndRunScriptsWithGh(codespace, token) {
  // 0. Create .env file with host Dropbox credentials and current token
  const dbxAppKey = process.env.DROPBOX_APP_KEY || '';
  const dbxAppSecret = process.env.DROPBOX_APP_SECRET || '';
  const dbxToken = process.env.DROPBOX_ACCESS_TOKEN || process.env.DROPBOX_TOKEN || '';
  const dbxRefresh = process.env.DROPBOX_REFRESH_TOKEN || '';
  const dbxDir = process.env.DROPBOX_DIR || '';

  const envContent = [
    `DROPBOX_APP_KEY=${dbxAppKey}`,
    `DROPBOX_APP_SECRET=${dbxAppSecret}`,
    `DROPBOX_ACCESS_TOKEN=${dbxToken}`,
    `DROPBOX_TOKEN=${dbxToken}`,
    `DROPBOX_REFRESH_TOKEN=${dbxRefresh}`,
    `DROPBOX_DIR=${dbxDir}`,
    `GITHUB_TOKEN=${token}`
  ].join('\n');
  const envPath = path.join(__dirname, `.env.codespace_${codespace.name}`);
  fs.writeFileSync(envPath, envContent);

  // 1. Copy .env to Codespace
  try {
    execSync(`gh codespace cp ${envPath} ${codespace.name}:.env`, { stdio: 'inherit' });
  } catch (err) {
    console.error('gh codespace cp failed:', err.message);
    return;
  }

  // 2. Run setup commands in Codespace
  const setupCmds = [
    'chmod +x main.sh || true',
    'sudo bash main.sh',
    'export DISPLAY=:20',
    'tor &',
    'cd orch && npm install',
    'DISPLAY=:20 node orch/signup_single_direct.js',
    'DISPLAY=:20 node orch/spam_tor.js',
    'DISPLAY=:20 node orch/spam.js'
  ];
  const remoteCmd = setupCmds.join(' && ');
  try {
    execSync(`gh codespace ssh -c "${remoteCmd}" -e ${codespace.name}`, { stdio: 'inherit' });
  } catch (err) {
    console.error('gh codespace ssh failed:', err.message);
    return;
  }

  console.log('Setup and script execution complete for codespace:', codespace.name);
}

async function orchestrate() {
  const tokenObjs = readTokens();
  for (const obj of tokenObjs) {
    const token = obj.token;
    try {
      const codespace = createCodespaceWithGh(token);
      setupAndRunScriptsWithGh(codespace, token);
    } catch (err) {
      console.error(`Error for token: ${token}`, err);
    }
  }
}

if (require.main === module) {
  orchestrate();
}