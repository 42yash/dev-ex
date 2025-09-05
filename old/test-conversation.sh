#!/bin/bash

# Test script for conversation context
API_URL="http://localhost:8080/api/v1"

echo "Testing conversation context system..."
echo "======================================"

# Step 1: Register a test user
echo "1. Registering test user..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "context-test@example.com",
    "password": "Test123!@#",
    "name": "Context Tester"
  }')

# Extract token from response
TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Registration failed or user already exists. Trying login..."
  
  # Try to login instead
  LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "context-test@example.com",
      "password": "Test123!@#"
    }')
  
  TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ]; then
  echo "Failed to authenticate. Exiting."
  exit 1
fi

echo "Token obtained: ${TOKEN:0:20}..."
echo ""

# Step 2: Create a chat session
echo "2. Creating chat session..."
SESSION_RESPONSE=$(curl -s -X POST "$API_URL/chat/session" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Context Test Session"
  }')

SESSION_ID=$(echo $SESSION_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Session created: $SESSION_ID"
echo ""

# Step 3: Send first message
echo "3. Sending first message..."
MESSAGE1=$(curl -s -X POST "$API_URL/chat/message" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"Hi! My name is Alice and I work as a software engineer.\"
  }")

echo "Response 1:"
echo $MESSAGE1 | jq -r '.response.content // .content // .message' 2>/dev/null || echo $MESSAGE1
echo ""

sleep 2

# Step 4: Send second message (should remember the name)
echo "4. Sending second message (testing name recall)..."
MESSAGE2=$(curl -s -X POST "$API_URL/chat/message" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"What is my name?\",
    \"conversationHistory\": [
      {
        \"role\": \"user\",
        \"content\": \"Hi! My name is Alice and I work as a software engineer.\",
        \"timestamp\": \"$(date -Iseconds)\"
      }
    ]
  }")

echo "Response 2:"
echo $MESSAGE2 | jq -r '.response.content // .content // .message' 2>/dev/null || echo $MESSAGE2
echo ""

sleep 2

# Step 5: Send third message (should remember the profession)
echo "5. Sending third message (testing profession recall)..."
MESSAGE3=$(curl -s -X POST "$API_URL/chat/message" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"What do I do for work?\",
    \"conversationHistory\": [
      {
        \"role\": \"user\",
        \"content\": \"Hi! My name is Alice and I work as a software engineer.\",
        \"timestamp\": \"$(date -Iseconds)\"
      },
      {
        \"role\": \"assistant\",
        \"content\": \"Hello Alice! Nice to meet you.\",
        \"timestamp\": \"$(date -Iseconds)\"
      },
      {
        \"role\": \"user\",
        \"content\": \"What is my name?\",
        \"timestamp\": \"$(date -Iseconds)\"
      },
      {
        \"role\": \"assistant\",
        \"content\": \"Your name is Alice.\",
        \"timestamp\": \"$(date -Iseconds)\"
      }
    ]
  }")

echo "Response 3:"
echo $MESSAGE3 | jq -r '.response.content // .content // .message' 2>/dev/null || echo $MESSAGE3
echo ""

# Step 6: Send fourth message (testing context understanding)
echo "6. Sending fourth message (testing context understanding)..."
MESSAGE4=$(curl -s -X POST "$API_URL/chat/message" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"Can you summarize what you know about me?\",
    \"conversationHistory\": [
      {
        \"role\": \"user\",
        \"content\": \"Hi! My name is Alice and I work as a software engineer.\",
        \"timestamp\": \"$(date -Iseconds)\"
      },
      {
        \"role\": \"assistant\",
        \"content\": \"Hello Alice! Nice to meet you. It's great to connect with a fellow tech professional.\",
        \"timestamp\": \"$(date -Iseconds)\"
      },
      {
        \"role\": \"user\",
        \"content\": \"What is my name?\",
        \"timestamp\": \"$(date -Iseconds)\"
      },
      {
        \"role\": \"assistant\",
        \"content\": \"Your name is Alice.\",
        \"timestamp\": \"$(date -Iseconds)\"
      },
      {
        \"role\": \"user\",
        \"content\": \"What do I do for work?\",
        \"timestamp\": \"$(date -Iseconds)\"
      },
      {
        \"role\": \"assistant\",
        \"content\": \"You work as a software engineer.\",
        \"timestamp\": \"$(date -Iseconds)\"
      }
    ]
  }")

echo "Response 4:"
echo $MESSAGE4 | jq -r '.response.content // .content // .message' 2>/dev/null || echo $MESSAGE4
echo ""

echo "======================================"
echo "Conversation context test completed!"
echo ""
echo "The AI should have demonstrated memory of:"
echo "1. The user's name (Alice)"
echo "2. The user's profession (software engineer)"
echo "3. The conversation context across multiple turns"