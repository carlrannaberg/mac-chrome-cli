#!/bin/bash

# Validation script for mac-chrome-cli commands
# Tests each command to ensure it works as expected

set -e  # Exit on first error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for passed/failed tests
PASSED=0
FAILED=0
ERRORS=""

# Function to run a test
run_test() {
    local cmd="$1"
    local description="$2"
    
    echo -n "Testing: $description ... "
    
    if eval "$cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC}"
        ((FAILED++))
        ERRORS="$ERRORS\n  - $description: $cmd"
        return 1
    fi
}

# Function to run a test that might fail (non-critical)
run_optional_test() {
    local cmd="$1"
    local description="$2"
    
    echo -n "Testing (optional): $description ... "
    
    if eval "$cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${YELLOW}⚠${NC} (skipped - Chrome may not be running)"
        return 1
    fi
}

echo "==================================="
echo "Mac-Chrome-CLI Command Validation"
echo "==================================="
echo ""

# 1. Basic Commands
echo "1. Testing Basic Commands"
echo "-------------------------"
run_test "npx mac-chrome-cli test --json" "test command"
run_test "npx mac-chrome-cli doctor --json" "doctor command"
run_test "npx mac-chrome-cli meta info --json" "meta info"
run_test "npx mac-chrome-cli meta stats --json" "meta stats"
run_test "npx mac-chrome-cli meta commands --json" "meta commands"
run_test "npx mac-chrome-cli meta permissions --json" "meta permissions"
echo ""

# 2. Help Commands
echo "2. Testing Help Commands"
echo "------------------------"
run_test "npx mac-chrome-cli help" "main help"
run_test "npx mac-chrome-cli help nav" "nav help"
run_test "npx mac-chrome-cli help tab" "tab help"
run_test "npx mac-chrome-cli help shot" "shot help"
echo ""

# 3. Navigation Commands (Chrome-dependent)
echo "3. Testing Navigation Commands"
echo "-------------------------------"
run_test "npx mac-chrome-cli nav --help" "nav help"
run_optional_test "npx mac-chrome-cli nav go --url https://www.google.com --json" "nav go"
echo ""

# 4. Tab Commands (Chrome-dependent)
echo "4. Testing Tab Commands"
echo "-----------------------"
run_test "npx mac-chrome-cli tab --help" "tab help"
run_optional_test "npx mac-chrome-cli tab list --json" "tab list"
run_optional_test "npx mac-chrome-cli tab active --json" "tab active"
echo ""

# 5. Screenshot Commands (Chrome-dependent)
echo "5. Testing Screenshot Commands"
echo "------------------------------"
run_optional_test "npx mac-chrome-cli shot viewport --json --out /tmp/test-viewport.png" "shot viewport"
run_optional_test "npx mac-chrome-cli shot fullpage --json --out /tmp/test-fullpage.png" "shot fullpage"
# Clean up test files
rm -f /tmp/test-viewport.png /tmp/test-fullpage.png 2>/dev/null || true
echo ""

# 6. Mouse Commands (Chrome-dependent)
echo "6. Testing Mouse Commands"
echo "-------------------------"
run_optional_test "npx mac-chrome-cli mouse position --json" "mouse position"
echo ""

# 7. Keyboard Commands (Chrome-dependent)
echo "7. Testing Keyboard Commands"
echo "----------------------------"
# We'll test help since actual typing requires active Chrome
run_test "npx mac-chrome-cli keyboard --help" "keyboard help"
echo ""

# 8. Input Commands (Chrome-dependent)
echo "8. Testing Input Commands"
echo "------------------------"
# We'll test help since actual input requires active Chrome with forms
run_test "npx mac-chrome-cli input --help" "input help"
echo ""

# 9. Wait Command
echo "9. Testing Wait Command"
echo "-----------------------"
run_test "npx mac-chrome-cli wait 100 --json" "wait 100ms"
echo ""

# 10. Network Monitoring Commands
echo "10. Testing Network Monitoring Commands"
echo "---------------------------------------"
run_test "npx mac-chrome-cli netlog --help" "netlog help"
run_optional_test "npx mac-chrome-cli netlog start --json" "netlog start"
run_optional_test "npx mac-chrome-cli netlog stop --json" "netlog stop"
run_optional_test "npx mac-chrome-cli netlog dump --json" "netlog dump"
echo ""

# 11. Snapshot Commands (Chrome-dependent)
echo "11. Testing Snapshot Commands"
echo "-----------------------------"
run_optional_test "npx mac-chrome-cli snapshot outline --json" "snapshot outline"
run_optional_test "npx mac-chrome-cli snapshot dom-lite --json" "snapshot dom-lite"
echo ""

# 12. Scroll Commands (Chrome-dependent)
echo "12. Testing Scroll Commands"
echo "---------------------------"
run_optional_test "npx mac-chrome-cli scroll position --json" "scroll position"
echo ""

# 13. Files Commands (Chrome-dependent)
echo "13. Testing Files Commands"
echo "-------------------------"
# We'll test help since file operations require specific contexts
run_test "npx mac-chrome-cli files --help" "files help"
echo ""

# 14. DOM Commands (Chrome-dependent)
echo "14. Testing DOM Commands"
echo "-----------------------"
run_optional_test "npx mac-chrome-cli dom eval --js 'document.title' --json" "dom eval"
echo ""

# 15. Benchmark Command
echo "15. Testing Benchmark Command"
echo "-----------------------------"
run_test "npx mac-chrome-cli benchmark --help" "benchmark help"
echo ""

# Summary
echo "==================================="
echo "           SUMMARY"
echo "==================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -gt 0 ]; then
    echo -e "\n${RED}Failed commands:${NC}$ERRORS"
    exit 1
else
    echo -e "\n${GREEN}All command tests passed!${NC}"
fi

# Additional validation: Check if all documented commands have help
echo ""
echo "==================================="
echo "    HELP AVAILABILITY CHECK"
echo "==================================="

COMMANDS=(
    "nav" "tab" "shot" "mouse" "keyboard" "input" "wait" 
    "netlog" "snapshot" "scroll" "files" "dom" "meta" "benchmark"
)

for cmd in "${COMMANDS[@]}"; do
    echo -n "Checking help for '$cmd' ... "
    if npx mac-chrome-cli "$cmd" --help > /dev/null 2>&1 || npx mac-chrome-cli help "$cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC} (no help available)"
    fi
done

echo ""
echo "Validation complete!"