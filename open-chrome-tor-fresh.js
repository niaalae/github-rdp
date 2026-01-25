// open-chrome-tor-fresh.js

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Cross-platform Chrome and Tor path detection
let chromePath, torPath;
if (os.platform() === 'win32') {
  const winChromePaths = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
  ];
  chromePath = winChromePaths.find(p => fs.existsSync(p));
  torPath = 'C:/Users/Administrator/Desktop/Tor Browser/Browser/TorBrowser/Tor/tor.exe';
} else {
  chromePath = '/usr/bin/google-chrome';
  torPath = '/usr/bin/tor';
}

console.log('Using Chrome at:', chromePath || 'Not found');
console.log('Using Tor at:', torPath || 'Not found');

const TOR_EXEC_PATH = torPath || '';
const TOR_PROXY_PORT = 9052; // Use a dedicated port for this "fresh" script
const TOR_CONTROL_PORT = 9053;

function waitForTorProxy(port, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      const socket = net.createConnection(port, '127.0.0.1');
      socket.on('connect', () => {
        socket.end();
        resolve();
      });
      socket.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error('Timed out waiting for Tor proxy on port ' + port));
        } else {
          setTimeout(check, 1000);
        }
      });
    }
    check();
  });
}

async function renewTorCircuit(controlPort) {
  console.log('Requesting new Tor circuit (NEWNYM)...');
  return new Promise((resolve) => {
    const client = net.createConnection({ port: controlPort }, () => {
      client.write('AUTHENTICATE ""\r\n');
      client.write('SIGNAL NEWNYM\r\n');
      client.write('QUIT\r\n');
    });
    client.on('data', (data) => {
      if (data.toString().includes('250 OK')) {
        console.log('✓ Tor circuit renewed successfully!');
      }
    });
    client.on('end', resolve);
    client.on('error', (err) => {
      console.log('Tor control error:', err.message);
      resolve();
    });
    setTimeout(resolve, 5000);
  });
}

async function launchTorProxy() {
  if (TOR_EXEC_PATH) {
    const dataDir = path.join(os.tmpdir(), 'tor-fresh-data-' + Date.now());
    fs.mkdirSync(dataDir, { recursive: true });

    console.log('Starting fresh Tor instance with high-quality nodes...');
    try {
      const args = [
        '--SocksPort', TOR_PROXY_PORT.toString(),
        '--ControlPort', TOR_CONTROL_PORT.toString(),
        '--DataDirectory', dataDir,
        '--ExitNodes', '{us},{gb},{de},{fr},{ca},{au},{jp},{sg},{nl},{se},{ch},{no},{dk},{at},{be},{fi},{ie},{nz},{it},{es}',
        '--StrictNodes', '1',
        '--ExcludeNodes', '{cn},{ru},{ir},{sy},{kp},{by},{ua},{kz},{uz}',
        '--MaxCircuitDirtiness', '180', // Rotate IP every 3 minutes if persistent
      ];

      const torProc = spawn(TOR_EXEC_PATH, args, {
        detached: true,
        stdio: 'ignore',
      });
      torProc.unref();

      // Auto-cleanup data dir on exit
      process.on('exit', () => {
        try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) { }
      });
    } catch (e) {
      console.log('Failed to spawn tor daemon:', e.message);
    }
  } else {
    console.log('No tor executable configured; assuming a Tor SOCKS proxy is running');
  }

  // Wait for the Tor proxy to be available
  await waitForTorProxy(TOR_PROXY_PORT);
  console.log('Tor proxy is available on port', TOR_PROXY_PORT);

  // Force a fresh identity immediately
  await renewTorCircuit(TOR_CONTROL_PORT);
}

function getRandomUserAgent() {
  const mobileUAs = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.7559.77 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro Build/UQ1A.231205.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.210 Mobile Safari/537.36'
  ];

  const mobileResolutions = [
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 360, height: 800 },
    { width: 375, height: 812 },
    { width: 393, height: 852 }
  ];

  const userAgent = mobileUAs[Math.floor(Math.random() * mobileUAs.length)];
  const res = mobileResolutions[Math.floor(Math.random() * mobileResolutions.length)];
  const width = res.width + Math.floor(Math.random() * 20) - 10;
  const height = res.height + Math.floor(Math.random() * 40) - 20;

  return {
    userAgent,
    viewport: { width, height, isMobile: true, hasTouch: true, deviceScaleFactor: (Math.random() > 0.5 ? 2 : 3) }
  };
}

(async () => {
  // Ensure a Tor SOCKS proxy is available
  await launchTorProxy();

  const { userAgent, viewport } = getRandomUserAgent();
  console.log('Selected User-Agent:', userAgent);
  console.log('Selected Viewport:', viewport.width, 'x', viewport.height);

  // Per-run temporary Chrome profile directory to ensure clean cookies/cache
  const profileDir = path.join(os.tmpdir(), 'puppeteer-tor-profile-' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--proxy-server=socks5://127.0.0.1:${TOR_PROXY_PORT}`,
      `--window-size=${viewport.width},${viewport.height}`,
      '--enable-features=WebRtcHideLocalIpsWithMdns',
      '--disable-background-networking',
      '--disable-client-side-phishing-detection',
      '--disable-sync',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-extensions',
      '--disable-blink-features=AutomationControlled',
      '--incognito',
      `--user-data-dir=${profileDir}`,
      '--disable-dev-shm-usage',
    ],
    executablePath: chromePath,
    defaultViewport: null,
  });

  // Stronger fingerprint spoofing + WebRTC blocking script injected on every document
  const spoofScript = `(() => {
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'], configurable: true });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5, configurable: true });
      
      const noop = function() { throw new Error('WebRTC disabled'); };
      try { Object.defineProperty(window, 'RTCPeerConnection', { value: noop, configurable: true }); } catch (e) {}
      
      const toDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function() {
        return toDataURL.apply(this, arguments);
      };
    } catch (e) {}
  })();`;

  browser.on('targetcreated', async (target) => {
    try {
      const page = await target.page();
      if (page) {
        await page.setViewport(viewport);
        await page.evaluateOnNewDocument(spoofScript);
      }
    } catch (e) { }
  });

  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.setUserAgent(userAgent);
  await page.evaluateOnNewDocument(spoofScript);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  try {
    const client = await page.target().createCDPSession();
    await client.send('Emulation.setTimezoneOverride', { timezoneId: 'Europe/Helsinki' });
  } catch (e) { }

  await page.goto('https://check.torproject.org/', { waitUntil: 'networkidle2' });

  browser.on('disconnected', () => {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
      console.log('Removed temp profile:', profileDir);
    } catch (e) {
      console.log('Failed to remove temp profile:', profileDir, e.message);
    }
  });

})();
