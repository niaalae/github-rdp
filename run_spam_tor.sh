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
    pkill -f "spam_tor.js" || true
    pkill -f "Xvfb" || true
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] Cleanup complete${NC}"
}

trap cleanup EXIT INT TERM

# Check if running as root (for sudo case)
if [ "$EUID" -eq 0 ]; then
    echo -e "${YELLOW}Running as root${NC}"
fi

# Install xvfb if not available
if ! command -v xvfb-run &> /dev/null; then
    echo -e "${YELLOW}Installing xvfb...${NC}"
    apt-get update > /dev/null 2>&1
    apt-get install -y xvfb > /dev/null 2>&1
    echo -e "${GREEN}xvfb installed${NC}"
fi

# Run spam_tor.js with virtual display (monitoring disabled)
echo -e "${GREEN}Starting spam_tor.js with virtual display...${NC}"
echo -e "${YELLOW}============================================${NC}"

xvfb-run -a -s "-screen 0 1920x1080x24" node "$SCRIPT_DIR/spam_tor.js" "$@"

EXIT_CODE=$?

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] Process completed${NC}"
echo -e "${YELLOW}Exit Code: $EXIT_CODE${NC}"
echo -e "${YELLOW}Logs saved to: $LOG_FILE${NC}"
echo -e "${BLUE}=====================================${NC}"

exit "$EXIT_CODE"
