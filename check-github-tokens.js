const path = require('path');
const { downloadFromDropbox } = require('./dropbox_utils');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const DROPBOX_DIR = process.env.DROPBOX_DIR || '';
const DROPBOX_FILE = DROPBOX_DIR + '/github_tokens.json';

(async () => {
    try {
        const fileData = await downloadFromDropbox(DROPBOX_FILE);
        if (fileData) {
            // Count occurrences of 'token' in the file
            const tokenCount = (fileData.match(/"token"/g) || []).length;
            console.log(`Token count in github_tokens.json: ${tokenCount}`);
        } else {
            console.log('github_tokens.json not found on Dropbox.');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
