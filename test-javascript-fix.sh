#!/bin/bash

# Test script to verify JavaScript execution fixes

echo "Testing JavaScript execution after fixes..."
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counter for pass/fail
PASS=0
FAIL=0

# Test function
test_command() {
    local description="$1"
    local command="$2"
    local expected_field="$3"
    
    echo -n "Testing $description... "
    
    result=$(eval "$command" 2>&1)
    
    if echo "$result" | grep -q "$expected_field"; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASS++))
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "  Command: $command"
        echo "  Expected: $expected_field"
        echo "  Got: $(echo "$result" | head -3)"
        ((FAIL++))
    fi
}

echo "1. Navigation Commands"
echo "----------------------"
test_command "nav go" "npm run dev -- nav go --url 'https://www.example.com' --json 2>/dev/null" '"success": true'
test_command "nav reload" "npm run dev -- nav reload --json 2>/dev/null" '"success": true'
test_command "nav back" "npm run dev -- nav back --json 2>/dev/null" '"success": true'

echo ""
echo "2. DOM Evaluation Commands"
echo "--------------------------"
test_command "dom eval (title)" "npm run dev -- dom eval --js 'document.title' --json 2>/dev/null" '"result":'
test_command "dom eval (URL)" "npm run dev -- dom eval --js 'window.location.href' --json 2>/dev/null" '"result":'
test_command "dom eval (element count)" "npm run dev -- dom eval --js 'document.querySelectorAll(\"a\").length' --json 2>/dev/null" '"result":'

echo ""
echo "3. Scroll Commands"
echo "------------------"
test_command "scroll position" "npm run dev -- scroll position --json 2>/dev/null" '"x":'
test_command "scroll by" "npm run dev -- scroll by --px 100 --json 2>/dev/null" '"success": true'
test_command "scroll to" "npm run dev -- scroll to --selector 'body' --json 2>/dev/null" '"success": true'

echo ""
echo "4. Input Commands"
echo "-----------------"
test_command "input get-value" "npm run dev -- input get-value --selector 'input' --json 2>&1 2>/dev/null | head -20" 'success'

echo ""
echo "5. Mouse Commands"
echo "-----------------"
test_command "mouse click" "npm run dev -- mouse click --x 100 --y 100 --json 2>/dev/null" '"success": true'

echo ""
echo "============================================"
echo "Test Results Summary:"
echo "============================================"
echo -e "Passed: ${GREEN}$PASS${NC}"
echo -e "Failed: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ All JavaScript-dependent commands are working!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some commands are still failing${NC}"
    exit 1
fi
