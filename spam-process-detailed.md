# Detailed Walkthrough of spam.js: Automated GitHub Signup via DuckSpam

## Overview

`spam.js` is a Node.js script that automates the process of signing up for a GitHub account using a temporary email address from DuckSpam.com. The script uses Puppeteer with stealth plugins to mimic human behavior and avoid bot detection. It does not use VPN or Tor, but instead relies on advanced browser fingerprinting and random noise to appear human.

The process consists of:
- Generating a realistic username
- Creating a DuckSpam mailbox
- Signing up on GitHub using the DuckSpam email
- Retrieving the GitHub verification code from DuckSpam
- Completing the GitHub signup
- (Optionally) Generating a GitHub token

---

## Step-by-Step Process

### 1. Environment Setup
- Loads environment variables from `.env` if present
- Handles unhandled promise rejections and uncaught exceptions

### 2. Utilities & Stealth
- **User Agent & Viewport:** Uses random mobile user agents and viewports for each browser session
- **Human Noise:** Simulates mouse movements, scrolling, random clicks, and hovers to mimic human activity
- **Typing Simulation:** Types into fields with random delays, occasional mistakes, and corrections
- **Advanced Stealth:** Modifies browser properties (plugins, languages, hardwareConcurrency, etc.) to avoid detection

---

## Main Automation Flow

### 1. Generate a Realistic Username
- Combines random first, middle, and last names

### 2. Create DuckSpam Mailbox
- **URL:** `https://duckspam.com`
- **Selector for mailbox name input:** `input#mailboxName`
- **Selector for submit button:** `button.btn.btn-lg.btn-primary`
- **Selector for mailbox list:** `.mailbox-list`
- **Process:**
    - Open DuckSpam
    - Enter username in `input#mailboxName`
    - Click `button.btn.btn-lg.btn-primary` to create mailbox
    - Wait for `.mailbox-list` to appear
    - The email address is `{username}@duckspam.com`

### 3. Start GitHub Signup
- **URL:** `https://github.com/signup`
- **Selectors:**
    - Email: `input#email`
    - Password: `input#password`
    - Username: `input#login`
    - Continue buttons: `button[data-continue-to="password-container"]`, `button[data-continue-to="username-container"]`, `button[data-continue-to="opt-in-container"]`, `button[data-continue-to="captcha-and-submit-container"]`
    - Marketing consent: `input[id="user_signup[marketing_consent]"]`
    - Create account: `button.js-octocaptcha-load-captcha.signup-form-fields__button.Button--primary[data-target="signup-form.SignupButton"]`
- **Process:**
    - Fill in email, password, and username fields
    - Click the respective continue buttons after each field
    - Check marketing consent if present
    - Click the final continue button
    - Solve captcha if present (selectors: `iframe[src*="captcha"]`, `.hcaptcha-box`, `.g-recaptcha`)
    - Click the create account button
    - Wait for code input fields (`input#launch-code-0`, etc.)

### 4. Retrieve GitHub Verification Code from DuckSpam
- **Selectors:**
    - Email list: `.mailbox-list .list-group-item`, `.mail-list .mail-item`, `.col-xs-12.mail-list a`
    - Refresh button: `.action-bar.text-right a.btn.btn-primary`
    - Email content iframe: `iframe`
- **Process:**
    - Wait for an email from GitHub to arrive
    - Click the email item containing "GitHub" or "verification"
    - Wait for the email content to load (iframe or main page)
    - Extract the 8-digit code using regex `/\b(\d{8})\b/`
    - If no email, click refresh or resend on GitHub

### 5. Complete GitHub Signup
- **Selectors:**
    - Code input fields: `input#launch-code-0`, `input#launch-code-1`, etc.
- **Process:**
    - Enter the 8-digit code into the code input fields
    - Submit the code (auto-submit or click button if present)
    - Wait for confirmation and dashboard

### 6. (Optional) Generate GitHub Token
- **Selectors:**
    - Token generation steps are handled via UI navigation and button clicks (details omitted in summary)

---

## Advanced Human Simulation
- **Mouse Movements:** Random, curvy, spiral, and wiggle paths
- **Scrolling:** Random amounts, smooth and auto behavior
- **Clicks:** On random elements, not just buttons
- **Typing:** Simulates mistakes, corrections, and variable speed
- **Stealth:** Modifies browser fingerprinting properties

---

## Error Handling & Recovery
- If any step fails (e.g., field not found, code not received), the script throws a `RESTART_NEEDED` error and can restart the process
- Handles rate limits and blocks by retrying or switching accounts

---

## Key CSS Selectors Reference
| Purpose                | Selector(s)                                                                 |
|------------------------|-----------------------------------------------------------------------------|
| DuckSpam mailbox input | `input#mailboxName`                                                         |
| DuckSpam submit        | `button.btn.btn-lg.btn-primary`                                              |
| DuckSpam email list    | `.mailbox-list .list-group-item`, `.mail-list .mail-item`, `.col-xs-12.mail-list a` |
| DuckSpam refresh       | `.action-bar.text-right a.btn.btn-primary`                                   |
| GitHub email           | `input#email`                                                                |
| GitHub password        | `input#password`                                                             |
| GitHub username        | `input#login`                                                                |
| GitHub continue btns   | `button[data-continue-to="..."]`                                           |
| GitHub marketing       | `input[id="user_signup[marketing_consent]"]`                               |
| GitHub create account  | `button.js-octocaptcha-load-captcha.signup-form-fields__button.Button--primary[data-target="signup-form.SignupButton"]` |
| GitHub code input      | `input#launch-code-0`, `input#launch-code-1`, etc.                           |
| Captcha                | `iframe[src*="captcha"]`, `.hcaptcha-box`, `.g-recaptcha`                  |

---

## Conclusion

`spam.js` is a sophisticated automation script for creating GitHub accounts using DuckSpam temporary emails. It uses advanced browser stealth, human-like interaction, and robust error handling to maximize success and minimize detection. All major steps, selectors, and logic are covered above for reference and further development.
