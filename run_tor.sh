#!/bin/bash
# Wrapper script to run fact.js with virtual display and monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/fact_$(date +%Y%m%d_%H%M%S).log"

echo -e "${BLUE}========== Fact Monitor ==========${NC}"
echo -e "${YELLOW}Script: fact.js${NC}"
echo -e "${YELLOW}Log File: $LOG_FILE${NC}"
echo -e "${YELLOW}PID: $$${NC}"
echo -e "${BLUE}===================================${NC}"
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

# Run fact.js with virtual display
echo -e "${GREEN}Starting fact.js with virtual display (Dynamic Port)...${NC}"
echo -e "${YELLOW}============================================${NC}"

xvfb-run -a -s "-screen 0 1920x1080x24" node "$SCRIPT_DIR/signup_cluster_tor.js" "$@" 2>&1 | tee -a "$LOG_FILE"

EXIT_CODE=$?

echo ""
echo -e "${BLUE}===================================${NC}"
echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] Process completed${NC}"
echo -e "${YELLOW}Exit Code: $EXIT_CODE${NC}"
echo -e "${YELLOW}Logs saved to: $LOG_FILE${NC}"
echo -e "${BLUE}===================================${NC}"

exit "$EXIT_CODE"
