const got = require('got').default;
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const APP_KEY = process.env.DROPBOX_APP_KEY;
const APP_SECRET = process.env.DROPBOX_APP_SECRET;
// Prefer refresh token, fallback to access token if needed (but refresh is safer for long-running)
const REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN;
let cachedAccessToken = process.env.DROPBOX_ACCESS_TOKEN;

async function getAccessToken() {
    if (!APP_KEY || !APP_SECRET || !REFRESH_TOKEN) {
        // If we don't have refresh credentials, try to just use access token if it exists
        if (cachedAccessToken) {
            // console.warn('Warning: gathering Dropbox Access Token without Refresh Token. Token might expire.');
            return cachedAccessToken;
        }
        throw new Error('Dropbox credentials missing. Need DROPBOX_APP_KEY, DROPBOX_APP_SECRET, and DROPBOX_REFRESH_TOKEN in .env');
    }

    try {
        // console.log('Refreshing Dropbox Access Token...');
        const response = await got.post('https://api.dropboxapi.com/oauth2/token', {
            form: {
                grant_type: 'refresh_token',
                refresh_token: REFRESH_TOKEN,
                client_id: APP_KEY,
                client_secret: APP_SECRET
            },
            responseType: 'json'
        });

        if (response.body.access_token) {
            cachedAccessToken = response.body.access_token;
            // console.log('Dropbox Token Refreshed.');
            return cachedAccessToken;
        } else {
            throw new Error('No access token in refresh response');
        }
    } catch (error) {
        console.error('Error refreshing Dropbox token:', error.response ? error.response.body : error.message);
        // If refresh fails, try to return cached one if available, though unlikely to work if expired
        if (cachedAccessToken) return cachedAccessToken;
        throw error;
    }
}

async function uploadToDropbox(dropboxPath, content) { // content can be string or buffer or object
    const accessToken = await getAccessToken();

    let body = content;
    if (typeof content === 'object' && !Buffer.isBuffer(content)) {
        body = JSON.stringify(content, null, 4);
    }

    const response = await got.post('https://content.dropboxapi.com/2/files/upload', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Dropbox-API-Arg': JSON.stringify({
                path: dropboxPath,
                mode: 'overwrite',
                autorename: false,
                mute: false,
                strict_conflict: false
            }),
            'Content-Type': 'application/octet-stream' // generic
        },
        body: body,
        throwHttpErrors: true
    });
    return response.body;
}

async function downloadFromDropbox(dropboxPath) {
    const accessToken = await getAccessToken();
    try {
        const response = await got.post('https://content.dropboxapi.com/2/files/download', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath })
            },
            throwHttpErrors: true // We might want to handle 409 (not found) specifically
        });
        return response.body;
    } catch (e) {
        if (e.response && e.response.statusCode === 409) {
            return null; // Not found
        }
        throw e;
    }
}

module.exports = {
    getAccessToken,
    uploadToDropbox,
    downloadFromDropbox
};
