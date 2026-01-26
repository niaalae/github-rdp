const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { uploadToDropbox } = require('./dropbox_utils');

const TOKENS_PATH = path.join(__dirname, 'github_tokens.json');
const DROPBOX_DIR = process.env.DROPBOX_DIR || '';
const DROPBOX_FILE = DROPBOX_DIR + '/github_tokens.json';

function loadTokens() {
    if (!fs.existsSync(TOKENS_PATH)) {
        console.error('github_tokens.json not found.');
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
}

function saveTokens(tokens) {
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 4));
    console.log('Local github_tokens.json updated.');
}

async function updateDropbox(tokens) {
    await uploadToDropbox(DROPBOX_FILE, tokens);
    console.log('Dropbox github_tokens.json updated.');
}

async function main() {
    let tokens = loadTokens();
    if (!Array.isArray(tokens)) {
        console.error('github_tokens.json is not an array.');
        process.exit(1);
    }
    const before = tokens.length;
    tokens = tokens.filter(t => !t.suspended);
    const after = tokens.length;
    if (after === before) {
        console.log('No suspended accounts found.');
    } else {
        console.log(`Removed ${before - after} suspended account(s).`);
        saveTokens(tokens);
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Do you want to update github_tokens.json on Dropbox? (yes/no): ', async (answer) => {
        if (answer.trim().toLowerCase().startsWith('y')) {
            await updateDropbox(tokens);
        } else {
            console.log('Dropbox not updated.');
        }
        rl.close();
    });
}

main();
