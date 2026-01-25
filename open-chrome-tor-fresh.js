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
  const linuxChromePaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  chromePath = linuxChromePaths.find(p => fs.existsSync(p));
  try {
    torPath = require('child_process').execSync('which tor').toString().trim();
  } catch (e) {
    torPath = '/usr/bin/tor';
  }
}


console.log('Using Chrome at:', chromePath || 'Not found');
console.log('Using Tor at:', torPath || 'Not found');

const TOR_EXEC_PATH = torPath || '';
let TOR_PROXY_PORT = null;
let TOR_CONTROL_PORT = null;

async function findFreePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      resolve(findFreePort(startPort + 1));
    });
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => {
        resolve(port);
      });
    });
  });
}


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
  if (!TOR_PROXY_PORT) TOR_PROXY_PORT = await findFreePort(9090 + Math.floor(Math.random() * 100));
  if (!TOR_CONTROL_PORT) TOR_CONTROL_PORT = await findFreePort(TOR_PROXY_PORT + 1);

  if (TOR_EXEC_PATH) {
    const dataDir = path.join(os.tmpdir(), 'tor-fresh-data-' + Math.floor(Math.random() * 1000000));
    fs.mkdirSync(dataDir, { recursive: true });
    const dummyTorrc = path.join(dataDir, 'dummy_torrc');
    fs.writeFileSync(dummyTorrc, '');

    console.log(`Starting fresh Tor instance on port ${TOR_PROXY_PORT}...`);
    try {
      const regions = [
        '{us},{ca}', // North America
        '{gb},{de},{fr},{nl},{se},{ch},{no},{dk},{at},{be},{fi},{ie}', // Europe
        '{au},{jp},{sg},{nz}', // Asia-Pacific
        '{it},{es},{pt},{gr}' // Southern Europe
      ];
      const selectedRegion = regions[Math.floor(Math.random() * regions.length)];
      console.log(`Region selected for Tor exit: ${selectedRegion}`);

      const args = [
        '-f', dummyTorrc,
        '--SocksPort', TOR_PROXY_PORT.toString(),
        '--ControlPort', TOR_CONTROL_PORT.toString(),
        '--DataDirectory', dataDir,
        '--ExitNodes', selectedRegion,
        '--StrictNodes', '1',
        '--ExcludeNodes', '{cn},{ru},{ir},{sy},{kp},{by},{ua},{kz},{uz}',
        '--MaxCircuitDirtiness', '15',
        '--CookieAuthentication', '0'
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
      process.exit(1);
    }
  } else {
    console.log('No tor executable configured; assuming a Tor SOCKS proxy is running');
  }

  // Wait for the Tor proxy with infinite retries
  let torReady = false;
  let attempt = 0;
  while (!torReady) {
    attempt++;
    console.log(`Waiting for Tor proxy on port ${TOR_PROXY_PORT} (Attempt ${attempt})...`);
    try {
      await waitForTorProxy(TOR_PROXY_PORT, 60000);
      torReady = true;
      console.log('Tor proxy is available on port', TOR_PROXY_PORT);
    } catch (e) {
      console.log(`Tor startup timeout on attempt ${attempt}. Retrying...`);
      // No need to stop/restart here as spawn unref'd it, but let's ensure we wait
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // Force a fresh identity immediately
  await renewTorCircuit(TOR_CONTROL_PORT);
}


function getRandomUserAgent() {
  const isMobile = Math.random() > 0.5;

  if (isMobile) {
    const mobileUAs = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.7559.77 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36'
    ];
    const mobileRes = [
      { width: 390, height: 844 },
      { width: 412, height: 915 },
      { width: 360, height: 800 },
      { width: 375, height: 812 }
    ];
    const res = mobileRes[Math.floor(Math.random() * mobileRes.length)];
    return {
      userAgent: mobileUAs[Math.floor(Math.random() * mobileUAs.length)],
      viewport: { width: res.width, height: res.height, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }
    };
  } else {
    const desktopUAs = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
    ];
    const desktopRes = [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1536, height: 864 },
      { width: 1366, height: 768 }
    ];
    const res = desktopRes[Math.floor(Math.random() * desktopRes.length)];
    return {
      userAgent: desktopUAs[Math.floor(Math.random() * desktopUAs.length)],
      viewport: { width: res.width, height: res.height, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
    };
  }
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
      '--no-sandbox',
      '--test-type',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certifcate-errors',
      '--ignore-certifcate-errors-spki-list',
      '--disable-background-networking',
      '--disable-client-side-phishing-detection',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-hang-monitor',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--enable-features=WebRtcHideLocalIpsWithMdns',
      `--user-data-dir=${profileDir}`,
    ],
    executablePath: chromePath,
    defaultViewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
  });

  // Advanced fingerprint spoofing + WebRTC blocking
  const spoofScript = `(() => {
    try {
      // 1. Basic properties
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'], configurable: true });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32', configurable: true });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0, configurable: true });

      // 2. WebRTC Blocking
      const noop = function() { throw new Error('WebRTC disabled'); };
      try { Object.defineProperty(window, 'RTCPeerConnection', { value: noop, configurable: true }); } catch (e) {}
      try { Object.defineProperty(window, 'mozRTCPeerConnection', { value: noop, configurable: true }); } catch (e) {}
      try { Object.defineProperty(window, 'webkitRTCPeerConnection', { value: noop, configurable: true }); } catch (e) {}

      // 3. Canvas Noise
      const originalGetImageData = HTMLCanvasElement.prototype.getContext('2d').getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function (x, y, width, height) {
          const imageData = originalGetImageData.apply(this, arguments);
          for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] = imageData.data[i] + (Math.random() > 0.5 ? 1 : -1);
          }
          return imageData;
      };

      // 4. Audio Noise
      const originalCreateOscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function() {
          const results = originalCreateOscillator.apply(this, arguments);
          const originalStart = results.start;
          results.start = function() {
              this.detune.value = this.detune.value + (Math.random() * 0.1);
              return originalStart.apply(this, arguments);
          };
          return results;
      };

      // 5. Plugin Simulation
      const plugins = [
          { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
      ];
      Object.defineProperty(navigator, 'plugins', { get: () => plugins, configurable: true });
      Object.defineProperty(navigator, 'mimeTypes', { get: () => ({ length: plugins.length }), configurable: true });

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
    await client.send('Emulation.setTimezoneOverride', { timezoneId: 'Europe/London' });
    await client.send('Emulation.setLocaleOverride', { locale: 'en-GB' });

    // Explicitly clear all browser data before starting
    await client.send('Network.clearBrowserCache');
    await client.send('Network.clearBrowserCookies');
    await client.send('Storage.clearDataForOrigin', { origin: '*', storageTypes: 'all' });
  } catch (e) { }

  await page.goto('https://check.torproject.org/', { waitUntil: 'networkidle2' });

  browser.on('disconnected', async () => {
    // 3s delay to ensure Chrome has fully released all file handles
    await new Promise(r => setTimeout(r, 3000));

    let deleted = false;
    let attempts = 0;
    while (!deleted && attempts < 3) {
      attempts++;
      if (!fs.existsSync(profileDir)) {
        deleted = true;
        break;
      }
      try {
        fs.rmSync(profileDir, { recursive: true, force: true });
        console.log(`✓ Successfully removed temp profile: ${profileDir}`);
        deleted = true;
      } catch (e) {
        console.log(`Attempt ${attempts}: Failed to remove profile dir (${e.message}). Retrying...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    if (!deleted) console.error(`CRITICAL: Failed to remove temp profile: ${profileDir}`);
  });

})();
