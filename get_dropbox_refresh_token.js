const fs = require('fs');
const path = require('path');
const readline = require('readline');
const got = require('got');

// Load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}

const APP_KEY = process.env.DROPBOX_APP_KEY;
const APP_SECRET = process.env.DROPBOX_APP_SECRET;

if (!APP_KEY || !APP_SECRET) {
    console.error('Error: DROPBOX_APP_KEY and DROPBOX_APP_SECRET must be set in .env');
    process.exit(1);
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('\n=== Dropbox Refresh Token Generator ===\n');
console.log('1. Go to the following URL to authorize the app:');
console.log(`https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=code&token_access_type=offline`);
console.log('\n2. Click "Allow" (you might need to log in).');
console.log('3. Copy the authorization code provided.');

rl.question('\nPaste the authorization code here: ', async (code) => {
    code = code.trim();
    if (!code) {
        console.error('No code provided.');
        process.exit(1);
    }

    console.log('\nExchanging code for refresh token...');

        try {
            const response = await got('https://api.dropboxapi.com/oauth2/token', {
                method: 'POST',
                form: {
                    code: code,
                    grant_type: 'authorization_code',
                    client_id: APP_KEY,
                    client_secret: APP_SECRET
                },
                responseType: 'json'
            });

            const refreshToken = response.body.refresh_token;
            if (refreshToken) {
                console.log('\nSUCCESS! Refresh Token obtained.');

            // Append to .env
            fs.appendFileSync(envPath, `\nDROPBOX_REFRESH_TOKEN=${refreshToken}\n`);
            console.log(`Saved DROPBOX_REFRESH_TOKEN to ${envPath}`);
        } else {
            console.error('Error: No refresh token in response. Did you already authorize this app? You might need to deauthorize it first or check scopes.');
            console.log('Response:', response.body);
        }

    } catch (error) {
        console.error('Error exchanging code:', error.response ? error.response.body : error.message);
    }

    rl.close();
});
