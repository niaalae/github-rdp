#!/bin/bash
# Wrapper script to run spam.js with virtual display

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure xvfb is installed
if ! command -v xvfb-run &> /dev/null; then
    echo "Installing xvfb..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update > /dev/null 2>&1
        sudo apt-get install -y xvfb > /dev/null 2>&1
    elif command -v pacman &> /dev/null; then
        sudo pacman -S --noconfirm xorg-server-xvfb
    fi
fi

echo "Starting spam.js with virtual display..."
xvfb-run -a -s "-screen 0 1920x1080x24" node "$SCRIPT_DIR/spam.js" "$@"
