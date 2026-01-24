const os = require('os');
console.log('Detected platform:', os.platform());
const isWin = os.platform() === 'win32';
const winChromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];
let chromePath = null;
let torPath = null;
if (isWin) {
    for (const p of winChromePaths) {
        if (require('fs').existsSync(p)) {
            chromePath = p;
            break;
        }
    }
    torPath = 'C:/Users/Administrator/Desktop/Tor Browser/Browser/TorBrowser/Tor/tor.exe';
} else {
    chromePath = '/usr/bin/google-chrome';
    torPath = '/usr/bin/tor';
}
// reversed.js
// REVERSED FLOW: GitHub -> Temp Mail -> Proton -> Resend Code -> Complete GitHub
// ENHANCED VERSION: VPN Selective Routing + Multi-tiered Temp Mail + Tor IP Rotation + Human Noise

require('dotenv').config();

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// Cross-platform Chrome path detection
const os = require('os');
let chromePath, torPath;
if (os.platform() === 'win32') {
    const winChromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];
    for (const p of winChromePaths) {
        if (require('fs').existsSync(p)) {
            chromePath = p;
            break;
        }
    }
    torPath = 'C:/Users/Administrator/Desktop/Tor Browser/Browser/TorBrowser/Tor/tor.exe';
} else {
    chromePath = '/usr/bin/google-chrome';
    torPath = '/usr/bin/tor';
}
if (chromePath) {
    console.log('Using Chrome at:', chromePath);
} else {
    console.error('Chrome not found on this system.');
}
if (torPath) {
    console.log('Using Tor at:', torPath);
} else {
    console.error('Tor not found on this system.');
}

const https = require('https');
const pathModule = require('path');

function uploadToDropbox(dropboxPath, buffer) {
    const token = process.env.DROPBOX_ACCESS_TOKEN || process.env.DROPBOX_TOKEN;
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
        require('fs').writeFileSync(filePath, JSON.stringify(obj, null, 4));
        console.log(`Saved ${filePath}`);
    } catch (e) {
        console.error(`Failed to save ${filePath}:`, e.message);
    }
    const token = process.env.DROPBOX_ACCESS_TOKEN || process.env.DROPBOX_TOKEN;
    if (token) {
        const dropPath = (process.env.DROPBOX_DIR || '') + '/' + pathModule.basename(filePath);
        uploadToDropbox(dropPath, Buffer.from(JSON.stringify(obj, null, 4)))
            .then(() => console.log(`Uploaded ${dropPath} to Dropbox`))
            .catch(err => console.error('Dropbox upload error:', err.message));
    }
}

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const net = require('net');
const os = require('os');
const cluster = require('cluster');

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

// ============================================
// VPN MANAGER (Selective Routing)
// ============================================
class VPNManager {
    constructor(ovpnPath, authPath) {
        this.ovpnPath = ovpnPath;
        this.authPath = authPath;
        this.vpnProcess = null;
        this.vpnIp = null;
        this.gateway = null;
        this.ifIndex = 10; // TAP-Windows Adapter V9 index
        this.routedIps = new Set();
        this.targetDomains = [
            'github.com',
            'github.githubassets.com',
            'collector.github.com',
            'objects.githubusercontent.com',
            'avatars.githubusercontent.com',
            'account.proton.me',
            'mail.proton.me',
            'api.proton.me',
            'mail.tm',
            'temp-mail.io',
            'tempail.com',
            'ipv4.icanhazip.com',
            'arkoselabs.com',
            'hcaptcha.com'
        ];
    }

    async start() {
        console.log(`Starting VPN with ${path.basename(this.ovpnPath)}...`);

        this.vpnProcess = spawn('C:\\Program Files\\OpenVPN\\bin\\openvpn.exe', [
            '--config', this.ovpnPath,
            '--auth-user-pass', this.authPath,
            '--route-nopull',
            '--verb', '4'
        ]);

        return new Promise((resolve, reject) => {
            let log = '';
            this.vpnProcess.stdout.on('data', (data) => {
                const line = data.toString();
                process.stdout.write(line);
                log += line;
                if (line.includes('Initialization Sequence Completed')) {
                    const ipMatch = log.match(/static (\d+\.\d+\.\d+\.\d+)/);
                    if (ipMatch) {
                        this.vpnIp = ipMatch[1];
                        this.gateway = this.vpnIp.split('.').slice(0, 3).join('.') + '.1';
                        console.log(`VPN Initialized. IP: ${this.vpnIp}, Gateway: ${this.gateway}`);
                        this.setupRouting().then(() => resolve(this.vpnIp)).catch(reject);
                    } else {
                        setTimeout(() => {
                            try {
                                const ipconfig = execSync('ipconfig').toString();
                                const lines = ipconfig.split('\n');
                                let found = false;
                                for (const l of lines) {
                                    if (l.includes('Local Area Connection')) found = true;
                                    if (found && l.includes('IPv4 Address')) {
                                        const match = l.match(/(\d+\.\d+\.\d+\.\d+)/);
                                        if (match && !match[1].startsWith('169.254')) {
                                            this.vpnIp = match[1];
                                            this.gateway = this.vpnIp.split('.').slice(0, 3).join('.') + '.1';
                                            console.log(`VPN IP found via ipconfig: ${this.vpnIp}`);
                                            this.setupRouting().then(() => resolve(this.vpnIp)).catch(reject);
                                            return;
                                        }
                                    }
                                }
                                reject(new Error('Could not determine VPN IP'));
                            } catch (e) { reject(e); }
                        }, 5000);
                    }
                }
            });

            this.vpnProcess.stderr.on('data', (data) => {
                process.stderr.write(data.toString());
            });

            this.vpnProcess.on('close', (code) => {
                console.log(`VPN process exited with code ${code}`);
                this.cleanupRoutes();
            });

            setTimeout(() => reject(new Error('VPN startup timeout')), 60000);
        });
    }

    async setupRouting() {
        console.log('Setting up selective routing...');
        for (const domain of this.targetDomains) {
            await this.addRouteForDomain(domain);
        }
    }

    async addRouteForDomain(domain) {
        try {
            const lookup = await dns.lookup(domain, { all: true });
            for (const entry of lookup) {
                if (entry.family === 4) {
                    const ip = entry.address;
                    if (!this.routedIps.has(ip)) {
                        try {
                            try { execSync(`route delete ${ip}`, { stdio: 'ignore' }); } catch (e) { }
                            execSync(`route add ${ip} mask 255.255.255.255 ${this.gateway} metric 1 if ${this.ifIndex}`, { stdio: 'ignore' });
                            this.routedIps.add(ip);
                        } catch (e) { }
                    }
                }
            }
        } catch (e) { }
    }

    cleanupRoutes() {
        if (this.routedIps.size === 0) return;
        console.log(`Cleaning up ${this.routedIps.size} routes...`);
        for (const ip of this.routedIps) {
            try { execSync(`route delete ${ip}`, { stdio: 'ignore' }); } catch (e) { }
        }
        this.routedIps.clear();
    }

    async stop() {
        this.cleanupRoutes();
        if (this.vpnProcess) {
            try {
                process.kill(this.vpnProcess.pid);
            } catch (e) {
                // spawn('taskkill', ['/F', '/T', '/PID', this.vpnProcess.pid]);
            }
        }
    }
}

