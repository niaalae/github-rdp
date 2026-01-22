// open-chrome-tor.js
// Launches Chrome with Puppeteer and StealthPlugin, using Tor proxy

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
    console.log('Launching Chrome with Tor proxy at:', chromePath);
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: chromePath,
        args: [
            '--no-sandbox',
            '--window-size=1200,800',
            '--proxy-server=socks5://127.0.0.1:9050'
        ]
    });
    const page = await browser.newPage();
    await page.goto('https://check.torproject.org');
    console.log('Chrome launched with Tor proxy.');
    // Keep browser open
})();
