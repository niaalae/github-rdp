#!/bin/bash
# Wrapper script to run spam_tor.js with virtual display and monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/spam_tor_$(date +%Y%m%d_%H%M%S).log"

echo -e "${BLUE}========== Spam Tor Monitor ==========${NC}"
echo -e "${YELLOW}Script: spam_tor.js${NC}"
echo -e "${YELLOW}Log File: $LOG_FILE${NC}"
echo -e "${YELLOW}PID: $$${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning up...${NC}"
    # The JS script handles its own child processes.
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] Cleanup complete${NC}"
}

trap cleanup EXIT INT TERM

# Ensure xvfb is installed
if ! command -v xvfb-run &> /dev/null; then
    echo -e "${YELLOW}Installing xvfb...${NC}"
    if command -v apt-get &> /dev/null; then
        sudo apt-get update > /dev/null 2>&1
        sudo apt-get install -y xvfb > /dev/null 2>&1
    elif command -v pacman &> /dev/null; then
        sudo pacman -S --noconfirm xorg-server-xvfb
    fi
    echo -e "${GREEN}xvfb installed${NC}"
fi

# Run spam_tor.js with virtual display in an infinite loop
echo -e "${GREEN}Starting spam_tor.js in INFINITE MODE...${NC}"
echo -e "${YELLOW}============================================${NC}"

while true; do
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] Launching fresh instance...${NC}"
    
    xvfb-run -a -s "-screen 0 1920x1080x24" node "$SCRIPT_DIR/spam_tor.js" "$@" 2>&1 | tee -a "$LOG_FILE"
    
    EXIT_CODE=$?
    
    echo ""
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] Instance completed (Exit Code: $EXIT_CODE)${NC}"
    echo -e "${YELLOW}Cooldown: 10 seconds before next run...${NC}"
    echo -e "${BLUE}=====================================${NC}"
    
    sleep 10
done