class TorManager {
    constructor(torPath, port = 9050, controlPort = 9051) {
        this.torPath = torPath;
        this.torProcess = null;
        this.port = port;
        this.controlPort = controlPort;
        this.dataDir = path.join(os.tmpdir(), `tor-data-${this.port}-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
    }

    async start() {
        // Add a small random delay to prevent simultaneous startup spikes in parallel mode
        await sleep(Math.random() * 5000);

        console.log(`Starting Tor on port ${this.port} (ControlPort ${this.controlPort})...`);

        // Kill any process on these ports first
        if (process.platform === 'win32') {
            try {
                const ports = [this.port, this.controlPort];
                for (const p of ports) {
                    try {
                        const output = execSync(`netstat -ano | findstr :${p}`).toString();
                        const lines = output.split('\n');
                        for (const line of lines) {
                            const match = line.trim().match(/\s+(\d+)$/);
                            if (match) {
                                const pid = match[1];
                                if (pid !== '0') {
                                    console.log(`Killing process ${pid} on port ${p}...`);
                                    execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                                }
                            }
                        }
                    } catch (e) { }
                }
                await sleep(2000); // Give OS time to release ports
            } catch (e) { }
        }

        if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });

        const torDir = path.dirname(this.torPath);
        const geoipPath = path.join(torDir, '..', '..', 'Data', 'Tor', 'geoip');
        const geoipv6Path = path.join(torDir, '..', '..', 'Data', 'Tor', 'geoip6');

        const args = [
            '--SocksPort', this.port.toString(),
            '--ControlPort', this.controlPort.toString(),
            '--DataDirectory', this.dataDir,
            '--NewCircuitPeriod', '15',
            '--MaxCircuitDirtiness', '15',
            '--CircuitPriorityHalflife', '30',
            '--UseEntryGuards', '1',
            '--NumEntryGuards', '3',
            '--EntryNodes', '{us},{gb},{de},{fr},{ca},{au}',
            '--ExitNodes', '{us},{gb},{de},{fr},{ca},{au}',
            '--AvoidDiskWrites', '1',
            '--Log', 'notice stdout',
            '--Log', `notice file ${path.join(this.dataDir, 'tor.log')}`,
            '--FastFirstHopPK', '1',
            '--ExcludeNodes', '{cn},{ru},{ir},{sy},{kp}'
        ];

        if (fs.existsSync(geoipPath)) {
            args.push('--GeoIPFile', geoipPath);
        }
        if (fs.existsSync(geoipv6Path)) {
            args.push('--GeoIPv6File', geoipv6Path);
        }

        this.torProcess = spawn(this.torPath, args);

        return new Promise((resolve, reject) => {
            let log = '';
            let isResolved = false;

            this.torProcess.stdout.on('data', (data) => {
                const line = data.toString();
                log += line;
                if (line.includes('Bootstrapped')) {
                    const match = line.match(/Bootstrapped (\d+)%/);
                    if (match) console.log(`Tor Port ${this.port} Progress: ${match[1]}%`);
                }
                if (line.includes('Bootstrapped 100%')) {
                    console.log(`Tor Port ${this.port} is ready!`);
                    isResolved = true;
                    resolve();
                }
            });

            this.torProcess.stderr.on('data', (data) => {
                const errLine = data.toString();
                console.error(`[Tor Port ${this.port} STDERR] ${errLine}`);
            });

            this.torProcess.on('error', (err) => {
                if (!isResolved) {
                    isResolved = true;
                    reject(err);
                }
            });

            this.torProcess.on('close', (code) => {
                if (!isResolved) {
                    isResolved = true;
                    reject(new Error(`Tor exited with code ${code} before bootstrapping`));
                } else if (code !== 0 && code !== null) {
                    console.error(`Tor Port ${this.port} exited with code ${code}`);
                }
            });

            setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    reject(new Error('Tor startup timeout'));
                }
            }, 120000);
        });
    }

    async renewCircuit() {
        console.log('Requesting new Tor circuit (NEWNYM)...');
        return new Promise((resolve) => {
            const client = net.createConnection({ port: this.controlPort }, () => {
                client.write('AUTHENTICATE ""\r\n');
                client.write('SIGNAL NEWNYM\r\n');
                client.write('QUIT\r\n');
            });
            client.on('data', (data) => {
                if (data.toString().includes('250 OK')) {
                    // Success
                }
            });
            client.on('end', () => {
                console.log('Tor circuit renewed.');
                resolve();
            });
            client.on('error', (err) => {
                console.error('Tor ControlPort error:', err.message);
                resolve();
            });
            setTimeout(resolve, 5000);
        });
    }

    stop() {
        if (this.torProcess) {
            console.log(`Stopping Tor on port ${this.port}...`);
            try {
                if (process.platform === 'win32') {
                    execSync(`taskkill /F /T /PID ${this.torProcess.pid}`, { stdio: 'ignore' });
                } else {
                    this.torProcess.kill();
                }
            } catch (e) { }
            this.torProcess = null;

            // Synchronous cleanup of data dir
            if (fs.existsSync(this.dataDir)) {
                try { fs.rmSync(this.dataDir, { recursive: true, force: true }); } catch (e) { }
            }
        }
    }
}

async function clearBrowserData(page) {
    try {
        const client = await page.target().createCDPSession();
        await client.send('Network.clearBrowserCache');
        await client.send('Network.clearBrowserCookies');
        console.log('Browser cache and cookies cleared.');
    } catch (e) {
        console.log('Error clearing browser data:', e.message);
    }
}

// ============================================
// UTILITIES & STEALTH
// ============================================
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function randomSleep(min, max) { return sleep(min + Math.random() * (max - min)); }

async function applyAdvancedStealth(page, userAgentObj) {
    const { userAgent, isMobile, viewport } = userAgentObj;

    await page.setUserAgent(userAgent);
    if (viewport) {
        await page.setViewport(viewport);
    }

    await page.evaluateOnNewDocument(({ isMobile }) => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {} };
        const plugins = Array.from({ length: 5 + Math.floor(Math.random() * 5) }, (_, i) => ({ name: `Plugin ${i}` }));
        Object.defineProperty(navigator, 'plugins', { get: () => plugins });
        Object.defineProperty(navigator, 'languages', { get: () => Math.random() > 0.5 ? ['en-US', 'en'] : ['en-GB', 'en'] });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => [4, 8, 12, 16][Math.floor(Math.random() * 4)] });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => [4, 8][Math.floor(Math.random() * 2)] });

        if (isMobile) {
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 2 + Math.floor(Math.random() * 4) });
            navigator.permissions.query = (spec) =>
                spec.name === 'notifications' ? Promise.resolve({ state: 'denied' }) : Promise.resolve({ state: 'granted' });
        }

        const originalGetImageData = HTMLCanvasElement.prototype.getContext('2d').getImageData;
        CanvasRenderingContext2D.prototype.getImageData = function (x, y, width, height) {
            const imageData = originalGetImageData.apply(this, arguments);
            for (let i = 0; i < imageData.data.length; i += 4) {
                imageData.data[i] = imageData.data[i] + (Math.random() > 0.5 ? 1 : -1);
            }
            return imageData;
        };

        const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (parameter) {
            if (parameter === 37445) return 'Intel Inc.';
            if (parameter === 37446) return 'Intel(R) Iris(TM) Plus Graphics 640';
            return originalGetParameter.apply(this, arguments);
        };
    }, { isMobile });
}

function getRandomUserAgent(forceMobile = false, forceWindows = false) {
    const desktopUAs = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    const otherDesktopUAs = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    ];
    const mobileUAs = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.101 Mobile Safari/537.36',
        'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    ];

    let isMobile = forceMobile;
    if (!forceMobile && !forceWindows) {
        isMobile = Math.random() > 0.5;
    }

    let userAgent;
    if (isMobile) {
        userAgent = mobileUAs[Math.floor(Math.random() * mobileUAs.length)];
    } else if (forceWindows) {
        userAgent = desktopUAs[Math.floor(Math.random() * desktopUAs.length)];
    } else {
        const allDesktop = [...desktopUAs, ...otherDesktopUAs];
        userAgent = allDesktop[Math.floor(Math.random() * allDesktop.length)];
    }

    let viewport;
    if (isMobile) {
        viewport = { width: 360 + Math.floor(Math.random() * 120), height: 640 + Math.floor(Math.random() * 300), isMobile: true, hasTouch: true };
    } else {
        viewport = { width: 1024 + Math.floor(Math.random() * 900), height: 768 + Math.floor(Math.random() * 300), isMobile: false, hasTouch: false };
    }
    return { userAgent, isMobile, viewport };
}

async function randomNoise(page) {
    try {
        const { width, height } = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));

        // 1. Mouse movements (Reduced for speed)
        for (let i = 0; i < 5 + Math.floor(Math.random() * 5); i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 10) });

            // Occasional wiggle
            if (Math.random() > 0.9) {
                for (let j = 0; j < 2; j++) {
                    await page.mouse.move(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, { steps: 2 });
                }
            }
        }

        // 2. Random scrolling (Reduced for speed)
        for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
            const scrollAmount = (Math.random() - 0.5) * 1000;
            await page.evaluate((amt) => window.scrollBy({ top: amt, behavior: 'smooth' }), scrollAmount);
            await sleep(200 + Math.random() * 300);
        }
    } catch (e) { }
}

async function humanType(pageOrFrame, selectorOrElement, text) {
    const isFrame = typeof pageOrFrame.page === 'function';
    const page = isFrame ? pageOrFrame.page() : pageOrFrame;
    const isElement = typeof selectorOrElement !== 'string';
    try {
        let element = isElement ? selectorOrElement : await pageOrFrame.waitForSelector(selectorOrElement, { visible: true, timeout: 15000 }).catch(() => pageOrFrame.$(selectorOrElement));
        if (!element) return;

        await element.focus();
        await element.click(); // Ensure focus
        await sleep(300 + Math.random() * 500);

        // Clear existing content
        await element.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await sleep(300);

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // Randomly "mistype" and correct (Reduced to 0.5% chance)
            if (Math.random() < 0.005) {
                const chars = 'abcdefghijklmnopqrstuvwxyz';
                const wrongChar = chars[Math.floor(Math.random() * chars.length)];
                await page.keyboard.type(wrongChar, { delay: 20 + Math.random() * 30 });
                await sleep(50 + Math.random() * 100);
                await page.keyboard.press('Backspace');
                await sleep(50 + Math.random() * 100);
            }

            await page.keyboard.type(char, { delay: 20 + Math.random() * 50 });
            if (Math.random() > 0.98) await sleep(200 + Math.random() * 400);
        }

        // Verification check
        const val = await pageOrFrame.evaluate(el => el.value, element);
        if (val !== text) {
            console.log(`Typing mismatch (expected ${text}, got ${val}). Using direct set fallback.`);
            await pageOrFrame.evaluate((el, t) => {
                el.value = t;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, element, text);
        }
    } catch (e) { console.error('Error in humanType:', e.message); }
}

async function moveMouseCurvy(page, targetX, targetY) {
    const start = await page.evaluate(() => ({ x: window.scrollX + window.innerWidth / 2, y: window.scrollY + window.innerHeight / 2 }));
    const steps = 15 + Math.floor(Math.random() * 10);
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const curX = start.x + (targetX - start.x) * t + Math.sin(t * Math.PI) * (Math.random() - 0.5) * 50;
        const curY = start.y + (targetY - start.y) * t + Math.cos(t * Math.PI) * (Math.random() - 0.5) * 50;
        await page.mouse.move(curX, curY);
        await sleep(10 + Math.random() * 20);
    }
    await page.mouse.move(targetX, targetY);
}

async function humanClick(pageOrFrame, selectorOrElement) {
    const isFrame = typeof pageOrFrame.page === 'function';
    const page = isFrame ? pageOrFrame.page() : pageOrFrame;
    const isElement = typeof selectorOrElement !== 'string';
    try {
        let element = isElement ? selectorOrElement : await pageOrFrame.$(selectorOrElement);
        if (!element) return false;
        const box = await element.boundingBox();
        if (!box) return false;
        const x = box.x + box.width * (0.2 + Math.random() * 0.6);
        const y = box.y + box.height * (0.2 + Math.random() * 0.6);
        await moveMouseCurvy(page, x, y);
        await sleep(150 + Math.random() * 300);
        await page.mouse.click(x, y);
        return true;
    } catch (e) { return false; }
}

async function getTempMail(browser, userAgent) {
    console.log('\n========== STEP 2: Getting Temp Mail ==========');
    const page = await browser.newPage();
    await applyAdvancedStealth(page, userAgent);
    try {
        console.log('Navigating to temp-mail.io...');
        await page.goto('https://temp-mail.io/en', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('#email', { timeout: 30000 });

        let email = '';
        for (let i = 0; i < 10; i++) {
            email = await page.$eval('#email', el => el.value);
            if (email && email.includes('@')) break;
            await sleep(1000);
        }

        if (email && email.includes('@')) {
            console.log(`Obtained email from temp-mail.io: ${email}`);
            return { page, email, service: 'temp-mail.io' };
        }
    } catch (e) {
        console.error('Failed to get temp mail from temp-mail.io:', e.message);
    }
    await page.close();
    throw new Error('Failed to obtain temp mail');
}

async function fetchProtonCode(tempMailPage, serviceName) {
    console.log(`Waiting for Proton code in ${serviceName}...`);
    for (let i = 0; i < 60; i++) {
        await tempMailPage.bringToFront();
        await sleep(1000);
        const findCode = async (pageOrFrame) => {
            return await pageOrFrame.evaluate(() => {
                const bodyText = document.body.innerText;
                const match = bodyText.match(/\b(\d{6})\b/);
                return match ? match[1] : null;
            });
        };
        let code = await findCode(tempMailPage);
        if (!code) {
            for (const frame of tempMailPage.frames()) {
                try { code = await findCode(frame); if (code) break; } catch (err) { }
            }
        }
        if (code) return code;
        if (i % 10 === 0) await tempMailPage.reload({ waitUntil: 'domcontentloaded' });
    }
    return null;
}

function generateRealisticUsername() {
    const words = [
        'Swift', 'Bright', 'Shadow', 'Moon', 'Sun', 'River', 'Mountain', 'Cloud', 'Silver', 'Golden',
        'Blue', 'Red', 'Green', 'Dark', 'Light', 'Storm', 'Wind', 'Fire', 'Ice', 'Stone',
        'Wolf', 'Eagle', 'Bear', 'Fox', 'Hawk', 'Lion', 'Tiger', 'Deer', 'Owl', 'Raven',
        'Alpha', 'Omega', 'Delta', 'Echo', 'Bravo', 'Zeta', 'Nova', 'Star', 'Galaxy', 'Pixel',
        'Logic', 'Code', 'Byte', 'Data', 'Flow', 'Grid', 'Link', 'Node', 'Path', 'Core'
    ];
    let username = '';
    for (let i = 0; i < 4; i++) {
        username += words[Math.floor(Math.random() * words.length)];
    }
    username += Math.floor(Math.random() * 10);
    return username;
}

async function completeProtonOnboarding(protonPage, creds) {
    console.log('\n========== STEP 3: Completing Proton Onboarding ==========');
    await protonPage.bringToFront();
    try {
        // 1. Recovery Warning
        console.log('Waiting for recovery warning checkbox...');
        let recoveryHandled = false;
        for (let i = 0; i < 450; i++) { // 15 minute timeout (450 * 2s)
            const checkbox = await protonPage.$('input#understood-recovery-necessity');
            if (checkbox) {
                const isChecked = await protonPage.evaluate(el => el.checked, checkbox);
                if (!isChecked) {
                    console.log('Checking recovery necessity checkbox...');
                    await humanClick(protonPage, checkbox);
                    await sleep(2000);
                    const verifiedChecked = await protonPage.evaluate(el => el.checked, checkbox);
                    if (!verifiedChecked) {
                        console.log('Checkbox still not checked, trying direct evaluate click...');
                        await protonPage.evaluate(el => el.click(), checkbox);
                        await sleep(1000);
                    }
                }

                // Find continue button by text
                const continueBtn = await protonPage.evaluateHandle(() => {
                    return Array.from(document.querySelectorAll('button')).find(b =>
                        b.innerText.includes('Continue') || b.innerText.includes('Next')
                    );
                });

                if (continueBtn && continueBtn.asElement()) {
                    const isDisabled = await protonPage.evaluate(btn => btn.disabled, continueBtn.asElement());
                    if (!isDisabled) {
                        console.log('Clicking continue on recovery warning...');
                        await humanClick(protonPage, continueBtn.asElement());
                        await sleep(5000);
                        recoveryHandled = true;
                        break;
                    } else {
                        console.log('Continue button is still disabled, retrying checkbox...');
                        // Force check if disabled
                        await protonPage.evaluate(el => el.checked = true, checkbox);
                        await protonPage.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })), checkbox);
                        await sleep(1000);
                    }
                }
            } else {
                // Check if we already passed this screen
                const displayNameInput = await protonPage.$('input#displayName');
                if (displayNameInput) {
                    console.log('Recovery warning skipped or already handled.');
                    recoveryHandled = true;
                    break;
                }
            }
            await sleep(2000);
        }

        if (!recoveryHandled) {
            console.log('Failed to handle recovery warning. Restarting Proton...');
            throw new Error('RESTART_NEEDED');
        }

        // 2. Display Name
        await sleep(3000);
        console.log('Waiting for display name input...');
        const displayNameSelector = 'input#displayName';
        try {
            await protonPage.waitForSelector(displayNameSelector, { timeout: 900000 }); // 15 minute timeout
            const displayNameInput = await protonPage.$(displayNameSelector);
            await humanType(protonPage, displayNameInput, Math.random().toString(36).substring(2, 10));
            await sleep(1000);
            await humanClick(protonPage, 'button[type="submit"]');
            console.log('Submitted display name.');
        } catch (e) {
            console.log('Display name input not found. Restarting Proton part...');
            throw new Error('RESTART_NEEDED');
        }

        // 3. Explore Mail
        await sleep(5000);
        console.log('Waiting for Explore Mail button...');
        let exploreHandled = false;
        for (let i = 0; i < 450; i++) { // 15 minute timeout
            const exploreBtn = await protonPage.$('button[data-testid="explore-mail"]');
            if (exploreBtn) {
                await humanClick(protonPage, exploreBtn);
                console.log('Clicked Explore Mail.');
                await sleep(3000);
                exploreHandled = true;
                break;
            }
            // Check if we are already on the next step
            const createOwnBtn = await protonPage.evaluate(() => {
                return !!Array.from(document.querySelectorAll('button')).find(b =>
                    b.innerText.includes('Create your own') || b.innerText.includes('Choose my own')
                );
            });
            if (createOwnBtn) {
                exploreHandled = true;
                break;
            }
            await sleep(2000);
        }

        if (!exploreHandled) {
            console.log('Explore Mail button not found after 15 minutes.');
            throw new Error('RESTART_NEEDED: Explore Mail button timeout');
        }

        // 4. Choose my own username
        console.log('Checking for "Create your own" username selection...');
        const usernameInputSelector = 'input#username';

        let usernameFound = false;
        for (let i = 0; i < 450; i++) { // 15 minute timeout
            const btn = await protonPage.evaluateHandle(() => {
                return Array.from(document.querySelectorAll('button')).find(b =>
                    b.innerText.includes('Create your own') ||
                    b.innerText.includes('Choose my own')
                );
            });
            if (btn && btn.asElement()) {
                await humanClick(protonPage, btn.asElement());
                console.log('Clicked "Create your own" username button.');
                await sleep(3000);
                usernameFound = true;
                break;
            }
            const alreadyOnUsername = await protonPage.$(usernameInputSelector);
            if (alreadyOnUsername) {
                console.log('Already on username selection screen.');
                usernameFound = true;
                break;
            }
            await sleep(2000);
        }

        if (!usernameFound) {
            console.log('Neither "Create your own" button nor username input found. Restarting...');
            throw new Error('RESTART_NEEDED');
        }

        // 5. Enter Custom Username
        const username = creds.email.split('@')[0];
        console.log(`Entering custom username: ${username}`);
        try {
            await protonPage.waitForSelector(usernameInputSelector, { timeout: 20000 });
            const usernameInput = await protonPage.$(usernameInputSelector);
            await humanType(protonPage, usernameInput, username);
            await sleep(2000);

            const claimBtnSelector = 'button.button.w-full.button-large.button-solid-norm.mt-6';
            console.log('Waiting for "Claim it" button...');
            await protonPage.waitForSelector(claimBtnSelector, { timeout: 900000 }); // 15 minute timeout

            const startTime = Date.now();
            let firstClickTime = null;
            let claimed = false;
            while (Date.now() - startTime < 900000) { // 15 minute total timeout
                try {
                    const btn = await protonPage.$(claimBtnSelector);
                    if (btn) {
                        const buttonState = await protonPage.evaluate(el => {
                            const style = window.getComputedStyle(el);
                            const isVisible = style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
                            return { isVisible, isDisabled: el.disabled };
                        }, btn).catch(() => ({ isVisible: false, isDisabled: true }));

                        if (buttonState.isDisabled) {
                            console.log('Claim button is disabled. Checking for errors...');
                            const errorText = await protonPage.evaluate(() => {
                                const err = document.querySelector('.notification-danger, [class*="error"]');
                                return err ? err.innerText : null;
                            }).catch(() => null);

                            if (errorText) {
                                console.log(`Proton error: ${errorText}`);
                                if (errorText.toLowerCase().includes('already') || errorText.toLowerCase().includes('taken')) {
                                    console.log('Username taken. Appending random suffix...');
                                    const newUsername = username + Math.floor(Math.random() * 1000);
                                    await protonPage.evaluate(el => el.value = '', usernameInput).catch(() => { });
                                    await humanType(protonPage, usernameInput, newUsername);
                                    await sleep(2000);
                                    firstClickTime = null; // Reset click timer for new username
                                    continue;
                                }
                            }
                        }

                        if (buttonState.isVisible && !buttonState.isDisabled) {
                            if (!firstClickTime) firstClickTime = Date.now();
                            console.log('Clicking "Claim it" button...');
                            await humanClick(protonPage, btn);
                            await sleep(4000);
                        }
                    }

                    // Check if we moved to the next screen
                    const stillThere = await protonPage.$(claimBtnSelector).catch(() => null);
                    if (!stillThere) {
                        claimed = true;
                        break;
                    }

                    // If button is still there after 30s of first click, restart EVERYTHING
                    if (firstClickTime && (Date.now() - firstClickTime > 30000)) {
                        console.log('Claim button still present 30s after click. Restarting FULL process...');
                        throw new Error('FATAL_GITHUB_ERROR');
                    }
                } catch (loopErr) {
                    if (loopErr.message === 'FATAL_GITHUB_ERROR') throw loopErr;
                    console.log(`Warning: Interaction error during claim: ${loopErr.message}`);
                    await sleep(2000);
                }
            }
            if (claimed) console.log('Claimed username successfully.');
            else throw new Error('Timeout waiting for username claim');
        } catch (e) {
            if (e.message.includes('RESTART_NEEDED')) throw e;
            console.log(`Failed to enter/claim custom username: ${e.message}`);
            // Check if we actually succeeded despite the error
            const inboxLink = await protonPage.$('a[data-testid="navigation-link:inbox"]').catch(() => null);
            if (inboxLink) {
                console.log('Actually, we seem to be in the inbox already.');
            } else {
                throw new Error('RESTART_NEEDED');
            }
        }

        // 6. Final Onboarding Steps (Sequential loop from copy script)
        console.log('Handling final onboarding steps...');
        const buttonSteps = [
            { selector: '.modal-two-content footer button.button-solid-norm', text: "Let's get started" },
            { selector: 'button.button.w-full.button-large.button-outline-weak', text: "Maybe later" },
            { selector: '.modal-two-content footer button.button-solid-norm', text: "Next" },
            { selector: '.modal-two-content footer button.button-solid-norm', text: "Use this" },
        ];

        for (const step of buttonSteps) {
            const { selector, text } = step;
            console.log(`Waiting for onboarding button: '${text}'...`);

            let stepStartTime = Date.now();
            let stepClicked = false;

            while (Date.now() - stepStartTime < 900000) { // 15 minute timeout per button (as requested)
                try {
                    // Re-check if page is still valid
                    if (protonPage.isClosed()) throw new Error('Page closed');

                    const btnInfo = await protonPage.evaluate(({ selector, text }) => {
                        try {
                            const btns = Array.from(document.querySelectorAll(selector));
                            for (const btn of btns) {
                                const style = window.getComputedStyle(btn);
                                const visible = style && style.display !== 'none' && style.visibility !== 'hidden' && btn.offsetParent !== null;
                                const enabled = !btn.disabled && !btn.getAttribute('aria-disabled');
                                const btnText = (btn.innerText || btn.textContent || '').trim();
                                if (visible && enabled && btnText.toLowerCase().includes(text.toLowerCase())) {
                                    return { found: true, btnText };
                                }
                            }
                        } catch (e) { }
                        return { found: false };
                    }, { selector, text }).catch(e => {
                        if (e.message.includes('detached') || e.message.includes('context')) return { found: false, retry: true };
                        throw e;
                    });

                    if (btnInfo.found) {
                        const btn = await protonPage.evaluateHandle(({ selector, text }) => {
                            return Array.from(document.querySelectorAll(selector)).find(b => {
                                const style = window.getComputedStyle(b);
                                const visible = style && style.display !== 'none' && style.visibility !== 'hidden' && b.offsetParent !== null;
                                return visible && b.innerText.toLowerCase().includes(text.toLowerCase());
                            });
                        }, { selector, text }).catch(() => null);

                        if (btn && btn.asElement()) {
                            console.log(`Clicking onboarding button: '${text}' (actual: '${btnInfo.btnText}')`);
                            await humanClick(protonPage, btn.asElement());
                            await sleep(3000);
                            stepClicked = true;
                            break;
                        }
                    }
                } catch (err) {
                    if (err.message.includes('detached') || err.message.includes('context')) {
                        console.log(`Context lost during step '${text}', retrying...`);
                    } else {
                        console.log(`Error during onboarding step '${text}':`, err.message);
                    }
                }
                await sleep(2000);
            }
            if (!stepClicked) {
                console.log(`CRITICAL: Step '${text}' failed after 15 minutes. Not skipping.`);
                throw new Error(`RESTART_NEEDED: Onboarding step '${text}' timed out`);
            }
        }

        // 7. Final verification - wait for inbox
        console.log('Waiting for inbox to load...');
        try {
            await protonPage.waitForSelector('a[data-testid="navigation-link:inbox"]', { timeout: 60000 });
            console.log('Proton account setup complete and inbox loaded!');
        } catch (e) {
            console.log('Inbox did not load. Checking for any remaining modals...');
            await protonPage.keyboard.press('Escape');
            await sleep(2000);
        }
    } catch (e) {
        if (e.message.includes('RESTART_NEEDED')) throw e;
        console.error('Error during Proton onboarding:', e.message);
        throw new Error('RESTART_NEEDED');
    }
}

async function createProtonAccount(browser, creds, tempMailObj, userAgent, tor) {
    console.log('\n========== STEP 2: Creating Proton Account ==========');
    const protonPage = await browser.newPage();
    await applyAdvancedStealth(protonPage, userAgent);
    let currentEmail = tempMailObj.email;
    let tempMailPage = tempMailObj.page;
    let serviceName = tempMailObj.service;

    console.log('Navigating to Proton Mail registration...');
    await protonPage.goto('https://account.proton.me/start?ref=pme_hp_b2c-1', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await sleep(5000);

    await randomNoise(protonPage);

    // 1. Click "use your current email." button
    const useCurrentEmailSelector = 'button.link.link-focus.align-baseline.text-left.color-norm';
    console.log('Waiting for "use your current email" button...');
    await protonPage.waitForSelector(useCurrentEmailSelector, { timeout: 30000 });

    // Try multiple methods to click the button as in get-temp-mail copy.js
    const clicked = await protonPage.evaluate((sel) => {
        const btn = document.querySelector(sel);
        if (btn) {
            btn.setAttribute('style', 'background: red !important; color: white !important; border: 3px solid yellow !important; z-index: 9999 !important;');
            btn.click();
            return true;
        }
        return false;
    }, useCurrentEmailSelector);

    if (!clicked) {
        await humanClick(protonPage, useCurrentEmailSelector);
    }
    console.log('Clicked "use your current email" button.');
    await sleep(2000);

    // 2. Fill email (Search in ALL frames, skipping hidden ones)
    const emailSelector = 'input#email, input[data-testid="input-input-element"], input[type="email"]';
    console.log('Searching for visible email input in all frames...');

    const findVisibleInput = async (selector) => {
        for (const frame of protonPage.frames()) {
            try {
                const elements = await frame.$$(selector);
                for (const el of elements) {
                    const isVisible = await frame.evaluate(e => {
                        const style = window.getComputedStyle(e);
                        const rect = e.getBoundingClientRect();
                        return style && style.display !== 'none' && style.visibility !== 'hidden' && e.offsetParent !== null && rect.width > 0 && rect.height > 0;
                    }, el);
                    if (isVisible) return { el, frame };
                }
            } catch (e) { }
        }
        return null;
    };

    let result = await findVisibleInput(emailSelector);
    if (!result) {
        console.log('Visible email input not found. Checking iframes with "Email" title...');
        for (const frame of protonPage.frames()) {
            try {
                const title = await frame.title();
                const url = frame.url();
                if (title.toLowerCase().includes('email') || url.toLowerCase().includes('name=email')) {
                    const el = await frame.$('input');
                    if (el) { result = { el, frame }; break; }
                }
            } catch (e) { }
        }
    }

    if (result) {
        console.log(`Found visible email input in frame: ${result.frame.url()}`);
        await humanType(result.frame, result.el, currentEmail);
        const val = await result.frame.evaluate(el => el.value, result.el);
        console.log(`Email field value after typing: ${val}`);
    } else {
        console.log('Email input not found. Restarting Proton...');
        throw new Error('RESTART_NEEDED: Email input not found');
    }

    await sleep(1500);
    const submitBtnSelector = 'button[type="submit"], button.button-solid-norm';
    let submitBtn = await result.frame.$(submitBtnSelector);
    if (!submitBtn) submitBtn = await protonPage.$(submitBtnSelector);

    if (submitBtn) {
        await humanClick(submitBtn.frame || protonPage, submitBtn);
    } else {
        await result.frame.keyboard.press('Enter');
    }
    await sleep(5000);

    // 3. Fill password (Search in ALL frames)
    const passwordSelector = 'input#password, input[type="password"]';
    console.log('Waiting for password inputs...');

    let pResult = await findVisibleInput(passwordSelector);
    if (!pResult) {
        // Wait a bit more for password field
        await sleep(5000);
        pResult = await findVisibleInput(passwordSelector);
    }

    if (!pResult) {
        for (const frame of protonPage.frames()) {
            try {
                const title = await frame.title();
                const url = frame.url();
                if (title.toLowerCase().includes('password') || url.toLowerCase().includes('name=password')) {
                    const el = await frame.$('input');
                    if (el) { pResult = { el, frame }; break; }
                }
            } catch (e) { }
        }
    }

    if (pResult) {
        await humanType(pResult.frame, pResult.el, creds.password);
        await sleep(500);
        const confirmSelector = 'input#password-confirm, input#repeat-password, input[type="password"]:not(#password)';
        const confirmEl = await pResult.frame.$(confirmSelector);
        if (confirmEl) await humanType(pResult.frame, confirmEl, creds.password);
        await sleep(1000);

        let finalSubmit = await pResult.frame.$(submitBtnSelector);
        if (!finalSubmit) finalSubmit = await protonPage.$(submitBtnSelector);

        if (finalSubmit) {
            await humanClick(finalSubmit.frame || protonPage, finalSubmit);
        } else {
            await pResult.frame.keyboard.press('Enter');
        }
        console.log('Submitted password form.');
    } else {
        console.log('Password input not found. Restarting Proton...');
        throw new Error('RESTART_NEEDED: Password input not found');
    }

    await sleep(8000);

    // 5. Handle Verification
    await protonPage.bringToFront();
    const verificationInput = 'input#verification';
    let vFrame = protonPage;
    let vInput = null;

    // Wait for verification screen to be ready
    console.log('Waiting for verification screen...');
    for (let i = 0; i < 20; i++) {
        for (const frame of protonPage.frames()) {
            vInput = await frame.$(verificationInput);
            if (vInput) { vFrame = frame; break; }
        }
        if (vInput) break;
        await sleep(2000);
    }

    if (!vInput) throw new Error('RESTART_NEEDED: Verification input not found');

    const protonCode = await fetchProtonCode(tempMailPage, serviceName);
    if (protonCode) {
        await protonPage.bringToFront();
        await humanType(vFrame, vInput, protonCode);

        // Find Verify button specifically - avoiding "Resend code"
        let vSubmit = await vFrame.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            // Prioritize button with "Verify" text and specific classes
            return buttons.find(b =>
                b.innerText.trim() === 'Verify' ||
                (b.innerText.includes('Verify') && b.classList.contains('button-solid-norm'))
            ) || null;
        });
        vSubmit = vSubmit.asElement();

        if (vSubmit) {
            console.log('Found Verify button. Clicking...');
            await humanClick(vFrame, vSubmit);
        } else {
            console.log('Verify button not found by text, trying selector fallback...');
            const fallback = await vFrame.$('button.button-solid-norm.mt-6');
            if (fallback) await humanClick(vFrame, fallback);
            else await vFrame.keyboard.press('Enter');
        }

        console.log('Clicked Verify button. Checking for transition (30s timeout)...');
        const verifyStartTime = Date.now();
        let transitioned = false;
        while (Date.now() - verifyStartTime < 30000) {
            // Check for red notification (error) or abusive traffic message
            const errorStatus = await protonPage.evaluate(() => {
                const text = document.body.innerText;
                const abusiveTraffic = text.includes('potentially abusive traffic') || text.includes('blocked any further signups');
                const notifications = Array.from(document.querySelectorAll('.notification-danger, [class*="notification-error"], [style*="background-color: red"], [style*="background: red"]'));
                let redError = false;
                for (const n of notifications) {
                    if (n.querySelector('a') || n.innerText.toLowerCase().includes('link')) {
                        redError = true;
                        break;
                    }
                }
                return { abusiveTraffic, redError };
            }).catch(() => ({ abusiveTraffic: false, redError: false }));

            if (errorStatus.abusiveTraffic || errorStatus.redError) {
                console.log(`Error detected (Abusive: ${errorStatus.abusiveTraffic}, Red: ${errorStatus.redError})! Restarting Proton...`);
                throw new Error('RESTART_NEEDED');
            }

            // Check if we are still on the verification screen
            const stillOnVerify = await vFrame.$(verificationInput).catch(() => null);
            if (!stillOnVerify) {
                console.log('Verification screen disappeared. Transitioning...');
                transitioned = true;
                break;
            }
            await sleep(2000);
        }

        if (!transitioned) {
            console.log('Still on verification screen after 30s. Restarting Proton...');
            throw new Error('RESTART_NEEDED');
        }

        await sleep(2000);
        await completeProtonOnboarding(protonPage, creds);
        return { protonPage };
    }
    throw new Error('RESTART_NEEDED: Proton verification failed');
}

async function startGithubSignup(browser, creds, userAgent, tor) {
    console.log('\n========== STEP 1: Starting GitHub Signup ==========');
    if (tor) await tor.renewCircuit();
    const githubPage = await browser.newPage();
    await applyAdvancedStealth(githubPage, userAgent);
    console.log('Navigating to GitHub signup...');
    await githubPage.goto('https://github.com/signup', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2000);

    // More aggressive cookie banner removal
    console.log('Checking for cookie banners/overlays...');
    await githubPage.evaluate(() => {
        // 1. Specific GitHub Cookie Consent (ghcc-consent)
        const ghcc = document.querySelector('ghcc-consent#ghcc');
        if (ghcc) {
            console.log('Found ghcc-consent banner. Looking for Accept button...');
            const buttons = Array.from(ghcc.querySelectorAll('button'));
            const acceptBtn = buttons.find(b => b.innerText.toLowerCase().includes('accept'));
            if (acceptBtn) {
                acceptBtn.click();
                console.log('Clicked Accept on ghcc-consent.');
                return; // Exit early if we found the main one
            }
        }

        // 2. Fallback for other banners
        const selectors = [
            '[aria-label="Cookie consent"]',
            '.cookie-consent',
            '#cookie-banner',
            '.js-cookie-consent',
            'div[class*="cookie"]',
            'section[class*="cookie"]',
            '#wcpConsentBannerCtrl'
        ];
        selectors.forEach(s => {
            try {
                const el = document.querySelector(s);
                if (el) {
                    console.log(`Removing overlay: ${s}`);
                    el.remove();
                }
            } catch (e) { }
        });

        const allButtons = Array.from(document.querySelectorAll('button, a'));
        const fallbackAccept = allButtons.find(b => {
            const txt = (b.innerText || b.textContent || '').toLowerCase();
            return txt.includes('accept all') || txt.includes('accept cookies') || txt.includes('agree') || txt.includes('dismiss') || txt.includes('got it');
        });
        if (fallbackAccept) {
            console.log('Found fallback accept button, clicking...');
            fallbackAccept.click();
        }
    }).catch(() => { });
    await sleep(500);

    const tasks = [
        { name: 'email', selector: 'input#email', value: creds.email, continueBtn: 'button[data-continue-to="password-container"]' },
        { name: 'password', selector: 'input#password', value: creds.password, continueBtn: 'button[data-continue-to="username-container"]' },
        { name: 'username', selector: 'input#login', value: creds.username, continueBtn: 'button[data-continue-to="opt-in-container"]' }
    ];
    for (const task of tasks) {
        await randomNoise(githubPage);
        console.log(`Filling ${task.name}...`);

        // Wait for field with retry
        let fieldFound = false;
        for (let i = 0; i < 3; i++) {
            try {
                await githubPage.waitForSelector(task.selector, { visible: true, timeout: 10000 });
                fieldFound = true;
                break;
            } catch (e) {
                console.log(`Field ${task.selector} not found, retrying...`);
                await randomNoise(githubPage);
            }
        }
        if (!fieldFound) throw new Error(`Could not find field: ${task.name}`);

        await humanType(githubPage, task.selector, task.value);
        await sleep(500 + Math.random() * 500);

        if (task.continueBtn) {
            console.log(`Clicking continue for ${task.name}...`);
            await githubPage.waitForSelector(task.continueBtn, { visible: true, timeout: 5000 }).catch(() => { });
            const btn = await githubPage.$(task.continueBtn);
            if (btn) {
                await humanClick(githubPage, btn);
                await sleep(1000 + Math.random() * 500);
            }
        }
    }
    const marketingConsent = await githubPage.$('input[id="user_signup[marketing_consent]"]');
    if (marketingConsent) await humanClick(githubPage, marketingConsent);
    const finalContinue = await githubPage.$('button[data-continue-to="captcha-and-submit-container"]');
    if (finalContinue) await humanClick(githubPage, finalContinue);

    await sleep(1000);
    const createBtnSelector = 'button.js-octocaptcha-load-captcha.signup-form-fields__button.Button--primary[data-target="signup-form.SignupButton"]';

    console.log('Entering Post-Fill Analysis & Click Loop...');
    let analysisStart = Date.now();
    const maxAnalysisTime = 300000; // 300 seconds (5 minutes)

    while (Date.now() - analysisStart < maxAnalysisTime) {
        try {
            // 1. Check for SUCCESS (Code inputs)
            if (await githubPage.$('input#launch-code-0')) {
                console.log('SUCCESS: Code inputs detected!');
                return { githubPage };
            }

            // 2. Check for CAPTCHA
            console.log('Checking for CAPTCHA frames...');
            let captchaDetected = false;
            let puzzleDetected = false;
            const frames = githubPage.frames();
            for (const frame of frames) {
                try {
                    const url = frame.url();
                    if (url.includes('arkoselabs.com') || url.includes('hcaptcha.com')) {
                        captchaDetected = true;
                        const content = await frame.content().catch(() => '');
                        if (content.toLowerCase().includes('puzzle')) {
                            puzzleDetected = true;
                            break;
                        }
                    }
                } catch (err) { }
            }

            if (puzzleDetected) {
                console.log('CAPTCHA "puzzle" text detected. Restarting process...');
                throw new Error('RESTART_NEEDED');
            }

            if (captchaDetected) {
                console.log('CAPTCHA loading/active. Waiting to see if it resolves or shows a puzzle...');
                analysisStart = Date.now(); // Reset timeout
                await sleep(5000);
                continue; // Do NOT click the button while CAPTCHA is active
            }

            // 4. Handle Create Account Button
            const createBtn = await githubPage.$(createBtnSelector);
            if (createBtn) {
                const isVisible = await githubPage.evaluate(el => {
                    const style = window.getComputedStyle(el);
                    const rect = el.getBoundingClientRect();
                    return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null && !el.disabled && rect.width > 0 && rect.height > 0;
                }, createBtn);

                if (isVisible) {
                    console.log('Create account button is visible. Clicking...');
                    await githubPage.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), createBtn);
                    await sleep(500);
                    await humanClick(githubPage, createBtn);
                    await sleep(1000);
                }
            }

            console.log('No CAPTCHA or Success yet. Waiting 2 seconds...');
            await sleep(2000);
            if (Math.random() > 0.5) await randomNoise(githubPage);
        } catch (e) {
            if (e.message.includes('RESTART_NEEDED')) throw e;
            console.log('Analysis loop encountered a minor error (likely navigation):', e.message);
            await sleep(2000);
        }
    }

    console.log('Analysis timeout. Restarting...');
    throw new Error('RESTART_NEEDED');
}

async function finishGithubSignup(githubPage, protonPage, creds) {
    console.log('\n========== STEP 4: Finishing GitHub Signup ==========');

    // 0. Trigger resend on GitHub just in case
    await githubPage.bringToFront();
    try {
        const resendBtn = await githubPage.evaluateHandle(() => {
            return Array.from(document.querySelectorAll('button, a')).find(b => b.innerText.toLowerCase().includes('resend'));
        });
        if (resendBtn && resendBtn.asElement()) {
            console.log('Clicking Resend on GitHub...');
            await humanClick(githubPage, resendBtn.asElement());

            // Wait for confirmation text
            console.log('Waiting for "Email was resent" confirmation...');
            let resentConfirmed = false;
            for (let i = 0; i < 10; i++) {
                resentConfirmed = await githubPage.evaluate(() => {
                    const text = document.body.innerText;
                    return text.includes('Email was resent') || text.includes('Sent') || text.includes('resent');
                });
                if (resentConfirmed) {
                    console.log('Resend confirmed!');
                    break;
                }
                await sleep(1000);
            }
            if (!resentConfirmed) console.log('Resend confirmation text not found, but button was clicked.');
            await sleep(3000);
        }
    } catch (e) { }

    // 1. Switch to Proton and get the code
    await protonPage.bringToFront();
    let launchCode = null;
    const maxEmailAttempts = 24;

    for (let i = 0; i < maxEmailAttempts; i++) {
        console.log(`Checking for GitHub email... attempt ${i + 1}/${maxEmailAttempts}`);

        // Refresh inbox by clicking active nav link
        const navBtn = await protonPage.$('a.navigation-link.active');
        if (navBtn) await protonPage.evaluate(el => el.click(), navBtn);
        await sleep(5000);

        // Look for email with subject
        const emailFound = await protonPage.evaluate(() => {
            const spans = document.querySelectorAll('span[id^="message-subject-"]');
            for (const span of spans) {
                if (span.innerText && span.innerText.includes('Your GitHub launch code')) {
                    span.click();
                    return true;
                }
            }
            return false;
        });

        if (emailFound) {
            console.log('Found GitHub launch code email! Clicking on it...');
            await sleep(5000); // Wait for email to open

            // Extract code
            launchCode = await protonPage.evaluate(() => {
                const allText = document.body.innerText || '';
                const matches = allText.match(/\b(\d{8})\b/g);
                if (matches && matches.length > 0) return matches[0];

                const iframes = document.querySelectorAll('iframe');
                for (const iframe of iframes) {
                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow.document;
                        const text = doc.body.innerText || '';
                        const m = text.match(/\b(\d{8})\b/);
                        if (m) return m[1];
                    } catch (e) { }
                }
                return null;
            });

            if (launchCode) {
                console.log('Found launch code:', launchCode);
                break;
            }
        }
    }

    if (!launchCode) throw new Error('Could not find GitHub launch code in Proton inbox.');

    // 2. Enter code on GitHub
    console.log('Entering launch code on GitHub...');
    await githubPage.bringToFront();

    // Ensure we are on the code input screen
    await githubPage.waitForSelector('input#launch-code-0', { visible: true, timeout: 15000 }).catch(() => { });

    for (let i = 0; i < launchCode.length; i++) {
        const char = launchCode[i];
        console.log(`Typing char ${i + 1}: ${char}`);
        await githubPage.type(`input#launch-code-${i}`, char, { delay: 100 + Math.random() * 200 });
        await sleep(200 + Math.random() * 300);
    }
    await sleep(3000);

    // 3. Handle post-code navigation
    const currentUrl = githubPage.url();
    if (!currentUrl.includes('login') && !currentUrl.includes('codespaces')) {
        const verifyBtn = await githubPage.$('button.Primer_Brand__Button-module__Button___lDruK');
        if (verifyBtn) await humanClick(githubPage, verifyBtn);
    }

    await sleep(5000);
    const token = await generateGithubToken(githubPage, creds);
    if (token) saveTokenToJson(creds.username, token);
}

async function generateGithubToken(page, creds) {
    console.log('\n========== STEP 5: Generating GitHub Token ==========');
    try {
        await page.goto('https://github.com/settings/tokens/new', { waitUntil: 'networkidle2' });

        // 1. Handle Login Redirect
        if (page.url().includes('login')) {
            console.log('Login required for token generation. Filling credentials...');
            await humanType(page, 'input#login_field', creds.email);
            await humanType(page, 'input#password', creds.password);
            await humanClick(page, 'input[type="submit"]');
            await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => { });

            // If still on login or redirected elsewhere, try navigating again
            if (!page.url().includes('tokens/new')) {
                await page.goto('https://github.com/settings/tokens/new', { waitUntil: 'networkidle2' });
            }
        }

        // 2. Fill Token Note
        console.log('Filling token note...');
        const noteSelector = 'input[name="oauth_access[description]"]';
        await page.waitForSelector(noteSelector, { visible: true, timeout: 15000 });
        await humanType(page, noteSelector, `Token_${Date.now()}`);

        // 3. Set No Expiration
        console.log('Setting token expiration to "No expiration"...');
        try {
            const expBtnSelector = 'button[id^="action-menu-"][id$="-button"]';
            const expBtn = await page.$(expBtnSelector);
            if (expBtn) {
                await humanClick(page, expBtn);
                await sleep(1500);
                const clicked = await page.evaluate(() => {
                    const options = Array.from(document.querySelectorAll('button[role="menuitemradio"], .ActionListContent'));
                    const noExp = options.find(opt => opt.innerText.includes('No expiration'));
                    if (noExp) {
                        noExp.click();
                        return true;
                    }
                    return false;
                });
                if (!clicked) {
                    console.log('Could not find "No expiration" in menu, trying fallback...');
                    await page.evaluate(() => {
                        const options = Array.from(document.querySelectorAll('li[role="none"]'));
                        const noExp = options.find(opt => opt.innerText.includes('No expiration'));
                        if (noExp) noExp.click();
                    });
                }
            } else {
                await page.click('summary[aria-label="Expiration"]').catch(() => { });
                await sleep(1000);
                await page.evaluate(() => {
                    const options = Array.from(document.querySelectorAll('.SelectMenu-item, .ActionListContent'));
                    const noExp = options.find(opt => opt.innerText.includes('No expiration'));
                    if (noExp) noExp.click();
                });
            }
        } catch (e) {
            console.log('Error setting expiration:', e.message);
        }
        await sleep(1500);

        // 4. Check All Scopes
        console.log('Checking all scope checkboxes...');
        await page.evaluate(() => {
            document.querySelectorAll('input[type="checkbox"][name="oauth_access[scopes][]"]').forEach(cb => {
                if (!cb.checked) cb.click();
            });
        });
        await sleep(2000);

        // 5. Submit
        console.log('Clicking "Generate token" until it disappears or token is found...');
        const genBtnSelector = 'form#new_oauth_access button[type="submit"], .new_oauth_access button.btn-primary.btn, button[type="submit"][data-view-component="true"].btn-primary.btn';
        let clickCount = 0;
        let clickedAtLeastOnce = false;

        while (clickCount < 20) {
            // 1. Force scroll to absolute bottom
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await sleep(1000);

            // 2. Check for token first
            const hasToken = await page.evaluate(() => {
                const el = document.querySelector('code#new-oauth-token');
                if (el && el.innerText.trim().startsWith('gh')) return true;
                return /(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36})/.test(document.body.innerText);
            }).catch(() => false);

            if (hasToken) {
                console.log('Token detected on page. Proceeding to extraction...');
                break;
            }

            try {
                console.log(`Attempting submission via Checkbox-Enter (attempt ${clickCount + 1})...`);

                await page.evaluate(() => {
                    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"][name="oauth_access[scopes][]"]'));
                    if (checkboxes.length > 0) {
                        const target = checkboxes[Math.floor(Math.random() * checkboxes.length)];
                        target.focus();
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        target.style.outline = "5px solid blue";
                    }
                });
                await sleep(1000);
                await page.keyboard.press('Enter');

                clickedAtLeastOnce = true;
                await sleep(3000);

                // Fallback: Try clicking the button
                let genBtn = await page.evaluateHandle((selector) => {
                    const buttons = Array.from(document.querySelectorAll(selector));
                    return buttons.find(el => {
                        const style = window.getComputedStyle(el);
                        const rect = el.getBoundingClientRect();
                        return style && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
                    }) || Array.from(document.querySelectorAll('button')).find(el => {
                        const text = el.innerText.toLowerCase();
                        return text.includes('generate token') && el.offsetParent !== null;
                    });
                }, genBtnSelector).catch(() => null);

                if (genBtn && genBtn.asElement()) {
                    console.log('Button still visible, trying direct click...');
                    await humanClick(page, genBtn.asElement());
                    await sleep(3000);
                }
            } catch (e) {
                console.log('Error in submission attempt:', e.message);
                await sleep(1500);
            }
            clickCount++;
        }

