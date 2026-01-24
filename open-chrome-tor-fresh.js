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
const TOR_PROXY_PORT = 9150;


function waitForTorProxy(port, timeoutMs = 60000) {
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

async function launchTorProxy() {
  if (TOR_EXEC_PATH) {
    console.log('Starting tor daemon from', TOR_EXEC_PATH);
    try {
      const torProc = spawn(TOR_EXEC_PATH, [], {
        detached: true,
        stdio: 'ignore',
      });
      torProc.unref();
    } catch (e) {
      console.log('Failed to spawn tor daemon:', e.message);
    }
  } else {
    console.log('No tor executable configured; assuming a Tor SOCKS proxy is running');
  }
  // Wait for the Tor proxy to be available
  await waitForTorProxy(TOR_PROXY_PORT);
  console.log('Tor proxy is available on port', TOR_PROXY_PORT);
}

(async () => {
  // Ensure a Tor SOCKS proxy is available (we won't launch Tor Browser)
  await launchTorProxy();

  // Per-run temporary Chrome profile directory to ensure clean cookies/cache
  const profileDir = path.join(os.tmpdir(), 'puppeteer-tor-profile-' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--proxy-server=socks5://127.0.0.1:${TOR_PROXY_PORT}`,
      // Hide local IPs exposed by WebRTC (enable mDNS obfuscation)
      '--enable-features=WebRtcHideLocalIpsWithMdns',
      // Extra hardening flags to minimize background network/DNS leaks
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
      // navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });

      // Languages
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'], configurable: true });

      // Platform
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32', configurable: true });

      // hardwareConcurrency
      try { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4, configurable: true }); } catch (e) {}

      // deviceMemory
      try { Object.defineProperty(navigator, 'deviceMemory', { get: () => 4, configurable: true }); } catch (e) {}

      // plugins (fake a few plugin entries)
      try {
        const fakePlugins = [{ name: 'Chrome PDF Plugin' }, { name: 'Chrome PDF Viewer' }, { name: 'Native Client' }];
        Object.defineProperty(navigator, 'plugins', { get: () => fakePlugins, configurable: true });
      } catch (e) {}

      // Spoof permissions for camera/microphone/geolocation
      if (navigator.permissions && navigator.permissions.query) {
        const origQuery = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = (params) => {
          if (params && (params.name === 'camera' || params.name === 'microphone' || params.name === 'geolocation')) {
            return Promise.resolve({ state: 'denied', onchange: null });
          }
          return origQuery(params);
        };
      }

      // Disable getUserMedia and tamper with RTCPeerConnection to avoid IP leaks
      const noop = function() { throw new Error('WebRTC disabled'); };
      try { Object.defineProperty(window, 'RTCPeerConnection', { value: noop, configurable: true }); } catch (e) {}
      try { Object.defineProperty(window, 'webkitRTCPeerConnection', { value: noop, configurable: true }); } catch (e) {}
      if (navigator && navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('getUserMedia disabled'));

      // Canvas fingerprint noise: add tiny random pixel to canvas outputs
      const toDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function() {
        try {
          const ctx = this.getContext('2d');
          if (ctx) {
            const w = this.width, h = this.height;
            // draw a single transparent pixel with tiny noise
            ctx.fillStyle = 'rgba(0,0,0,0)';
            ctx.fillRect(0,0,1,1);
            ctx.globalCompositeOperation = 'difference';
            ctx.fillStyle = 'rgba(' + Math.floor(Math.random()*10) + ',0,0,0)';
            ctx.fillRect(w-1, h-1, 1, 1);
            ctx.globalCompositeOperation = 'source-over';
          }
        } catch (e) {}
        return toDataURL.apply(this, arguments);
      };

      // WebGL vendor/renderer spoof (best-effort)
      try {
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) return 'Intel Inc.'; // VENDOR
          if (parameter === 37446) return 'Intel Iris OpenGL Engine'; // RENDERER
          return getParameter.apply(this, arguments);
        };
      } catch (e) {}
    } catch (e) {}
  })();`;

  // Apply spoof script to any newly created page
  browser.on('targetcreated', async (target) => {
    try {
      const page = await target.page();
      if (page) await page.evaluateOnNewDocument(spoofScript);
    } catch (e) { }
  });

  // Open the first page and set UA / headers / timezone
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(spoofScript);
  // Set a common Chrome User-Agent (customize if needed)
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.90 Safari/537.36';
  await page.setUserAgent(ua);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  // Set timezone to a stable value (change as needed)
  try {
    const client = await page.target().createCDPSession();
    await client.send('Emulation.setTimezoneOverride', { timezoneId: 'Europe/Helsinki' });
  } catch (e) { }

  await page.goto('https://check.torproject.org/', { waitUntil: 'networkidle2' });
  // Browser will remain open for manual use. When the browser is closed, remove the temp profile.
  browser.on('disconnected', () => {
    try {
      // Best-effort remove profile directory
      fs.rmSync(profileDir, { recursive: true, force: true });
      console.log('Removed temp profile:', profileDir);
    } catch (e) {
      console.log('Failed to remove temp profile:', profileDir, e.message);
    }
  });

  // Optionally, close and clean after some time (uncomment if desired)
  // setTimeout(async () => { await browser.close(); }, 5*60*1000);

})();
