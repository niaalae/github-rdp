// signup_single_direct_spam.js
// Direct GitHub signup using duckspam.com for email (no Tor)

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const os = require('os');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Chrome path detection
const isWin = os.platform() === 'win32';
let chromePath = isWin ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome';
if (!fs.existsSync(chromePath) && isWin) chromePath = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';

// Dropbox upload helper
const https = require('https');
function uploadToDropbox(dropboxPath, buffer) {
    const token = process.env.DROPBOX_TOKEN;
    return new Promise((resolve, reject) => {
        if (!token) return reject(new Error('DROPBOX_TOKEN not set'));
        const args = { path: dropboxPath, mode: 'overwrite', autorename: false, mute: false, strict_conflict: false };
        const options = {
            hostname: 'content.dropboxapi.com',
            path: '/2/files/upload',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/octet-stream',
                'Dropbox-API-Arg': JSON.stringify(args)
            }
        };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
                else reject(new Error(`Dropbox upload failed ${res.statusCode}: ${data}`));
            });
        });
        req.on('error', reject);
        req.write(buffer);
        req.end();
    });
}
function saveJsonToLocalAndDropbox(filePath, obj) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 4));
        console.log(`Saved ${filePath}`);
    } catch (e) {
        console.error(`Failed to save ${filePath}:`, e.message);
    }
    const token = process.env.DROPBOX_TOKEN;
    if (token) {
        const dropPath = (process.env.DROPBOX_DIR || '') + '/' + path.basename(filePath);
        uploadToDropbox(dropPath, Buffer.from(JSON.stringify(obj, null, 4)))
            .then(() => console.log(`Uploaded ${dropPath} to Dropbox`))
            .catch(err => console.error('Dropbox upload error:', err.message));
    }
}

// Duckspam email fetch
async function getDuckspamEmail() {
    const res = await fetch('https://duckspam.com/api/v1/mailbox');
    const data = await res.json();
    if (!data || !data.address) throw new Error('Failed to get duckspam email');
    return data.address;
}


// Save token to github_tokens.json and Dropbox
function saveTokenToJson(username, token) {
    const filePath = path.join(__dirname, 'github_tokens.json');
    let tokens = [];
    if (fs.existsSync(filePath)) try { tokens = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { }
    tokens.push({ username, token, date: new Date().toISOString() });
    saveJsonToLocalAndDropbox(filePath, tokens);

    const configPath = path.join(__dirname, 'config.json');
    const now = new Date();
    const config = {
        GITHUB_USERNAME: username,
        GITHUB_TOKEN: token,
        CREATED_AT: now.toISOString(),
        DATE_HUMAN: now.toLocaleString()
    };
    saveJsonToLocalAndDropbox(configPath, config);
}

// ...existing code for GitHub signup, using getDuckspamEmail for email...

console.log('signup_single_direct_spam.js ready. Token saving to Dropbox is implemented.');