        // 6. Grab Token
        console.log('Waiting for page reload and token to appear...');
        await sleep(3000);

        let token = null;
        for (let i = 0; i < 20; i++) {
            try {
                token = await page.evaluate(() => {
                    // 1. Primary: code#new-oauth-token
                    const el = document.querySelector('code#new-oauth-token');
                    if (el && el.innerText.trim().startsWith('gh')) return el.innerText.trim();

                    // 2. Secondary: any code element starting with gh
                    const codes = Array.from(document.querySelectorAll('code'));
                    for (const c of codes) {
                        const txt = c.innerText.trim();
                        if (txt.startsWith('ghp_') || txt.startsWith('gho_') || txt.startsWith('ghu_') || txt.startsWith('ghs_') || txt.startsWith('ghr_')) return txt;
                    }

                    // 3. Tertiary: search body text for pattern
                    const match = document.body.innerText.match(/(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|ghu_[a-zA-Z0-9]{36}|ghs_[a-zA-Z0-9]{36}|ghr_[a-zA-Z0-9]{36})/);
                    return match ? match[0] : null;
                });

                if (token) break;
            } catch (e) {
                console.log(`Error during token extraction (attempt ${i + 1}): ${e.message}. Retrying...`);
            }

            console.log(`Token not found yet, waiting... (${i + 1}/20)`);
            await sleep(3000);
        }

