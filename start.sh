#!/bin/bash
# GitHub RDP Bot - Dependency Installer
# Installs: Node.js, npm, Chrome, Tor, Xvfb

echo ""
echo "========================================="
echo "GitHub RDP Bot - Dependency Installer"
echo "========================================="
echo ""

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "[INFO] npm not found. Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "[✓] npm is already installed"
fi

# Check for Chrome
if ! command -v google-chrome &> /dev/null && ! command -v chromium-browser &> /dev/null; then
    echo "[INFO] Chrome not found. Installing Google Chrome..."
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
    sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' 2>/dev/null || true
    sudo apt-get update
    sudo apt-get install -y google-chrome-stable
else
    echo "[✓] Chrome is already installed"
fi

# Check for Tor
if ! command -v tor &> /dev/null; then
    echo "[INFO] Tor not found. Installing Tor..."
    sudo apt-get install -y tor
else
    echo "[✓] Tor is already installed"
fi

# Check for Xvfb
if ! command -v Xvfb &> /dev/null; then
    echo "[INFO] Xvfb not found. Installing Xvfb..."
    sudo apt-get install -y xvfb
else
    echo "[✓] Xvfb is already installed"
fi

# Install npm dependencies
echo "[INFO] Installing npm dependencies..."
cd /workspaces/github-rdp
npm install > /dev/null 2>&1
echo "[✓] Main directory npm installed"

cd /workspaces/github-rdp/orch
npm install > /dev/null 2>&1
echo "[✓] Orch directory npm installed"

echo ""
echo "========================================="
echo "✓ Installation Complete!"
echo "========================================="
echo ""
