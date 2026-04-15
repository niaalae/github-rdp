#!/bin/bash
# GitHub RDP Bot - Dependency Installer
# Installs: Node.js, npm, Chrome, Tor, Xvfb, XFCE4, Chrome Remote Desktop

echo ""
echo "========================================="
echo "GitHub RDP Bot - Dependency Installer"
echo "========================================="
echo ""

# Detect Package Manager
if command -v apt-get &> /dev/null; then
    PKG_MGR="apt"
    INSTALL_CMD="sudo apt-get install -y"
    UPDATE_CMD="sudo apt-get update"
elif command -v pacman &> /dev/null; then
    PKG_MGR="pacman"
    INSTALL_CMD="sudo pacman -S --noconfirm --needed"
    UPDATE_CMD="sudo pacman -Sy"
    # Arch needs AUR for some things
    if command -v yay &> /dev/null; then
        AUR_MGR="yay"
    elif command -v paru &> /dev/null; then
        AUR_MGR="paru"
    fi
else
    echo "[ERROR] Unsupported package manager. Please install dependencies manually."
    exit 1
fi

echo "[INFO] Detected package manager: $PKG_MGR"

# Fix Yarn GPG error if it exists (Apt only)
if [ "$PKG_MGR" == "apt" ] && [ -f "/etc/apt/sources.list.d/yarn.list" ]; then
    echo "[INFO] Fixing Yarn GPG issue..."
    sudo rm /etc/apt/sources.list.d/yarn.list
fi

# Update system
$UPDATE_CMD

