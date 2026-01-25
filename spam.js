// signup_single_direct.js
// FLOW: GitHub -> DuckSpam -> Get Code -> Complete GitHub
// DIRECT CONNECTION VERSION: No Proxy + No Tor + Human Noise

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const net = require('net');
const os = require('os');
const got = require('got');
const { uploadToDropbox } = require('./dropbox_utils');

// Load .env if exists
function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                process.env[key.trim()] = value.trim();
            }
        });
    }
}
loadEnv();

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

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

function getRandomUserAgent(forceMobile = true) {
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
        { width: 390, height: 844 },   // iPhone 14 Pro
        { width: 430, height: 932 },   // iPhone 14 Pro Max
        { width: 412, height: 915 },   // Pixel 7/8
        { width: 360, height: 800 },   // Common Android
        { width: 375, height: 812 },   // iPhone X/11
        { width: 414, height: 896 },   // iPhone XR/11
        { width: 393, height: 852 },   // iPhone 15
        { width: 428, height: 926 },   // iPhone 13 Pro Max
        { width: 360, height: 780 },   // Small Android
        { width: 1080, height: 2400, scale: 0.4 } // High-res Android (scaled)
    ];

    const userAgent = mobileUAs[Math.floor(Math.random() * mobileUAs.length)];
    const res = mobileResolutions[Math.floor(Math.random() * mobileResolutions.length)];

    // Add jitter to resolution
    const width = res.width + Math.floor(Math.random() * 20) - 10;
    const height = res.height + Math.floor(Math.random() * 40) - 20;

    const viewport = {
        width: width,
        height: height,
        deviceScaleFactor: res.scale || (Math.random() > 0.5 ? 2 : 3),
        isMobile: true,
        hasTouch: true,
        isLandscape: false
    };

    return { userAgent, isMobile: true, viewport };
}

