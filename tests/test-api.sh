#!/bin/bash

# Test parameters
FID=3
WALLET_ADDRESS="0xd8dA6BF26964ariceF9D7eEd9e03E53415D37aA96045"
TOKEN_ADDRESS="0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed"
CHAIN_ID=8453
USD_PRICE=0.005

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Create a new trigger
echo -e "${GREEN}Creating new price trigger...${NC}"
RESPONSE=$(curl -s -X POST http://localhost:5000/api/triggers \
  -H "Content-Type: application/json" \
  -d "{
    \"fid\": $FID,
    \"walletAddress\": \"$WALLET_ADDRESS\",
    \"tokenAddress\": \"$TOKEN_ADDRESS\",
    \"chainId\": $CHAIN_ID,
    \"usdPrice\": $USD_PRICE
  }")

echo "Raw response: $RESPONSE"

# Extract trigger ID from response
TRIGGER_ID=$(echo $RESPONSE | grep -o '"id":[0-9]*' | cut -d':' -f2)

if [ -z "$TRIGGER_ID" ]; then
  echo -e "${RED}Failed to create trigger${NC}"
  echo "Response: $RESPONSE"
  exit 1
fi

echo -e "${GREEN}Created trigger with ID: $TRIGGER_ID${NC}"

# Wait a shorter time for some logs to be generated
echo "Waiting for price checks (15 seconds)..."
sleep 15

# Check trigger status
echo -e "${GREEN}Checking trigger status...${NC}"
STATUS_RESPONSE=$(curl -s "http://localhost:5000/api/triggers/$TRIGGER_ID")

if [ -z "$STATUS_RESPONSE" ]; then
  echo -e "${RED}Failed to get trigger status${NC}"
  exit 1
fi

echo "Trigger status:"
echo $STATUS_RESPONSE | json_pp

echo -e "${GREEN}Test completed${NC}"