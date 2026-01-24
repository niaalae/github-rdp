// check-github-tokens.js
// Checks the number of tokens in github_tokens.json on Dropbox and prints the count

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const DROPBOX_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;
const DROPBOX_DIR = process.env.DROPBOX_DIR || '';
const DROPBOX_FILE = DROPBOX_DIR + '/github_tokens.json';

function fetchDropboxFile(dropboxPath) {
    return new Promise((resolve, reject) => {
        if (!DROPBOX_TOKEN) return reject(new Error('DROPBOX_TOKEN not set'));
        const options = {
            hostname: 'content.dropboxapi.com',
            path: '/2/files/download',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DROPBOX_TOKEN}`,
                'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath })
            }
        };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
                else reject(new Error(`Dropbox download failed ${res.statusCode}: ${data}`));
            });
        });
        req.on('error', reject);
        req.end();
    });
}

(async () => {
    try {
        const fileData = await fetchDropboxFile(DROPBOX_FILE);
        // Count occurrences of 'token' in the file (like grep -c 'token')
        const tokenCount = (fileData.match(/"token"/g) || []).length;
        console.log(`Token count in github_tokens.json: ${tokenCount}`);
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