async function randomNoise(page) {
    try {
        const { width, height } = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));

        // 1. Mouse movements (more steps, more variation, circular paths)
        for (let i = 0; i < 20 + Math.floor(Math.random() * 15); i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);

            if (Math.random() > 0.7) {
                // Circular/Spiral movement
                const centerX = x;
                const centerY = y;
                const radius = 20 + Math.random() * 50;
                for (let angle = 0; angle < Math.PI * 2; angle += 0.5) {
                    const curX = centerX + Math.cos(angle) * radius;
                    const curY = centerY + Math.sin(angle) * radius;
                    await page.mouse.move(curX, curY, { steps: 5 });
                }
            } else {
                await page.mouse.move(x, y, { steps: 40 + Math.floor(Math.random() * 40) });
            }

            // Occasional pause
            if (Math.random() > 0.7) await sleep(300 + Math.random() * 1200);

            // Occasional wiggle
            if (Math.random() > 0.85) {
                for (let j = 0; j < 5; j++) {
                    await page.mouse.move(x + (Math.random() - 0.5) * 15, y + (Math.random() - 0.5) * 15, { steps: 3 });
                }
            }
        }

        // 2. Random scrolling (more frequent, varied amounts, occasional rapid scroll)
        for (let i = 0; i < 12 + Math.floor(Math.random() * 10); i++) {
            const scrollAmount = (Math.random() - 0.5) * 2000;
            const behavior = Math.random() > 0.2 ? 'smooth' : 'auto';
            await page.evaluate((amt, beh) => window.scrollBy({ top: amt, behavior: beh }), scrollAmount, behavior);
            await sleep(400 + Math.random() * 1000);
        }

        // 3. Occasional random click on non-button area
        if (Math.random() > 0.5) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            await page.mouse.click(x, y);
            await sleep(300 + Math.random() * 500);
        }

        // 4. Random hover over elements with longer pauses
        if (Math.random() > 0.4) {
            const elements = await page.$$('a, button, span, div, p, h1, h2');
            if (elements.length > 0) {
                const randomEl = elements[Math.floor(Math.random() * Math.min(elements.length, 30))];
                try {
                    const box = await randomEl.boundingBox();
                    if (box) {
                        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
                        await sleep(400 + Math.random() * 1000);

                        // Occasional text selection simulation
                        if (Math.random() > 0.8) {
                            await page.mouse.down();
                            await page.mouse.move(box.x + box.width, box.y + box.height, { steps: 10 });
                            await page.mouse.up();
                            await sleep(500);
                            await page.mouse.click(0, 0); // Deselect
                        }
                    }
                } catch (e) { }
            }
        }

        // 5. Random window focus/blur simulation (via mouse move out and in)
        if (Math.random() > 0.8) {
            await page.mouse.move(0, 0, { steps: 20 });
            await sleep(1000 + Math.random() * 2000);
            await page.mouse.move(width / 2, height / 2, { steps: 20 });
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

            // Randomly "mistype" and correct (2% chance)
            if (Math.random() < 0.02) {
                const chars = 'abcdefghijklmnopqrstuvwxyz';
                const wrongChar = chars[Math.floor(Math.random() * chars.length)];
                await page.keyboard.type(wrongChar, { delay: 50 + Math.random() * 50 });
                await sleep(100 + Math.random() * 200);
                await page.keyboard.press('Backspace');
                await sleep(100 + Math.random() * 200);
            }

            // Randomly delete and re-type (1% chance after 3 chars)
            if (i > 3 && Math.random() < 0.01) {
                const delCount = Math.floor(Math.random() * 3) + 1;
                console.log(`[humanType] Simulating "oops" - deleting ${delCount} chars...`);
                for (let d = 0; d < delCount; d++) {
                    await page.keyboard.press('Backspace');
                    await sleep(50 + Math.random() * 50);
                }
                await sleep(300 + Math.random() * 500);
                const toRetype = text.substring(i - delCount, i);
                for (const rc of toRetype) {
                    await page.keyboard.type(rc, { delay: 50 + Math.random() * 50 });
                }
            }

            await page.keyboard.type(char, { delay: 50 + Math.random() * 100 });
            if (Math.random() > 0.95) await sleep(500 + Math.random() * 1000);
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

async function setupDuckSpam(browser, username, userAgent) {
    console.log('\n========== STEP 2: Setting up DuckSpam Mailbox ==========');
    const page = await browser.newPage();
    await applyAdvancedStealth(page, userAgent);
    try {
        console.log('Navigating to duckspam.com...');
        await page.goto('https://duckspam.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(3000);

        // Wait for username input
        console.log('Waiting for mailbox name input...');
        await page.waitForSelector('input#mailboxName', { timeout: 30000 });

        // Type the username
        console.log(`Entering username: ${username}`);
        await humanType(page, 'input#mailboxName', username);
        await sleep(1000);

        // Click the submit button
        console.log('Clicking submit button...');
        const submitBtn = await page.$('button.btn.btn-lg.btn-primary');
        if (submitBtn) {
            await humanClick(page, submitBtn);
        } else {
            // Fallback: press Enter
            await page.keyboard.press('Enter');
        }

        // Wait for page to reload/navigate
        console.log('Waiting for mailbox to load...');
        await sleep(5000);
        await page.waitForSelector('.mailbox-list', { timeout: 30000 }).catch(() => { });

        const email = `${username}@duckspam.com`;
        console.log(`DuckSpam mailbox set up: ${email}`);
        return { page, email };
    } catch (e) {
        console.error('Failed to set up DuckSpam mailbox:', e.message);
        await page.close();
        throw new Error('RESTART_NEEDED: DuckSpam setup failed');
    }
}

async function fetchGithubCodeFromDuckSpam(duckSpamPage, githubPage) {
    console.log('Waiting for GitHub code in DuckSpam...');
    const maxAttempts = 30;
    let resendCount = 0;
    const maxResends = 5;

    for (let i = 0; i < maxAttempts; i++) {
        await duckSpamPage.bringToFront();
        await sleep(3000);

        // Check if there's an email in the mail list
        const emailFound = await duckSpamPage.evaluate(() => {
            // Look for any email items in the mail list
            const mailItems = document.querySelectorAll('.col-xs-12.mail-list a, .mail-list .mail-item, .mailbox-list .list-group-item');
            for (const item of mailItems) {
                const text = item.innerText || item.textContent || '';
                if (text.toLowerCase().includes('github') || text.toLowerCase().includes('launch code') || text.toLowerCase().includes('verification')) {
                    item.click();
                    return true;
                }
            }
            // Also check for any clickable email rows
            const allLinks = document.querySelectorAll('.mailbox-list a, .mail-list a');
            for (const link of allLinks) {
                const text = link.innerText || '';
                if (text.toLowerCase().includes('github')) {
                    link.click();
                    return true;
                }
            }
            return false;
        });

        if (emailFound) {
            console.log('Found GitHub email! Clicking on it...');
            await sleep(5000); // Wait for email to open

            // Wait for iframe and get content
            console.log('Waiting for email content iframe...');
            let frame = null;
            try {
                const iframeElement = await duckSpamPage.waitForSelector('iframe', { timeout: 10000 });
                frame = await iframeElement.contentFrame();
            } catch (e) {
                console.log('Iframe not found or accessible, trying main page content fallback...');
                frame = duckSpamPage;
            }

            if (frame) {
                // Extract the 8-digit code
                const launchCode = await frame.evaluate(() => {
                    const allText = document.body.innerText || '';
                    // Look for 8-digit code
                    const matches = allText.match(/\b(\d{8})\b/g);
                    if (matches && matches.length > 0) return matches[0];
                    return null;
                });

                if (launchCode) {
                    console.log('Found launch code:', launchCode);
                    return launchCode;
                } else {
                    console.log('Email found but no 8-digit code detected in frame. Continuing to wait...');
                }
            }
        }

        // Check if inbox is empty
        const isEmpty = await duckSpamPage.evaluate(() => {
            const emptyBox = document.querySelector('.empty-box .alert-warning, .col-xs-12.empty-box');
            return !!emptyBox;
        });

        if (isEmpty && i > 0 && i % 5 === 0 && resendCount < maxResends) {
            // Click resend on GitHub tab
            console.log('Inbox empty. Clicking resend on GitHub...');
            await githubPage.bringToFront();

            const resendBtn = await githubPage.evaluateHandle(() => {
                return Array.from(document.querySelectorAll('button, a')).find(b => b.innerText.toLowerCase().includes('resend'));
            });

            if (resendBtn && resendBtn.asElement()) {
                await humanClick(githubPage, resendBtn.asElement());
                console.log('Clicked resend button on GitHub.');
                resendCount++;
                await sleep(3000);
            }

            await duckSpamPage.bringToFront();
        }

        // Click refresh button on DuckSpam
        console.log(`Clicking refresh on DuckSpam... (attempt ${i + 1}/${maxAttempts})`);
        const refreshed = await duckSpamPage.evaluate(() => {
            const refreshBtn = document.querySelector('.action-bar.text-right a.btn.btn-primary');
            if (refreshBtn && refreshBtn.innerText.toLowerCase().includes('refresh')) {
                refreshBtn.click();
                return true;
            }
            // Fallback: look for any refresh button
            const allBtns = Array.from(document.querySelectorAll('a.btn, button.btn'));
            const btn = allBtns.find(b => b.innerText.toLowerCase().includes('refresh'));
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });

        if (!refreshed) {
            // Manual reload as fallback
            await duckSpamPage.reload({ waitUntil: 'domcontentloaded' }).catch(() => { });
        }

        await sleep(5000);
    }

    return null;
}

function generateRealisticUsername() {
    const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Lisa', 'Matthew', 'Nancy', 'Anthony', 'Betty', 'Mark', 'Sandra', 'Donald', 'Margaret', 'Steven', 'Ashley', 'Paul', 'Kimberly', 'Andrew', 'Emily', 'Joshua', 'Donna', 'Kenneth', 'Michelle', 'Kevin', 'Dorothy', 'Brian', 'Carol', 'George', 'Amanda', 'Timothy', 'Melissa', 'Ronald', 'Deborah'];
    const middleNames = ['Grace', 'Rose', 'James', 'Lee', 'Marie', 'Ann', 'Lynn', 'Jean', 'Nicole', 'Michelle', 'Renee', 'Dawn', 'Faith', 'Hope', 'Joy', 'Noel', 'Paul', 'Alan', 'Scott', 'Wayne', 'Dale', 'Dean', 'Ray', 'Jay', 'Roy', 'Guy', 'Mark', 'Carl', 'Earl', 'Bert', 'Kurt', 'Kent', 'Brent', 'Grant', 'Trent', 'Blair', 'Blake', 'Brooks', 'Chase', 'Cole', 'Finn', 'Gage', 'Hayes', 'Jace', 'Jude', 'Kane', 'Lane', 'Nash', 'Quinn', 'Reid'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'];

    // Pick 3 random words from the lists
    const lists = [firstNames, middleNames, lastNames];
    let username = '';
    for (let i = 0; i < 3; i++) {
        const list = lists[Math.floor(Math.random() * lists.length)];
        username += list[Math.floor(Math.random() * list.length)];
    }
    return username;
}

async function completeProtonOnboarding(protonPage, creds) {
    console.log('\n========== STEP 3: Completing Proton Onboarding ==========');
    await protonPage.bringToFront();
    try {
        // 1. Recovery Warning
        console.log('Waiting for recovery warning checkbox...');
        let recoveryHandled = false;
        for (let i = 0; i < 15; i++) {
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

        await randomNoise(protonPage);

        // 2. Display Name
        await sleep(3000);
        console.log('Waiting for display name input...');
        const displayNameSelector = 'input#displayName';
        try {
            await protonPage.waitForSelector(displayNameSelector, { timeout: 20000 });
            const displayNameInput = await protonPage.$(displayNameSelector);
            await humanType(protonPage, displayNameInput, Math.random().toString(36).substring(2, 10));
            await sleep(1000);
            await humanClick(protonPage, 'button[type="submit"]');
            console.log('Submitted display name.');
        } catch (e) {
            console.log('Display name input not found. Restarting Proton part...');
            throw new Error('RESTART_NEEDED');
        }

        await randomNoise(protonPage);

        // 3. Explore Mail
        await sleep(5000);
        console.log('Waiting for Explore Mail button...');
        let exploreHandled = false;
        for (let i = 0; i < 10; i++) {
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

        await randomNoise(protonPage);

        // 4. Choose my own username
        console.log('Checking for "Create your own" username selection...');
        const usernameInputSelector = 'input#username';

        let usernameFound = false;
        for (let i = 0; i < 15; i++) {
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

        await randomNoise(protonPage);

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
            await protonPage.waitForSelector(claimBtnSelector, { timeout: 20000 });

            const startTime = Date.now();
            let claimed = false;
            while (Date.now() - startTime < 60000) {
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
                                    continue;
                                }
                            }
                        }

                        if (buttonState.isVisible && !buttonState.isDisabled) {
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
                } catch (loopErr) {
                    console.log(`Warning: Interaction error during claim (might be navigating): ${loopErr.message}`);
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

            while (Date.now() - stepStartTime < 30000) { // 30 second timeout per button
                try {
                    const btnInfo = await protonPage.evaluate(({ selector, text }) => {
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
                        return { found: false };
                    }, { selector, text });

                    if (btnInfo.found) {
                        const btn = await protonPage.evaluateHandle(({ selector, text }) => {
                            return Array.from(document.querySelectorAll(selector)).find(b => {
                                const style = window.getComputedStyle(b);
                                const visible = style && style.display !== 'none' && style.visibility !== 'hidden' && b.offsetParent !== null;
                                return visible && b.innerText.toLowerCase().includes(text.toLowerCase());
                            });
                        }, { selector, text });

                        if (btn && btn.asElement()) {
                            console.log(`Clicking onboarding button: '${text}' (actual: '${btnInfo.btnText}')`);
                            await humanClick(protonPage, btn.asElement());
                            await sleep(3000);
                            stepClicked = true;
                            break;
                        }
                    }
                } catch (err) {
                    console.log(`Error during onboarding step '${text}':`, err.message);
                }
                await sleep(1500);
            }
            if (!stepClicked) console.log(`Step '${text}': Button not found or timeout reached, moving to next.`);
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

async function createProtonAccount(browser, creds, tempMailObj, userAgent) {
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
    await randomNoise(protonPage);
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

        console.log('Clicked Verify button. Checking for transition and errors...');
        await sleep(10000);

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
        });

        if (errorStatus.abusiveTraffic || errorStatus.redError) {
            console.log(`Error detected (Abusive: ${errorStatus.abusiveTraffic}, Red: ${errorStatus.redError})! Restarting attempt...`);
            throw new Error('RESTART_NEEDED');
        }

        // Check if we are still on the verification screen
        const stillOnVerify = await vFrame.$(verificationInput);
        if (stillOnVerify) {
            console.log('Still on verification screen after 10s. Restarting Proton...');
            throw new Error('RESTART_NEEDED');
        }

        await sleep(5000);
        await completeProtonOnboarding(protonPage, creds);
        return { protonPage };
    }
    throw new Error('RESTART_NEEDED: Proton verification failed');
}

async function startGithubSignup(browser, creds, userAgent) {
    console.log('\n========== STEP 1: Starting GitHub Signup ==========');
    const githubPage = await browser.newPage();
    await applyAdvancedStealth(githubPage, userAgent);
    console.log('Navigating to GitHub signup...');
    await githubPage.goto('https://github.com/signup', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(5000);

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
    await sleep(2000);

    const tasks = [
        { name: 'email', selector: 'input#email', value: creds.email, continueBtn: 'button[data-continue-to="password-container"]' },
        { name: 'password', selector: 'input#password', value: creds.password, continueBtn: 'button[data-continue-to="username-container"]' },
        { name: 'username', selector: 'input#login', value: creds.username, continueBtn: 'button[data-continue-to="opt-in-container"]' }
    ].sort(() => Math.random() - 0.5);
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
        await sleep(1000 + Math.random() * 1000);

        if (task.continueBtn) {
            console.log(`Clicking continue for ${task.name}...`);
            await githubPage.waitForSelector(task.continueBtn, { visible: true, timeout: 5000 }).catch(() => { });
            const btn = await githubPage.$(task.continueBtn);
            if (btn) {
                await humanClick(githubPage, btn);
                await sleep(2000 + Math.random() * 1000);
            }
        }
    }
    const marketingConsent = await githubPage.$('input[id="user_signup[marketing_consent]"]');
    if (marketingConsent) await humanClick(githubPage, marketingConsent);
    const finalContinue = await githubPage.$('button[data-continue-to="captcha-and-submit-container"]');
    if (finalContinue) await humanClick(githubPage, finalContinue);

    await sleep(3000);
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
                    await sleep(3000);
                }
            }

            console.log('No CAPTCHA or Success yet. Waiting 5 seconds...');
            await sleep(5000);
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

async function finishGithubSignup(githubPage, duckSpamPage, creds) {
    console.log('\n========== STEP 3: Finishing GitHub Signup ==========');

    // Get the code from DuckSpam
    const launchCode = await fetchGithubCodeFromDuckSpam(duckSpamPage, githubPage);

    if (!launchCode) throw new Error('Could not find GitHub launch code in DuckSpam inbox.');

    // Enter code on GitHub
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

    // Handle post-code navigation
    const currentUrl = githubPage.url();
    if (!currentUrl.includes('login') && !currentUrl.includes('codespaces')) {
        const verifyBtn = await githubPage.$('button.Primer_Brand__Button-module__Button___lDruK');
        if (verifyBtn) await humanClick(githubPage, verifyBtn);
    }

    await sleep(5000);
    const token = await generateGithubToken(githubPage, creds);
    if (token) {
        saveTokenToJson(creds.username, token);
        return true;
    }
    return false;
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

            // 2. Check for token first (in case previous attempt worked)
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

                // Ensure checkboxes are checked and focus on one
                await page.evaluate(() => {
                    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"][name="oauth_access[scopes][]"]'));
                    if (checkboxes.length > 0) {
                        const target = checkboxes[Math.floor(Math.random() * checkboxes.length)];
                        target.focus();
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Visual cue
                        target.style.outline = "5px solid blue";
                    }
                });
                await sleep(1000);
                await page.keyboard.press('Enter');
                console.log('Pressed Enter on checkbox.');

                clickedAtLeastOnce = true;
                await sleep(3000); // Wait for navigation/reload

                // Fallback: Try clicking the button if Enter didn't work
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
                    const el = document.querySelector('code#new-oauth-token');
                    if (el && el.innerText.trim().startsWith('gh')) return el.innerText.trim();
                    const codes = Array.from(document.querySelectorAll('code'));
                    for (const c of codes) {
                        const txt = c.innerText.trim();
                        if (txt.startsWith('ghp_') || txt.startsWith('gho_') || txt.startsWith('ghu_') || txt.startsWith('ghs_') || txt.startsWith('ghr_')) return txt;
                    }
                    const match = document.body.innerText.match(/(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|ghu_[a-zA-Z0-9]{36}|ghs_[a-zA-Z0-9]{36}|ghr_[a-zA-Z0-9]{36})/);
                    return match ? match[0] : null;
                });
                if (token) break;
            } catch (e) { }
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

function saveJsonToLocalAndDropbox(filePath, obj) {
    let finalData = obj;
    if (path.basename(filePath) === 'github_tokens.json' && !Array.isArray(obj)) {
        let tokens = [];
        if (fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath, 'utf8');
                const parsed = JSON.parse(data);
                tokens = Array.isArray(parsed) ? parsed : [];
            } catch (e) { tokens = []; }
        }
        tokens.push(obj);
        finalData = tokens;
    }

    try {
        fs.writeFileSync(filePath, JSON.stringify(finalData, null, 4));
        console.log(`Saved ${filePath}`);
    } catch (e) {
        console.error(`Failed to save ${filePath}:`, e.message);
    }

    const dbxToken = process.env.DROPBOX_DIR || process.env.DROPBOX_ACCESS_TOKEN || process.env.DROPBOX_TOKEN || process.env.DROPBOX_REFRESH_TOKEN;
    if (dbxToken) {
        const dropPath = (process.env.DROPBOX_DIR || '') + '/' + path.basename(filePath);
        uploadToDropbox(dropPath, Buffer.from(JSON.stringify(finalData, null, 4)))
            .then(() => console.log(`✓ Uploaded ${dropPath} to Dropbox`))
            .catch(err => console.error('Dropbox upload error:', err.message));
    }
}

