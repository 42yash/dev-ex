# Dev-Ex Platform - REST API Documentation

## Base URL
- Development: `http://localhost:8080/api/v1`
- Production: `https://api.dev-ex.platform/v1`

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <jwt-token>
```

### Authentication Endpoints

#### POST /auth/register
Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "name": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"
  },
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

**Error Responses:**
- `400 Bad Request` - Validation error
- `409 Conflict` - User already exists

---

#### POST /auth/login
Authenticate an existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"
  },
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid credentials
- `403 Forbidden` - Account disabled

---

#### POST /auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response (200 OK):**
```json
{
  "accessToken": "new-jwt-access-token",
  "refreshToken": "new-jwt-refresh-token"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid refresh token

---

#### POST /auth/logout
Logout current user and invalidate session.

**Authentication:** Required

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

---

#### GET /auth/me
Get current user information.

**Authentication:** Required

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

## Chat & Session Management

### Session Endpoints

#### POST /chat/session
Create a new chat session.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "My Project Discussion",
  "metadata": {
    "project": "dev-ex",
    "category": "architecture"
  }
}
```

**Response (201 Created):**
```json
{
  "session": {
    "id": "uuid",
    "user_id": "uuid",
    "title": "My Project Discussion",
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

#### GET /chat/sessions
Get user's chat sessions.

**Authentication:** Required

**Query Parameters:**
- `limit` (integer, default: 20) - Number of sessions to return
- `offset` (integer, default: 0) - Pagination offset

**Response (200 OK):**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "title": "Project Discussion",
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z",
      "last_activity": "2024-01-01T10:00:00Z",
      "messageCount": 15
    }
  ]
}
```

---

#### DELETE /chat/session/:sessionId
Delete a chat session.

**Authentication:** Required

**Parameters:**
- `sessionId` (path) - Session ID to delete

**Response (200 OK):**
```json
{
  "message": "Session deleted successfully"
}
```

**Error Responses:**
- `404 Not Found` - Session not found or access denied

### Message Endpoints

#### POST /chat/message
Send a message to the AI assistant.

**Authentication:** Required

**Request Body:**
```json
{
  "sessionId": "uuid",
  "message": "Help me design a REST API",
  "options": {
    "stream": false,
    "preferredConnector": "documentation",
    "maxTokens": 2000,
    "temperature": 0.7
  }
}
```

**Response (200 OK):**
```json
{
  "sessionId": "uuid",
  "response": {
    "response_id": "uuid",
    "content": "I'll help you design a REST API...",
    "widgets": [
      {
        "type": "code",
        "widget_id": "w1",
        "config": {},
        "data": {
          "language": "javascript",
          "code": "// API example"
        }
      }
    ],
    "suggested_actions": [
      {
        "action_id": "a1",
        "label": "View Best Practices",
        "type": "navigate"
      }
    ],
    "metadata": {
      "tokens_used": 500,
      "processing_time": 1.2,
      "model_used": "gemini-pro"
    }
  }
}
```

---

#### GET /chat/history/:sessionId
Get chat history for a session.

**Authentication:** Required

**Parameters:**
- `sessionId` (path) - Session ID

**Query Parameters:**
- `limit` (integer, default: 50) - Number of messages
- `offset` (integer, default: 0) - Pagination offset

**Response (200 OK):**
```json
{
  "messages": [
    {
      "message_id": "uuid",
      "session_id": "uuid",
      "sender": "user",
      "content": "Hello",
      "timestamp": "2024-01-01T10:00:00Z"
    },
    {
      "message_id": "uuid",
      "session_id": "uuid",
      "sender": "ai",
      "content": "Hello! How can I help you today?",
      "timestamp": "2024-01-01T10:00:01Z"
    }
  ],
  "totalCount": 25
}
```

## Health & Status

#### GET /health
Check API health status.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "grpc": "connected"
  }
}
```

---

#### GET /status
Get detailed system status.

**Authentication:** Required (admin only)

**Response (200 OK):**
```json
{
  "status": "operational",
  "version": "1.0.0",
  "uptime": 86400,
  "metrics": {
    "activeUsers": 150,
    "activeSessions": 75,
    "requestsPerMinute": 200
  }
}
```

## Error Responses

All endpoints may return these standard error responses:

### 400 Bad Request
```json
{
  "error": "Validation error",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication required",
  "code": "AUTH_REQUIRED"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions",
  "code": "FORBIDDEN"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found",
  "code": "NOT_FOUND"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR",
  "requestId": "uuid"
}
```

## Rate Limiting

API rate limits:
- **Unauthenticated:** 60 requests per minute
- **Authenticated:** 600 requests per minute
- **Chat messages:** 30 messages per minute

Rate limit headers:
- `X-RateLimit-Limit` - Request limit
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset timestamp

## Webhooks

The platform supports webhooks for real-time notifications:

### Webhook Events
- `session.created` - New chat session created
- `message.received` - New message received
- `agent.completed` - Agent execution completed
- `workflow.finished` - Workflow execution finished

### Webhook Payload
```json
{
  "event": "session.created",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "sessionId": "uuid",
    "userId": "uuid"
  }
}
```

## SDK Examples

### JavaScript/TypeScript
```typescript
import { DevExClient } from '@devex/sdk';

const client = new DevExClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.dev-ex.platform/v1'
});

// Send a message
const response = await client.chat.sendMessage({
  sessionId: 'session-id',
  message: 'Help me with my project'
});
```

### Python
```python
from devex import DevExClient

client = DevExClient(
    api_key='your-api-key',
    base_url='https://api.dev-ex.platform/v1'
)

# Send a message
response = client.chat.send_message(
    session_id='session-id',
    message='Help me with my project'
)
```

### cURL
```bash
# Login
curl -X POST https://api.dev-ex.platform/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Send message
curl -X POST https://api.dev-ex.platform/v1/chat/message \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"uuid","message":"Hello"}'
```

## Pagination

List endpoints support pagination using `limit` and `offset`:
```
GET /api/v1/chat/sessions?limit=10&offset=20
```

## Filtering & Sorting

Some endpoints support filtering and sorting:
```
GET /api/v1/chat/sessions?status=active&sort=-created_at
```

Sort prefixes:
- No prefix or `+` - Ascending order
- `-` prefix - Descending order

## API Versioning

The API uses URL versioning:
- Current version: `v1`
- Beta features: `v1-beta`
- Deprecated endpoints will be marked with `Deprecation` headers

## Support

For API support:
- Documentation: https://docs.dev-ex.platform
- Status Page: https://status.dev-ex.platform
- Support Email: api-support@dev-ex.platform