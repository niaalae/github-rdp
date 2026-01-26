const fs = require('fs');
const path = require('path');
const readline = require('readline');
const got = require('got').default;
const { downloadFromDropbox, uploadToDropbox } = require('./dropbox_utils');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const DROPBOX_DIR = process.env.DROPBOX_DIR || '';
const DROPBOX_FILE = DROPBOX_DIR + '/github_tokens.json';
const LOCAL_FILE = path.resolve(__dirname, 'github_tokens.json');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function checkToken(tokenItem) {
    const token = tokenItem.token;
    if (!token) return { tokenItem, status: 'invalid_format' };

    try {
        const response = await got('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'User-Agent': 'Mozilla/5.0'
            },
            responseType: 'json',
            throwHttpErrors: false
        });

        if (response.statusCode === 200) {
            return { tokenItem, status: 'valid', user: response.body.login };
        } else if (response.statusCode === 401) {
            return { tokenItem, status: 'suspended', reason: 'Unauthorized' };
        } else {
            // Capture the error message from the body if possible
            let message = '';
            try {
                message = response.body.message || JSON.stringify(response.body);
            } catch (e) {
                message = 'No body';
            }

            // Check if it's a 403 suspended case
            if (response.statusCode === 403 && message.toLowerCase().includes('suspended')) {
                return { tokenItem, status: 'suspended', reason: 'Account Suspended (403)' };
            }

            return { tokenItem, status: 'unknown', code: response.statusCode, message: message };
        }
    } catch (error) {
        return { tokenItem, status: 'error', error: error.message };
    }
}

(async () => {
    try {
        console.log('Downloading tokens from Dropbox...');
        const fileData = await downloadFromDropbox(DROPBOX_FILE);

        if (!fileData) {
            console.log('github_tokens.json not found on Dropbox.');
            process.exit(0);
        }

        let tokens = [];
        try {
            tokens = JSON.parse(fileData);
        } catch (e) {
            console.error('Error parsing JSON:', e.message);
            process.exit(1);
        }

        if (!Array.isArray(tokens)) {
            console.error('Expected JSON to be an array of tokens.');
            process.exit(1);
        }

        console.log(`Checking ${tokens.length} tokens...`);

        const results = [];
        const BATCH_SIZE = 10;
        for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
            const batch = tokens.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(batch.map(t => checkToken(t)));
            results.push(...batchResults);
            process.stdout.write(`\rChecked ${Math.min(i + BATCH_SIZE, tokens.length)}/${tokens.length}`);
        }
        console.log('\n');

        const validTokens = results.filter(r => r.status === 'valid');
        const suspendedTokens = results.filter(r => r.status === 'suspended');
        const otherTokens = results.filter(r => r.status !== 'valid' && r.status !== 'suspended');

        console.log(`Valid: ${validTokens.length}`);
        console.log(`Suspended/Revoked: ${suspendedTokens.length}`);
        if (otherTokens.length > 0) {
            console.log(`Other/Error: ${otherTokens.length}`);
            console.log('\nDetails for Other/Error tokens:');
            otherTokens.forEach(t => {
                const info = t.status === 'unknown' ? `Status Code: ${t.code} | Msg: ${t.message}` : `Error: ${t.error}`;
                console.log(`- Token: ${t.tokenItem.token.substring(0, 10)}... | ${info}`);
            });
        }

        if (suspendedTokens.length > 0) {
            console.log('\nSuspended Accounts:');
            // suspendedTokens.forEach(t => console.log(t.tokenItem.token));

            const answer = await askQuestion(`Found ${suspendedTokens.length} suspended accounts. Remove them? (*y to confirm): `);

            if (answer.trim() === '*y') {
                // Filter out suspended tokens
                // We keep tokens that are NOT in the suspended list
                // We use the original token objects
                const suspendedTokenStrings = new Set(suspendedTokens.map(r => r.tokenItem.token));
                const newTokensList = tokens.filter(t => !suspendedTokenStrings.has(t.token));

                // Save locally
                fs.writeFileSync(LOCAL_FILE, JSON.stringify(newTokensList, null, 4));
                console.log(`Removed suspended tokens. Updated local ${LOCAL_FILE}`);

                const dropboxAnswer = await askQuestion('Remove from Dropbox too? (*y to confirm): ');
                if (dropboxAnswer.trim() === '*y') {
                    console.log('Uploading to Dropbox...');
                    await uploadToDropbox(DROPBOX_FILE, newTokensList);
                    console.log('Updated github_tokens.json on Dropbox.');
                }
            } else {
                console.log('Skipping removal.');
            }
        } else {
            console.log('No suspended accounts found.');
        }

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        rl.close();
    }
})();
