#!/bin/bash
# GitHub RDP Bot - Dependency Installer
# Installs: Node.js, npm, Chrome, Tor, Xvfb, XFCE4, Chrome Remote Desktop

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

# Install XFCE4
echo "[INFO] Installing XFCE4 Desktop Environment..."
sudo apt-get install -y xfce4 xfce4-goodies

# Install Chrome Remote Desktop
if ! [ -f "/opt/google/chrome-remote-desktop/chrome-remote-desktop" ]; then
    echo "[INFO] Installing Chrome Remote Desktop..."
    wget https://dl.google.com/linux/direct/chrome-remote-desktop_current_amd64.deb
    sudo apt-get install -y ./chrome-remote-desktop_current_amd64.deb
    rm chrome-remote-desktop_current_amd64.deb
else
    echo "[✓] Chrome Remote Desktop is already installed"
fi

# Configure CRD to use XFCE
echo "exec startxfce4" > ~/.chrome-remote-desktop-session

# Install npm dependencies
echo "[INFO] Installing npm dependencies..."
PROJECT_ROOT=$(pwd)

if [ -f "$PROJECT_ROOT/package.json" ]; then
    npm install > /dev/null 2>&1
    echo "[✓] Main directory npm installed"
fi

if [ -d "$PROJECT_ROOT/orch" ] && [ -f "$PROJECT_ROOT/orch/package.json" ]; then
    cd "$PROJECT_ROOT/orch"
    npm install > /dev/null 2>&1
    echo "[✓] Orch directory npm installed"
    cd "$PROJECT_ROOT"
fi

echo ""
echo "========================================="
echo "Initializing Services..."
echo "========================================="

sudo service dbus start
/opt/google/chrome-remote-desktop/chrome-remote-desktop --start

/opt/google/chrome-remote-desktop/chrome-remote-desktop --stop
/opt/google/chrome-remote-desktop/chrome-remote-desktop --start

sudo service dbus restart
/opt/google/chrome-remote-desktop/chrome-remote-desktop --stop
/opt/google/chrome-remote-desktop/chrome-remote-desktop --start

echo ""
echo "========================================="
echo "✓ Installation and Initialization Complete!"
echo "========================================="
echo ""
