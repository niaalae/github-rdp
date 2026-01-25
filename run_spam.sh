#!/bin/bash
# Wrapper script to run spam.js with virtual display and infinite loop

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/spam_$(date +%Y%m%d_%H%M%S).log"

echo -e "${BLUE}========== Spam Monitor (Infinite) ==========${NC}"
echo -e "${YELLOW}Script: spam.js${NC}"
echo -e "${YELLOW}Log File: $LOG_FILE${NC}"
echo -e "${BLUE}============================================${NC}"

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning up...${NC}"
    echo -e "${GREEN}Cleanup complete${NC}"
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
fi

while true; do
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] Launching fresh instance...${NC}"
    xvfb-run -a -s "-screen 0 1920x1080x24" node "$SCRIPT_DIR/spam.js" "$@" 2>&1 | tee -a "$LOG_FILE"
    
    EXIT_CODE=$?
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${YELLOW}Instance completed (Exit Code: $EXIT_CODE). Restarting in 10s...${NC}"
    echo -e "${BLUE}============================================${NC}"
    sleep 10
done
