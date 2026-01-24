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
    pkill -f "fact.js" || true
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

# Function to monitor process
monitor_process() {
    local pid=$1
    while kill -0 "$pid" 2>/dev/null; do
        sleep 5
        local cpu=$(ps -p "$pid" -o %cpu= 2>/dev/null | tr -d ' ')
        local mem=$(ps -p "$pid" -o %mem= 2>/dev/null | tr -d ' ')
        local elapsed=$(ps -p "$pid" -o elapsed= 2>/dev/null | tr -d ' ')
        echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] Monitor - PID: $pid | CPU: ${cpu}% | MEM: ${mem}% | Elapsed: $elapsed${NC}"
    done
}

# Run fact.js with virtual display
echo -e "${GREEN}Starting fact.js with virtual display...${NC}"
echo -e "${YELLOW}============================================${NC}"

xvfb-run -a -s "-screen 0 1920x1080x24" node "$SCRIPT_DIR/signup_cluster_tor.js" "$@" 2>&1 | tee -a "$LOG_FILE" &

PID=$!

echo -e "${GREEN}Process started with PID: $PID${NC}"
echo ""

# Monitor the process in background
monitor_process "$PID" &
MONITOR_PID=$!

# Wait for main process
wait "$PID"
EXIT_CODE=$?

# Kill monitor
kill "$MONITOR_PID" 2>/dev/null || true

echo ""
echo -e "${BLUE}===================================${NC}"
echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] Process completed${NC}"
echo -e "${YELLOW}Exit Code: $EXIT_CODE${NC}"
echo -e "${YELLOW}Logs saved to: $LOG_FILE${NC}"
echo -e "${BLUE}===================================${NC}"

exit "$EXIT_CODE"
