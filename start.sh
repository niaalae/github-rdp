#!/bin/bash
# GitHub RDP Bot - Dependency Installer
# Installs: Node.js, npm, Chrome, Tor, Xvfb, XFCE4, Chrome Remote Desktop

echo ""
echo "========================================="
echo "GitHub RDP Bot - Dependency Installer"
echo "========================================="
echo ""

# Fix Yarn GPG error if it exists
if [ -f "/etc/apt/sources.list.d/yarn.list" ]; then
    echo "[INFO] Fixing Yarn GPG issue..."
    sudo rm /etc/apt/sources.list.d/yarn.list
fi

# Update and install basic dependencies
sudo apt-get update

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

# Install XFCE4 and DBus-X11 (Required for CRD)
echo "[INFO] Installing XFCE4 and DBus utilities..."
sudo apt-get install -y xfce4 xfce4-goodies dbus-x11

# Install Chrome Remote Desktop
if ! [ -f "/opt/google/chrome-remote-desktop/chrome-remote-desktop" ]; then
    echo "[INFO] Installing Chrome Remote Desktop..."
    wget https://dl.google.com/linux/direct/chrome-remote-desktop_current_amd64.deb
    sudo apt-get install -y ./chrome-remote-desktop_current_amd64.deb
    rm chrome-remote-desktop_current_amd64.deb
else
    echo "[✓] Chrome Remote Desktop is already installed"
fi

# Configure CRD to use XFCE as default
echo "[INFO] Configuring XFCE as default session..."
mkdir -p ~/.config/chrome-remote-desktop
echo "exec /usr/bin/startxfce4" > ~/.chrome-remote-desktop-session
sudo update-alternatives --set x-session-manager /usr/bin/xfce4-session 2>/dev/null || true

# Install npm dependencies
echo "[INFO] Installing npm dependencies..."
PROJECT_ROOT=$(pwd)

if [ -f "$PROJECT_ROOT/package.json" ]; then
    npm install > /dev/null 2>&1
    echo "[✓] Main directory npm installed"
fi

echo ""
echo "========================================="
echo "Initializing Services..."
echo "========================================="

sudo service dbus restart
sudo service tor start

# Start CRD with clean state
/opt/google/chrome-remote-desktop/chrome-remote-desktop --stop 2>/dev/null || true
/opt/google/chrome-remote-desktop/chrome-remote-desktop --start

echo ""
echo "========================================="
echo "✓ Installation and Initialization Complete!"
echo "========================================="
echo ""

