# Install Chrome dependencies to avoid SIGILL and related errors
apt install -y libnss3 libxss1 libasound2 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libu2f-udev lsb-release

# Download and install Google Chrome browser if not already installed
if ! command -v google-chrome > /dev/null 2>&1; then
    CHROME_DEB_URL="https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb"
    CHROME_DEB_PATH="/tmp/google-chrome-stable_current_amd64.deb"
    wget -O "$CHROME_DEB_PATH" "$CHROME_DEB_URL"
    dpkg -i "$CHROME_DEB_PATH" || apt-get install -f -y
    rm -f "$CHROME_DEB_PATH"
fi

# Create a wrapper script to always launch Chrome with safe flags
cat <<EOF > /usr/local/bin/chrome-wrapper.sh
#!/bin/bash
exec google-chrome --no-sandbox --disable-gpu "\$@"
EOF
chmod +x /usr/local/bin/chrome-wrapper.sh

# Add a desktop entry for Chrome (for XFCE menu) using the wrapper
cat <<EOF > /usr/share/applications/google-chrome.desktop
[Desktop Entry]
Version=1.0
Name=Google Chrome
Comment=Access the Internet
Exec=/usr/local/bin/chrome-wrapper.sh %U
Terminal=false
Icon=google-chrome
Type=Application
Categories=Network;WebBrowser;
EOF
chmod +x /usr/share/applications/google-chrome.desktop
#!/bin/bash
# https://github.com/complexorganizations/github-codespaces-rdp

# Require script to be run as root
function super-user-check() {
    if [ "${EUID}" -ne 0 ]; then
        echo "You need to run this script as super user."
        exit
    fi
}


# Check for root
super-user-check

# Update and install required packages
apt update
apt install -y xfce4 xfce4-goodies task-xfce-desktop desktop-base xscreensaver dbus-x11

# Download and install Chrome Remote Desktop .deb if not already installed
if [ ! -f /opt/google/chrome-remote-desktop/chrome-remote-desktop ]; then
    CRD_DEB_URL="https://dl.google.com/linux/direct/chrome-remote-desktop_current_amd64.deb"
    CRD_DEB_PATH="/tmp/chrome-remote-desktop_current_amd64.deb"
    wget -O "$CRD_DEB_PATH" "$CRD_DEB_URL"
    dpkg -i "$CRD_DEB_PATH" || apt-get install -f -y
    rm -f "$CRD_DEB_PATH"
fi

# Prompt for Chrome Remote Desktop code
read -p "Enter Chrome Remote Desktop code to link (leave blank to skip): " CRD_CODE
CRD_PIN="077017"

# If code is provided, register host and set PIN
if [ -n "$CRD_CODE" ]; then
    if [ -f /opt/google/chrome-remote-desktop/start-host ]; then
        echo "Linking Chrome Remote Desktop with provided code..."
        /opt/google/chrome-remote-desktop/start-host --code="$CRD_CODE" --pin="$CRD_PIN" --name="$(hostname)" || {
            echo "Failed to link Chrome Remote Desktop. Please check the code and try again.";
            exit 1;
        }
        echo "Chrome Remote Desktop linked and PIN set."
    else
        echo "Chrome Remote Desktop is not installed correctly. Please check installation steps."
        exit 1
    fi
else
    echo "No code provided. Skipping Chrome Remote Desktop linking."
fi

# Detect Operating System
function dist-check() {
    if [ -f /etc/os-release ]; then
        # shellcheck disable=SC1091
        source /etc/os-release
        DISTRO=${ID}
    fi
}

# Check Operating System
dist-check

function install-system-requirements() {
    if { [ "${DISTRO}" == "ubuntu" ] || [ "${DISTRO}" == "debian" ]; }; then
        if [ ! -x "$(command -v curl)" ]; then
            if { [ "${DISTRO}" == "ubuntu" ] || [ "${DISTRO}" == "debian" ]; }; then
                apt-get update
                apt-get install curl haveged -y
            fi
        fi
    else
        echo "Error: ${DISTRO} not supported."
        exit
    fi
}

install-system-requirements

function install-chrome-headless() {
    chrome_remote_desktop_url="https://dl.google.com/linux/direct/chrome-remote-desktop_current_amd64.deb"
    chrome_remote_desktop_local_path="/tmp/chrome-remote-desktop_current_amd64.deb"
    chrome_browser_url="https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb"
    chrome_browser_local_path="/tmp/google-chrome-stable_current_amd64.deb"
    if { [ "${DISTRO}" == "ubuntu" ] || [ "${DISTRO}" == "debian" ]; }; then
        apt-get update
        apt-get install xfce4 -y
        apt-get install desktop-base -y
        apt-get install task-xfce-desktop -y
        apt-get install xscreensaver -y
        echo "exec /etc/X11/Xsession /usr/bin/xfce4-session" >>/etc/chrome-remote-desktop-session
        curl ${chrome_remote_desktop_url} -o ${chrome_remote_desktop_local_path}
        dpkg --install ${chrome_remote_desktop_local_path}
        rm -f ${chrome_remote_desktop_local_path}
        curl ${chrome_browser_url} -o ${chrome_browser_local_path}
        dpkg --install ${chrome_browser_local_path}
        rm -f ${chrome_browser_local_path}
        apt-get install -f -y
    fi
}

install-chrome-headless

function handle-services() {
    if pgrep systemd-journal; then
        systemctl stop lightdm
    else
        service lightdm stop
    fi
}

handle-services
