const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// CONFIGURATION
const tokensPath = path.join(__dirname, 'github_tokens.json');

function readTokens() {
    if (!fs.existsSync(tokensPath)) {
        console.error('❌ github_tokens.json not found');
        return [];
    }
    try {
        const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
        return Array.isArray(tokens) ? tokens : [];
    } catch (e) {
        console.error('❌ Failed to parse github_tokens.json:', e.message);
        return [];
    }
}

async function checkTokenStatus(tokenObj) {
    const { username, token } = tokenObj;
    const env = { ...process.env, GH_TOKEN: token };

    try {
        // Try to get user info - this will fail if account is suspended
        execSync('gh api user', { env, encoding: 'utf8', stdio: 'pipe' });
        return { ...tokenObj, status: 'ACTIVE' };
    } catch (err) {
        if (err.message.includes('403') || err.message.includes('suspended')) {
            return { ...tokenObj, status: 'SUSPENDED' };
        }
        // Other errors (invalid token, network issues, etc.)
        return { ...tokenObj, status: 'ERROR', error: err.message.split('\n')[0] };
    }
}

async function checkAll() {
    console.log('🔍 Checking GitHub token status...\n');

    const tokens = readTokens();
    if (tokens.length === 0) {
        console.log('No tokens to check.');
        return;
    }

    console.log(`Total tokens to check: ${tokens.length}\n`);
    console.log('Checking...');

    const results = [];
    for (const tokenObj of tokens) {
        process.stdout.write('.');
        const result = await checkTokenStatus(tokenObj);
        results.push(result);
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
    }

    console.log('\n');

    // Calculate statistics
    const active = results.filter(r => r.status === 'ACTIVE');
    const suspended = results.filter(r => r.status === 'SUSPENDED');
    const errors = results.filter(r => r.status === 'ERROR');

    // Display results
    console.log('═══════════════════════════════════════');
    console.log('           TOKEN STATUS REPORT          ');
    console.log('═══════════════════════════════════════');
    console.log(`📊 Total Tokens:      ${tokens.length}`);
    console.log(`✅ Active:            ${active.length}`);
    console.log(`❌ Suspended:         ${suspended.length}`);
    console.log(`⚠️  Errors:            ${errors.length}`);
    console.log('═══════════════════════════════════════\n');

    // Show suspended accounts
    if (suspended.length > 0) {
        console.log('🚫 Suspended Accounts:');
        suspended.forEach(r => {
            const date = r.date ? new Date(r.date).toLocaleDateString() : 'Unknown';
            console.log(`   - ${r.username} (Created: ${date})`);
        });
        console.log('');
    }

    // Show error accounts
    if (errors.length > 0) {
        console.log('⚠️  Accounts with Errors:');
        errors.forEach(r => console.log(`   - ${r.username}: ${r.error}`));
        console.log('');
    }

    // Show active accounts (optional, can be commented out if too many)
    if (active.length > 0 && active.length <= 10) {
        console.log('✅ Active Accounts:');
        active.forEach(r => console.log(`   - ${r.username}`));
        console.log('');
    }

    // Summary
    const healthPercent = ((active.length / tokens.length) * 100).toFixed(1);
    console.log(`Health: ${healthPercent}% of tokens are active\n`);
}

if (require.main === module) {
    checkAll().catch(err => {
        console.error('Unexpected error:', err);
        process.exit(1);
    });
}