        if (token) {
            console.log('SUCCESS! Token generated:', token);
            return token;
        } else {
            throw new Error('Could not find generated token on page.');
        }
    } catch (e) {
        console.error('Failed to generate token:', e.message);
        return null;
    }
}

function saveTokenToJson(username, token) {
    const filePath = path.join(__dirname, 'github_tokens.json');
    const lockPath = filePath + '.lock';

    // 1. Save to github_tokens.json with locking
    let attempts = 0;
    let saved = false;
    while (attempts < 20) {
        try {
            if (!fs.existsSync(lockPath)) {
                fs.writeFileSync(lockPath, process.pid.toString());
                let tokens = [];
                if (fs.existsSync(filePath)) {
                    try { tokens = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { }
                }
                tokens.push({ username, token, date: new Date().toISOString() });
                fs.unlinkSync(lockPath);
                saveJsonToLocalAndDropbox(filePath, tokens);
                console.log(`Token saved to ${filePath}`);
                saved = true;
                break;
            }
        } catch (e) { }
        attempts++;
        // Use a small delay between retries
        const start = Date.now();
        while (Date.now() - start < 500) { /* sync sleep */ }
    }

    if (!saved) {
        console.log('Warning: Could not acquire lock for github_tokens.json. Saving without lock.');
        let tokens = [];
        if (fs.existsSync(filePath)) try { tokens = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { }
        tokens.push({ username, token, date: new Date().toISOString() });
        saveJsonToLocalAndDropbox(filePath, tokens);
    }

    // 2. Save to config.json (latest)
    const configPath = path.join(__dirname, 'config.json');
    const now = new Date();
    const config = {
        GITHUB_USERNAME: username,
        GITHUB_TOKEN: token,
        CREATED_AT: now.toISOString(),
        DATE_HUMAN: now.toLocaleString()
    };
    try {
        saveJsonToLocalAndDropbox(configPath, config);
        console.log(`Latest config saved to ${configPath}`);
    } catch (e) {
        console.log('Error saving config.json:', e.message);
    }
}

async function main(instanceId = 0) {
    console.log(`[Instance ${instanceId}] Main function started...`);
    const TOR_EXE = torPath;
    const CHROME_EXE = chromePath;

    // Calculate unique ports per instance
    const ghSocksPort = 9070 + (instanceId * 2);
    const ghControlPort = 9071 + (instanceId * 2);
    const protonSocksPort = 9180 + (instanceId * 2);
    const protonControlPort = 9181 + (instanceId * 2);

    while (true) {
        let browserGithub, torGithub;
        try {
            // 1. Start GitHub Tor and Browser
            torGithub = new TorManager(TOR_EXE, ghSocksPort, ghControlPort);
            let ghTorStarted = false;
            for (let t = 0; t < 3; t++) {
                try {
                    await torGithub.start();
                    ghTorStarted = true;
                    break;
                } catch (err) {
                    console.error(`[Instance ${instanceId}] GitHub Tor startup failed (attempt ${t + 1}): ${err.message}`);
                    torGithub.stop();
                    await sleep(5000);
                }
            }
            if (!ghTorStarted) throw new Error('GitHub Tor failed to start after 3 attempts');

            const uaGithub = getRandomUserAgent(true); // Force mobile for GitHub
            const ghProfileDir = path.join(os.tmpdir(), `gh-profile-${instanceId}-${Date.now()}`);
            console.log(`[Instance ${instanceId}] Launching GitHub browser...`);
            browserGithub = await puppeteer.launch({
                headless: false,
                executablePath: CHROME_EXE,
                args: [
                    '--no-sandbox',
                    `--proxy-server=socks5://127.0.0.1:${ghSocksPort}`,
                    `--user-data-dir=${ghProfileDir}`,
                    `--window-size=${uaGithub.viewport.width},${uaGithub.viewport.height}`
                ]
            });

            const ghPage = await browserGithub.newPage();
            await clearBrowserData(ghPage);
            await ghPage.close();

            const creds = {
                username: generateRealisticUsername(),
                email: generateRealisticUsername() + '@proton.me',
                password: generateRealisticUsername() + '@proton.me'
            };

            // 2. Start GitHub Signup
            const { githubPage } = await startGithubSignup(browserGithub, creds, uaGithub, torGithub);
            console.log(`[Instance ${instanceId}] GitHub reached code input. Transitioning to Proton...`);

            // 3. Proton Retry Loop
            let protonAttempt = 0;
            while (true) {
                protonAttempt++;
                console.log(`\n[Instance ${instanceId}] --- PROTON ATTEMPT #${protonAttempt} ---\n`);
                let browserProton, torProton;
                try {
                    torProton = new TorManager(TOR_EXE, protonSocksPort, protonControlPort);
                    let pTorStarted = false;
                    for (let t = 0; t < 3; t++) {
                        try {
                            await torProton.start();
                            pTorStarted = true;
                            break;
                        } catch (err) {
                            console.error(`[Instance ${instanceId}] Proton Tor startup failed (attempt ${t + 1}): ${err.message}`);
                            torProton.stop();
                            await sleep(5000);
                        }
                    }
                    if (!pTorStarted) throw new Error('Proton Tor failed to start after 3 attempts');

                    const uaProton = getRandomUserAgent(false, true); // Force Windows for Proton
                    uaProton.viewport = { width: 1280, height: 720, isMobile: false, hasTouch: false };

                    const protonProfileDir = path.join(os.tmpdir(), `proton-profile-${instanceId}-${Date.now()}`);
                    console.log(`[Instance ${instanceId}] Launching Proton browser...`);
                    browserProton = await puppeteer.launch({
                        headless: false,
                        executablePath: CHROME_EXE,
                        args: [
                            '--no-sandbox',
                            `--proxy-server=socks5://127.0.0.1:${protonSocksPort}`,
                            `--user-data-dir=${protonProfileDir}`,
                            '--window-size=1280,720'
                        ]
                    });

                    const pPage = await browserProton.newPage();
                    await clearBrowserData(pPage);
                    await pPage.close();

                    const { protonPage } = await createProtonAccount(browserProton, creds, await getTempMail(browserProton, uaProton), uaProton, torProton);

                    // 4. Finalize GitHub
                    await finishGithubSignup(githubPage, protonPage, creds);
                    console.log(`[Instance ${instanceId}] Process finished successfully!`);

                    // Cleanup
                    if (browserProton) await browserProton.close().catch(() => { });
                    if (torProton) torProton.stop();

                    console.log(`[Instance ${instanceId}] Waiting 10 seconds before next account...`);
                    await sleep(10000);
                    break;
                } catch (e) {
                    console.error(`[Instance ${instanceId}] Proton Attempt ${protonAttempt} failed:`, e.message);
                    if (browserProton) try { await browserProton.close(); } catch (err) { }
                    if (torProton) torProton.stop();

                    if (e.message === 'FATAL_GITHUB_ERROR') break;
                    await sleep(5000);
                }
            }
        } catch (e) {
            console.error(`[Instance ${instanceId}] GitHub Attempt failed:`, e.message);
            await sleep(5000);
        } finally {
            if (browserGithub) try { await browserGithub.close(); } catch (err) { }
            if (torGithub) torGithub.stop();
        }
    }
}

if (cluster.isMaster) {
    const numInstances = parseInt(process.argv[2]) || 1;
    console.log(`Master process starting ${numInstances} instances...`);

    const instanceMap = new Map();
    for (let i = 0; i < numInstances; i++) {
        const worker = cluster.fork({ INSTANCE_ID: i });
        instanceMap.set(worker.id, i);
    }

    cluster.on('exit', (worker, code, signal) => {
        const instanceId = instanceMap.get(worker.id);
        console.log(`Worker ${worker.process.pid} (Instance ${instanceId}) died. Restarting...`);
        instanceMap.delete(worker.id);

        const newWorker = cluster.fork({ INSTANCE_ID: instanceId });
        instanceMap.set(newWorker.id, instanceId);
    });
} else {
    main(parseInt(process.env.INSTANCE_ID));
}