function saveTokenToJson(username, token) {
    const filePath = path.join(__dirname, 'github_tokens.json');
    let tokens = [];
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(data);
            tokens = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            tokens = [];
        }
    }
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

function getChromeExecutablePath() {
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
        return process.env.CHROME_PATH;
    }

    const platform = os.platform();
    let paths = [];

    if (platform === 'win32') {
        paths = [
            'C:/Program Files/Google/Chrome/Application/chrome.exe',
            'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
            path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe')
        ];
    } else if (platform === 'darwin') {
        paths = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
    } else {
        paths = ['/usr/bin/google-chrome', '/usr/bin/chromium-browser'];
    }

    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

async function main() {
    console.log('Main function started...');
    // Detect Chrome path
    const chromePath = getChromeExecutablePath();
    if (!chromePath) {
        console.error('Chrome executable not found! Please set CHROME_PATH env var or install Chrome.');
        process.exit(1);
    }

    while (true) {
        let browserGithub;
        try {
            const uaGithub = getRandomUserAgent(true);
            const ghProfileDir = path.join(os.tmpdir(), `gh-profile-${Date.now()}`);
            console.log(`Launching GitHub browser... Path: ${chromePath}`);
            browserGithub = await puppeteer.launch({
                headless: false,
                executablePath: chromePath,
                args: [
                    '--no-sandbox',
                    `--user-data-dir=${ghProfileDir}`,
                    `--window-size=${uaGithub.viewport.width},${uaGithub.viewport.height}`
                ]
            });

            const ghPage = await browserGithub.newPage();
            await clearBrowserData(ghPage);
            await ghPage.close();

            const username = generateRealisticUsername();
            const creds = {
                username: username,
                email: username + '@duckspam.com',
                password: generateRealisticUsername() + '@duckspam.com'
            };

            const { githubPage } = await startGithubSignup(browserGithub, creds, uaGithub);

            // Set up DuckSpam mailbox and get the code
            let duckSpamAttempt = 0;
            while (true) {
                duckSpamAttempt++;
                console.log(`\n--- DUCKSPAM ATTEMPT #${duckSpamAttempt} ---\n`);
                try {
                    const { page: duckSpamPage } = await setupDuckSpam(browserGithub, username, uaGithub);
                    const success = await finishGithubSignup(githubPage, duckSpamPage, creds);

                    // If token received, stop and restart fresh run
                    if (success) {
                        if (browserGithub) {
                            const pages = await browserGithub.pages();
                            for (const pg of pages) { try { await pg.close(); } catch (err) { } }
                            await browserGithub.close().catch(() => { });
                        }
                        console.log('Token generated! Rerunning whole process...\n');
                        process.exit(0); // Exit so runner script restarts it fresh
                    }

                    await sleep(10000);
                    break;
                } catch (e) {
                    console.error('DuckSpam attempt failed:', e.message);
                    if (e.message === 'FATAL_GITHUB_ERROR') break;
                    if (duckSpamAttempt >= 3) {
                        console.log('Max DuckSpam attempts reached. Restarting GitHub signup...');
                        throw new Error('RESTART_NEEDED');
                    }
                    await sleep(5000);
                }
            }
        } catch (e) {
            console.error(`GitHub Attempt failed:`, e.message);
            await sleep(5000);
        } finally {
            if (browserGithub) try { await browserGithub.close(); } catch (err) { }
        }
    }
}

main();
