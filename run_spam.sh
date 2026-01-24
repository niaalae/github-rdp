#!/bin/bash
# Wrapper script to run spam.js with virtual display

# Check if xvfb-run is available
if command -v xvfb-run &> /dev/null; then
    echo "Using xvfb-run to create virtual display..."
    xvfb-run -a -s "-screen 0 1920x1080x24" node spam.js "$@"
else
    echo "xvfb-run not found. Installing xvfb..."
    apt-get update > /dev/null 2>&1 && apt-get install -y xvfb > /dev/null 2>&1
    if command -v xvfb-run &> /dev/null; then
        echo "xvfb-run installed. Running with virtual display..."
        xvfb-run -a -s "-screen 0 1920x1080x24" node spam.js "$@"
    else
        echo "Failed to install xvfb. Running in headless mode..."
        node spam.js "$@"
    fi
fi
