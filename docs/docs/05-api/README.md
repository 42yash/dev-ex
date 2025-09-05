---
title: CodeCraft API Reference
tags: [api, reference, technical, endpoints]
created: 2025-01-09
updated: 2025-01-09
---

# 🔌 CodeCraft API Reference

> **The Protocols of Power**

## 📡 Communication Channels

CodeCraft uses three primary communication protocols:
1. **REST API** - Traditional HTTP endpoints
2. **WebSocket** - Real-time bidirectional communication
3. **gRPC** - High-performance service communication

## 🌐 REST API Endpoints

### Base URL
```
Development: http://localhost:3000/api
Production: https://api.codecraft.dev
```

### Authentication
```http
Authorization: Bearer <jwt-token>
X-Player-ID: <player-uuid>
X-Session-ID: <session-uuid>
```

### Player Endpoints

#### Register Player
```http
POST /player/register
Content-Type: application/json

{
  "username": "HeroicCoder",
  "email": "hero@example.com",
  "class": "frontend_wizard"
}

Response: 201 Created
{
  "playerId": "uuid",
  "username": "HeroicCoder",
  "level": 1,
  "xp": 0,
  "token": "jwt-token"
}
```

#### Get Player Profile
```http
GET /player/profile
Authorization: Bearer <token>

Response: 200 OK
{
  "playerId": "uuid",
  "username": "HeroicCoder",
  "level": 15,
  "xp": 4250,
  "class": "frontend_wizard",
  "achievements": [...],
  "stats": {...}
}
```

### Quest Endpoints

#### Get Available Quests
```http
GET /quests
Authorization: Bearer <token>

Response: 200 OK
{
  "quests": [
    {
      "questId": "uuid",
      "title": "Authentication System",
      "difficulty": 4,
      "xpReward": 500,
      "requirements": {...},
      "objectives": [...]
    }
  ]
}
```

#### Start Quest
```http
POST /quest/start
Authorization: Bearer <token>

{
  "questId": "uuid"
}

Response: 200 OK
{
  "questInstance": "uuid",
  "status": "active",
  "objectives": [...],
  "currentObjective": 0
}
```

### Session Endpoints

#### Create Session
```http
POST /sessions
Authorization: Bearer <token>

{
  "title": "New Adventure"
}

Response: 201 Created
{
  "sessionId": "uuid",
  "title": "New Adventure",
  "created": "2025-01-09T10:00:00Z"
}
```

#### Send Message
```http
POST /chat/send
Authorization: Bearer <token>

{
  "sessionId": "uuid",
  "message": "Create a React component",
  "context": {...}
}

Response: 200 OK
{
  "messageId": "uuid",
  "response": "Let me help you craft that component...",
  "widgets": [...],
  "xpEarned": 25
}
```

## 🔄 WebSocket Events

### Connection
```javascript
const socket = io('ws://localhost:3000', {
  auth: {
    token: 'jwt-token'
  }
});
```

### Client → Server Events

#### Send Message
```javascript
socket.emit('message', {
  sessionId: 'uuid',
  content: 'Help me debug this',
  widgetInteraction: null
});
```

#### Widget Interaction
```javascript
socket.emit('widget:interact', {
  widgetId: 'uuid',
  action: 'submit',
  data: {
    // Widget-specific data
  }
});
```

#### Quest Action
```javascript
socket.emit('quest:action', {
  questId: 'uuid',
  action: 'complete_objective',
  objectiveId: 'uuid'
});
```

### Server → Client Events

#### Message Stream
```javascript
socket.on('message:stream', (data) => {
  // Streaming response chunks
  console.log(data.chunk);
});
```

#### XP Gained
```javascript
socket.on('xp:gained', (data) => {
  // { amount: 50, total: 1250, source: 'code_execution' }
});
```

#### Level Up
```javascript
socket.on('level:up', (data) => {
  // { newLevel: 6, unlockedFeatures: [...] }
});
```

