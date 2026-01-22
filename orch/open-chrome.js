// open-chrome.js
// Launches Chrome with Puppeteer and StealthPlugin, using system Chrome path

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const os = require('os');
const fs = require('fs');

// Chrome path detection
const isWin = os.platform() === 'win32';
let chromePath = isWin ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome';
if (!fs.existsSync(chromePath) && isWin) chromePath = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';

(async () => {
    console.log('Launching Chrome at:', chromePath);
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: chromePath,
        args: ['--no-sandbox', '--window-size=1200,800']
    });
    const page = await browser.newPage();
    await page.goto('https://www.google.com');
    console.log('Chrome launched.');
    // Keep browser open
})();