# Check for Node.js / npm
if ! command -v npm &> /dev/null; then
    echo "[INFO] npm not found. Installing Node.js..."
    if [ "$PKG_MGR" == "apt" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        $INSTALL_CMD nodejs
    else
        $INSTALL_CMD nodejs npm
    fi
else
    echo "[✓] npm is already installed"
fi

# Check for Chrome
if ! command -v google-chrome &> /dev/null && ! command -v google-chrome-stable &> /dev/null && ! command -v chromium &> /dev/null; then
    echo "[INFO] Chrome not found. Installing..."
    if [ "$PKG_MGR" == "apt" ]; then
        wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
        sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' 2>/dev/null || true
        sudo apt-get update
        sudo apt-get install -y google-chrome-stable
    elif [ -n "$AUR_MGR" ]; then
        $AUR_MGR -S --noconfirm google-chrome
    else
        $INSTALL_CMD chromium
    fi
else
    echo "[✓] Chrome is already installed"
fi

# Check for Firefox (prefer Snap install)
SNAP_FIREFOX_OK=0
if ! [ -x /snap/bin/firefox ]; then
    echo "[INFO] Snap Firefox not found. Installing via snap..."
    if [ "$PKG_MGR" == "apt" ]; then
        $INSTALL_CMD snapd
        sudo ln -sf /var/lib/snapd/snap /snap
        if command -v snap &> /dev/null; then
            if ! [ -S /run/snapd.socket ]; then
                sudo nohup /usr/lib/snapd/snapd >/tmp/snapd-bg.log 2>&1 &
                for _ in $(seq 1 500000); do
                    [ -S /run/snapd.socket ] && break
                done
            fi
            if [ -S /run/snapd.socket ] && sudo snap install firefox; then
                SNAP_FIREFOX_OK=1
            else
                echo "[WARN] Snap install failed in this environment; falling back to apt Firefox package."
                if ! $INSTALL_CMD firefox; then
                    if ! $INSTALL_CMD firefox-esr; then
                        echo "[WARN] apt Firefox packages unavailable. Installing Firefox binary from Mozilla..."
                        TMP_DIR="$(mktemp -d)"
                        curl -fsSL "https://download.mozilla.org/?product=firefox-latest-ssl&os=linux64&lang=en-US" -o "$TMP_DIR/firefox.tar.xz"
                        sudo rm -rf /opt/firefox
                        sudo tar -xJf "$TMP_DIR/firefox.tar.xz" -C /opt
                        sudo ln -sf /opt/firefox/firefox /usr/local/bin/firefox
                        rm -rf "$TMP_DIR"
                    fi
                fi
            fi
        else
            echo "[WARN] snap command unavailable after snapd install; falling back to apt firefox."
            if ! $INSTALL_CMD firefox; then
                if ! $INSTALL_CMD firefox-esr; then
                    echo "[WARN] apt Firefox packages unavailable. Installing Firefox binary from Mozilla..."
                    TMP_DIR="$(mktemp -d)"
                    curl -fsSL "https://download.mozilla.org/?product=firefox-latest-ssl&os=linux64&lang=en-US" -o "$TMP_DIR/firefox.tar.xz"
                    sudo rm -rf /opt/firefox
                    sudo tar -xJf "$TMP_DIR/firefox.tar.xz" -C /opt
                    sudo ln -sf /opt/firefox/firefox /usr/local/bin/firefox
                    rm -rf "$TMP_DIR"
                fi
            fi
        fi
    else
        $INSTALL_CMD firefox
    fi
else
    echo "[✓] Snap Firefox is already installed"
    SNAP_FIREFOX_OK=1
fi

FIREFOX_BIN=""
if [ -x /snap/bin/firefox ]; then
    FIREFOX_BIN="/snap/bin/firefox"
elif command -v firefox &> /dev/null; then
    FIREFOX_BIN="$(command -v firefox)"
elif command -v firefox-esr &> /dev/null; then
    FIREFOX_BIN="$(command -v firefox-esr)"
fi

# Ensure Firefox launcher is visible in XFCE app menu and desktop.
echo "[INFO] Configuring Firefox launcher for XFCE..."
mkdir -p ~/.local/share/applications
mkdir -p ~/Desktop
mkdir -p ~/bin

cat > ~/bin/firefox-launcher << 'EOF'
#!/bin/bash
set -e
if [ -x /snap/bin/firefox ]; then
    exec /snap/bin/firefox "$@"
elif command -v firefox >/dev/null 2>&1; then
    exec "$(command -v firefox)" "$@"
elif command -v firefox-esr >/dev/null 2>&1; then
    exec "$(command -v firefox-esr)" "$@"
else
    echo "Firefox is not installed (firefox/firefox-esr not found)." >&2
    exit 1
fi
EOF
chmod +x ~/bin/firefox-launcher

cat > ~/.local/share/applications/firefox.desktop << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=Firefox
GenericName=Web Browser
Comment=Browse the Web
Exec=__FIREFOX_LAUNCHER__ %u
TryExec=__FIREFOX_LAUNCHER__
Icon=firefox
Terminal=false
Categories=Network;WebBrowser;
MimeType=text/html;text/xml;application/xhtml+xml;x-scheme-handler/http;x-scheme-handler/https;
Keywords=web;browser;internet;mozilla;
NoDisplay=false
Hidden=false
OnlyShowIn=XFCE;
StartupNotify=true
EOF

mv ~/.local/share/applications/firefox.desktop ~/.local/share/applications/mozilla-firefox-local.desktop

cat > ~/Desktop/Firefox.desktop << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=Firefox
GenericName=Web Browser
Comment=Browse the Web
Exec=__FIREFOX_LAUNCHER__ %u
TryExec=__FIREFOX_LAUNCHER__
Icon=firefox
Terminal=false
Categories=Network;WebBrowser;
NoDisplay=false
Hidden=false
StartupNotify=true
EOF

sed -i "s|__FIREFOX_LAUNCHER__|$HOME/bin/firefox-launcher|g" ~/.local/share/applications/mozilla-firefox-local.desktop ~/Desktop/Firefox.desktop

chmod +x ~/.local/share/applications/mozilla-firefox-local.desktop ~/Desktop/Firefox.desktop

# Refresh app database when available.
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database ~/.local/share/applications 2>/dev/null || true
fi
rm -rf ~/.cache/menus ~/.cache/xfce4/desktop ~/.cache/xfce4/xfce4-appfinder 2>/dev/null || true
xfce4-panel -r >/dev/null 2>&1 || true
pkill -HUP xfconfd 2>/dev/null || true
pkill -f xfce4-appfinder 2>/dev/null || true

# Check for Tor
if ! command -v tor &> /dev/null; then
    echo "[INFO] Tor not found. Installing..."
    $INSTALL_CMD tor
else
    echo "[✓] Tor is already installed"
fi

# Check for Xvfb
if ! command -v Xvfb &> /dev/null; then
    echo "[INFO] Xvfb not found. Installing..."
    if [ "$PKG_MGR" == "apt" ]; then
        $INSTALL_CMD xvfb
    else
        $INSTALL_CMD xorg-server-xvfb
    fi
else
    echo "[✓] Xvfb is already installed"
fi

# Install XFCE4 and DBus-X11
echo "[INFO] Installing Desktop Environment (XFCE4)..."
if [ "$PKG_MGR" == "apt" ]; then
    $INSTALL_CMD xfce4 xfce4-goodies dbus-x11
else
    $INSTALL_CMD xfce4 xfce4-goodies dbus
fi

# Install Chrome Remote Desktop
if ! [ -f "/opt/google/chrome-remote-desktop/chrome-remote-desktop" ]; then
    echo "[INFO] Installing Chrome Remote Desktop..."
    if [ "$PKG_MGR" == "apt" ]; then
        wget https://dl.google.com/linux/direct/chrome-remote-desktop_current_amd64.deb
        sudo apt-get install -y ./chrome-remote-desktop_current_amd64.deb
        rm chrome-remote-desktop_current_amd64.deb
    elif [ -n "$AUR_MGR" ]; then
        $AUR_MGR -S --noconfirm chrome-remote-desktop
    else
        echo "[WARN] Chrome Remote Desktop must be installed manually on Arch if no AUR helper is found."
    fi
else
    echo "[✓] Chrome Remote Desktop is already installed"
fi

# Configure CRD to use XFCE as default
echo "[INFO] Configuring XFCE as default session..."
mkdir -p ~/.config/chrome-remote-desktop
cat > ~/.chrome-remote-desktop-session << 'EOF'
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/pyxdg-runtime-dir-fallback-$USER}"
export PIPEWIRE_RUNTIME_DIR="$XDG_RUNTIME_DIR"
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"
exec /usr/bin/startxfce4
EOF
if [ "$PKG_MGR" == "apt" ]; then
    sudo update-alternatives --set x-session-manager /usr/bin/xfce4-session 2>/dev/null || true
fi

# Ensure CRD has a runtime dir for PipeWire in headless/container environments.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/pyxdg-runtime-dir-fallback-$USER}"
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"
export PIPEWIRE_RUNTIME_DIR="$XDG_RUNTIME_DIR"

# Install npm dependencies
echo "[INFO] Installing npm dependencies..."
PROJECT_ROOT=$(pwd)
if [ -f "$PROJECT_ROOT/package.json" ]; then
    npm install
    echo "[✓] Main directory npm installed"
fi

echo ""
echo "========================================="
echo "Initializing Services..."
echo "========================================="

if [ "$PKG_MGR" == "apt" ]; then
    sudo service dbus restart
    sudo service tor start
else
    sudo systemctl restart dbus
    sudo systemctl start tor
fi

# Start CRD with clean state
if [ -f "/opt/google/chrome-remote-desktop/chrome-remote-desktop" ]; then
    /opt/google/chrome-remote-desktop/chrome-remote-desktop --stop 2>/dev/null || true
    /opt/google/chrome-remote-desktop/chrome-remote-desktop --start
fi

echo ""
echo "========================================="
echo "✓ Installation and Initialization Complete!"
echo "========================================="
echo ""