#### Achievement Unlocked
```javascript
socket.on('achievement:unlocked', (achievement) => {
  // { id: 'bug_slayer', name: 'Bug Slayer', xpBonus: 100 }
});
```

## ⚡ gRPC Services

### Protocol Buffer Definitions

```protobuf
syntax = "proto3";

package codecraft;

service CodeCraftService {
  rpc Chat(ChatRequest) returns (stream ChatResponse);
  rpc ExecuteCode(CodeRequest) returns (CodeResponse);
  rpc ProcessWidget(WidgetRequest) returns (WidgetResponse);
  rpc GetAgentResponse(AgentRequest) returns (stream AgentResponse);
}

message ChatRequest {
  string session_id = 1;
  string message = 2;
  string player_id = 3;
  map<string, string> context = 4;
}

message ChatResponse {
  string message_id = 1;
  string content = 2;
  repeated Widget widgets = 3;
  int32 xp_earned = 4;
  string agent_id = 5;
}

message Widget {
  string widget_id = 1;
  string type = 2;
  google.protobuf.Any data = 3;
  repeated string actions = 4;
}

message CodeRequest {
  string code = 1;
  string language = 2;
  map<string, string> environment = 3;
}

message CodeResponse {
  string output = 1;
  string error = 2;
  int32 execution_time = 3;
  int32 memory_used = 4;
}
```

### gRPC Client Usage

```python
import grpc
import codecraft_pb2
import codecraft_pb2_grpc

# Connect to gRPC server
channel = grpc.insecure_channel('localhost:50051')
stub = codecraft_pb2_grpc.CodeCraftServiceStub(channel)

# Make request
request = codecraft_pb2.ChatRequest(
    session_id='uuid',
    message='Help me create a function',
    player_id='player-uuid'
)

# Stream response
for response in stub.Chat(request):
    print(response.content)
    if response.widgets:
        process_widgets(response.widgets)
```

## 📊 Widget API

### Widget Request Structure
```typescript
interface WidgetRequest {
  widgetId: string
  type: WidgetType
  action: WidgetAction
  data: any
  metadata: {
    playerId: string
    sessionId: string
    timestamp: number
  }
}

enum WidgetType {
  CODE_EDITOR = 'code_editor',
  FORM = 'form',
  QUIZ = 'quiz',
  CHART = 'chart',
  // ... more types
}

enum WidgetAction {
  INIT = 'init',
  INTERACT = 'interact',
  SUBMIT = 'submit',
  CLOSE = 'close'
}
```

### Widget Response Structure
```typescript
interface WidgetResponse {
  widgetId: string
  status: 'success' | 'error' | 'pending'
  result?: any
  updates?: WidgetUpdate[]
  xpEarned?: number
  achievement?: string
}

interface WidgetUpdate {
  property: string
  value: any
  animate?: boolean
}
```

## 🔒 Error Handling

### Error Response Format
```json
{
  "error": {
    "code": "QUEST_NOT_FOUND",
    "message": "The requested quest does not exist",
    "details": {
      "questId": "invalid-uuid"
    }
  },
  "status": 404
}
```

### Common Error Codes
- `AUTH_REQUIRED` - Authentication missing
- `AUTH_INVALID` - Invalid token
- `PLAYER_NOT_FOUND` - Player doesn't exist
- `QUEST_NOT_FOUND` - Quest doesn't exist
- `QUEST_LOCKED` - Requirements not met
- `RATE_LIMIT` - Too many requests
- `SERVER_ERROR` - Internal error

## 📈 Rate Limiting

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

Limits:
- **Anonymous**: 10 requests/minute
- **Authenticated**: 100 requests/minute
- **Premium**: 1000 requests/minute

## 🔗 Related Documentation

- [Platform Architecture](../01-platform/README.md)
- [Widget System](../02-widgets/README.md)
- [Current Implementation](../04-implementation/current-state.md)

---

*"Every API call is a spell invocation, every response a manifestation of digital magic."*