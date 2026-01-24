// Orchestration script for Codespace automation
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
// No axios needed, using gh CLI

// CONFIGURATION
const tokensPath = path.join(__dirname, 'github_tokens.json');
const repo = 'complexorganizations/github-rdp'; // Change if needed
const machineType = 'linuxstandard32'; // Will search for exact name if needed
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
    const createCmd = `gh codespace create --repo ${repo} --machine ${machineType} --idle-timeout ${idleTimeout}m --json name,sshUrl -L info`;
    const result = execSync(createCmd, { env, encoding: 'utf8' });
    const codespace = JSON.parse(result);
    return codespace;
  } catch (err) {
    console.error('gh codespace create failed:', err.message);
    throw err;
  }
}

function setupAndRunScriptsWithGh(codespace, token) {
  // 0. Create .env file with Dropbox credentials and token
  const envContent = `DROPBOX_APP_KEY=iet7enzuwe0vkh2\nDROPBOX_APP_SECRET=sp60mm5zgv9a9x9\nDROPBOX_ACCESS_TOKEN=sl.u.AGQV2Uh0O207DNRNzUQZYDgUkm0jmA-PXZG0nHXZ_lLSKiN4sAVfBaV2f2gZNGBdajJD4bcbrYkNLEJVxYxF_Z1MPxhNNhQXgoPyNzjSQi8qA3b9CsyhIuq8kSowddwqYhbrjxyEZZVjh3S0eAB1tAf-y_f1SC8rxwbg56Ecc5DW_pc93OswR27u8Yniy27tPERBrbvWCxeJ4CSFXQwszeDOU7e9EUou9Wjo5jmH2Cx_UI_DGYuIAjoPFDZkcIdOfJSw0gmlGjydHsjVvyBEm_Iaet0OYWQG-QHjW-6kOOk14vU1RlEOB4oeNHkyaK52-R26UFbqmC41bzN2d_0TlKb-NAstLlNMVQ0JcezJFaEnT--qRSzC29XsZG_ijIrR8ZRKDaDjSc0LNEJfa-UFniGImDZdILVzvI8wnIQOb_VkiRPplJtAUnpLXPX0RBCJpwpmgACKbtxgybkDKf_4FCcAKVn4dR-IBGrkR0Luq9aKinfqNMCo5F_rorZrGwqunNx6s6tYyjPQg564Q9bG6hylspUBBVoYEt0sVZKHJ6-y0pPFrlie7aF9Iv1hsbS5ji6mAssgZP09qNRp7E7pXjco826qP0DGMix6TLFc9qeF2n3hMFt1T69zX1gC6irjRFr_85usCHWvY27nrLpKYdwZfkIb--yngbuPkpoYP295myxErhjz51yvmvpoGMFGYYWkcaMcS4nng0gn_412SbF2TtBgLfQ5uP1J6e_w3gC_SPxrrZWI9eK8tcSnvCzC5U_yoN19eon5BvdmuV3I9mywkeMR9kLE9tIJT-DGoAte4438S3lW2iHAFdv0oCHKaElteTyuQ-JY87UHT4JylkHSyOUQ3gh63hJv164WCjvXgq84k9Lh9zEQNbRSCRru2ZTSWCuiLGrQJxH-n7cFYxhSvDvUaFeqLvogpkXy5TIFsrGcQFvIKl0mhtMIZf6FY7H9pTgVro51pUxpncL2-cY9UsWxqXxWlZuF-oWjIosvPbUhaqVbMdJS_XkN5CUUMvRrFmHoN27CvlHKyywB4H04U-u_r5zimkujMWbJAUDRIJ2tsiMpH79o9h-aQ34VzTmLEN-U705Foiup6SfwDSJzTmsWIPsmqhDSvazJK9XtGtRa4C94jIgaoqAljH5x2IOAX1y-b4e19FV080JkzppBYvDt5CR26O2x28VYkyCrQ9u79zD5uIlY19wb74afx_KXAWUBl473P80QxS8wsQlcGsexW-yiJqJlZZ-0Ue7G3juRB1TlP2hqlQLiKssqy4I1TuzkzVTu-wmLtlVFckaNNPM7RFyvCdHSFU2GgI_sc4rd_9_f0xW-ykLBnHPkcbkNjrHpq8QKRwYZAkQqkCCGvxF3M5OOcX1w4umymn9erbUvU6aDuZzHXgP0xNaYHucv8qslU99Bfp6vziMo-_AYolq4ryiD5rYIbOKEBeqsMw\nGITHUB_TOKEN=${token}`;
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