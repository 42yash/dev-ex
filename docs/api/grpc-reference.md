# gRPC API Reference

## Overview

The Dev-Ex platform uses gRPC with Protocol Buffers for efficient inter-service communication. This document provides a complete reference for all gRPC services and messages.

## Protocol Buffer Definitions

### Package Structure

```
devex.api.v1/
├── chat.proto       # Chat service definitions
├── docs.proto       # Documentation service
├── agent.proto      # Agent orchestration
├── common.proto     # Shared message types
└── connector.proto  # Connector management
```

## Chat Service

### Service Definition

```protobuf
syntax = "proto3";
package devex.api.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/struct.proto";

service ChatService {
    // Send a message to the chat system
    rpc SendMessage(SendMessageRequest) returns (SendMessageResponse);
    
    // Stream responses for real-time updates
    rpc StreamResponse(StreamRequest) returns (stream StreamResponse);
    
    // Get chat history for a session
    rpc GetHistory(GetHistoryRequest) returns (GetHistoryResponse);
    
    // Create a new chat session
    rpc CreateSession(CreateSessionRequest) returns (CreateSessionResponse);
    
    // End a chat session
    rpc EndSession(EndSessionRequest) returns (EndSessionResponse);
}
```

### Message Definitions

#### SendMessageRequest

```protobuf
message SendMessageRequest {
    string session_id = 1;           // Required: Session identifier
    string message = 2;               // Required: User message text
    map<string, string> context = 3; // Optional: Additional context
    MessageOptions options = 4;      // Optional: Message processing options
}

message MessageOptions {
    bool stream = 1;                 // Enable streaming response
    string preferred_connector = 2;  // Preferred documentation source
    int32 max_tokens = 3;           // Maximum response tokens
    float temperature = 4;           // LLM temperature (0.0-1.0)
}
```

#### SendMessageResponse

```protobuf
message SendMessageResponse {
    string response_id = 1;          // Unique response identifier
    string content = 2;              // Response content
    repeated Widget widgets = 3;     // Interactive widgets
    repeated Action suggested_actions = 4; // Suggested next actions
    ResponseMetadata metadata = 5;  // Response metadata
}

message Widget {
    string type = 1;                 // Widget type (mcq, code, diagram)
    string widget_id = 2;            // Unique widget identifier
    google.protobuf.Struct config = 3; // Widget configuration
    google.protobuf.Struct data = 4;   // Widget data
}

message Action {
    string action_id = 1;            // Action identifier
    string label = 2;                // Display label
    string description = 3;          // Action description
    ActionType type = 4;             // Action type
    map<string, string> params = 5; // Action parameters
}

enum ActionType {
    ACTION_TYPE_UNSPECIFIED = 0;
    ACTION_TYPE_NAVIGATE = 1;        // Navigate to different section
    ACTION_TYPE_EXECUTE = 2;         // Execute command
    ACTION_TYPE_EXPAND = 3;          // Expand for more details
    ACTION_TYPE_EXTERNAL = 4;        // External link
}
```

## Documentation Service

### Service Definition

```protobuf
service DocumentationService {
    // Search documentation
    rpc Search(SearchRequest) returns (SearchResponse);
    
    // Get specific document
    rpc GetDocument(GetDocumentRequest) returns (GetDocumentResponse);
    
    // List available connectors
    rpc ListConnectors(ListConnectorsRequest) returns (ListConnectorsResponse);
    
    // Sync connector data
    rpc SyncConnector(SyncConnectorRequest) returns (SyncConnectorResponse);
    
    // Get connector status
    rpc GetConnectorStatus(GetConnectorStatusRequest) returns (GetConnectorStatusResponse);
}
```

### Search Operations

#### SearchRequest

```protobuf
message SearchRequest {
    string query = 1;                // Required: Search query
    string connector = 2;            // Optional: Specific connector
    SearchOptions options = 3;       // Optional: Search options
}

message SearchOptions {
    int32 limit = 1;                // Maximum results (default: 10)
    float similarity_threshold = 2;  // Minimum similarity (0.0-1.0)
    repeated string filter_tags = 3; // Filter by tags
    bool include_code = 4;           // Include code examples
    bool include_metadata = 5;       // Include document metadata
}
```

#### SearchResponse

```protobuf
message SearchResponse {
    repeated SearchResult results = 1; // Search results
    SearchMetadata metadata = 2;       // Search metadata
}

message SearchResult {
    string chunk_id = 1;             // Chunk identifier
    string content = 2;              // Content snippet
    string document_title = 3;       // Source document title
    float similarity_score = 4;      // Similarity score (0.0-1.0)
    map<string, string> metadata = 5; // Additional metadata
    HighlightedContent highlights = 6; // Highlighted matches
}

message HighlightedContent {
    repeated TextRange ranges = 1;   // Highlighted text ranges
    string formatted_html = 2;       // HTML with highlights
}

message TextRange {
    int32 start = 1;                // Start position
    int32 end = 2;                  // End position
}
```

## Agent Service

### Service Definition

```protobuf
service AgentService {
    // Execute an agent
    rpc ExecuteAgent(ExecuteAgentRequest) returns (ExecuteAgentResponse);
    
    // Get agent status
    rpc GetAgentStatus(GetAgentStatusRequest) returns (GetAgentStatusResponse);
    
    // List available agents
    rpc ListAgents(ListAgentsRequest) returns (ListAgentsResponse);
    
    // Create custom agent
    rpc CreateAgent(CreateAgentRequest) returns (CreateAgentResponse);
}
```

### Agent Execution

#### ExecuteAgentRequest

```protobuf
message ExecuteAgentRequest {
    string agent_id = 1;             // Required: Agent identifier
    google.protobuf.Struct input = 2; // Required: Agent input
    ExecutionContext context = 3;    // Required: Execution context
    AgentConfig config = 4;          // Optional: Agent configuration
}

message ExecutionContext {
    string session_id = 1;           // Session identifier
    string user_id = 2;              // User identifier
    repeated string previous_agents = 3; // Previously executed agents
    map<string, string> variables = 4; // Context variables
}

message AgentConfig {
    string model = 1;                // LLM model to use
    float temperature = 2;           // Temperature setting
    int32 max_tokens = 3;           // Maximum tokens
    int32 timeout_seconds = 4;      // Execution timeout
}
```

#### ExecuteAgentResponse

```protobuf
message ExecuteAgentResponse {
    string execution_id = 1;         // Execution identifier
    AgentOutput output = 2;          // Agent output
    ExecutionStatus status = 3;      // Execution status
    repeated LogEntry logs = 4;      // Execution logs
}

message AgentOutput {
    google.protobuf.Struct data = 1; // Output data
    repeated Artifact artifacts = 2; // Generated artifacts
    map<string, string> metadata = 3; // Output metadata
}

message Artifact {
    string name = 1;                 // Artifact name
    string type = 2;                 // MIME type
    bytes content = 3;               // Artifact content
    map<string, string> metadata = 4; // Artifact metadata
}
```

## Connector Service

### Service Definition

```protobuf
service ConnectorService {
    // Register a new connector
    rpc RegisterConnector(RegisterConnectorRequest) returns (RegisterConnectorResponse);
    
    // Update connector configuration
    rpc UpdateConnector(UpdateConnectorRequest) returns (UpdateConnectorResponse);
    
    // Delete a connector
    rpc DeleteConnector(DeleteConnectorRequest) returns (DeleteConnectorResponse);
    
    // Sync connector data
    rpc SyncConnector(SyncConnectorRequest) returns (stream SyncProgress);
}
```

### Connector Management

#### RegisterConnectorRequest

```protobuf
message RegisterConnectorRequest {
    ConnectorConfig config = 1;      // Required: Connector configuration
}

message ConnectorConfig {
    string name = 1;                 // Connector name
    string type = 2;                 // Connector type
    map<string, string> settings = 3; // Connector settings
    SyncSchedule schedule = 4;       // Sync schedule
}

message SyncSchedule {
    string cron_expression = 1;      // Cron expression
    int32 interval_minutes = 2;      // Alternative: interval
    bool enabled = 3;                // Schedule enabled
}
```

## Common Types

### Error Handling

```protobuf
message Error {
    int32 code = 1;                  // Error code
    string message = 2;              // Error message
    string details = 3;              // Detailed error information
    google.protobuf.Timestamp timestamp = 4; // Error timestamp
    map<string, string> metadata = 5; // Additional context
}

enum ErrorCode {
    ERROR_CODE_UNSPECIFIED = 0;
    ERROR_CODE_INVALID_REQUEST = 1;
    ERROR_CODE_NOT_FOUND = 2;
    ERROR_CODE_PERMISSION_DENIED = 3;
    ERROR_CODE_RATE_LIMITED = 4;
    ERROR_CODE_INTERNAL = 5;
    ERROR_CODE_UNAVAILABLE = 6;
    ERROR_CODE_TIMEOUT = 7;
}
```

### Pagination

```protobuf
message PageRequest {
    int32 page_size = 1;             // Items per page
    string page_token = 2;           // Pagination token
}

message PageResponse {
    string next_page_token = 1;      // Next page token
    int32 total_items = 2;           // Total items available
}
```

## Authentication

All gRPC calls require authentication via metadata:

```javascript
// JavaScript/TypeScript client example
const metadata = new grpc.Metadata();
metadata.set('authorization', `Bearer ${authToken}`);

client.sendMessage(request, metadata, (error, response) => {
    // Handle response
});
```

```python
# Python client example
metadata = [('authorization', f'Bearer {auth_token}')]
response = stub.SendMessage(request, metadata=metadata)
```

## Rate Limiting

Rate limit information is returned in response metadata:

```
x-ratelimit-limit: 100
x-ratelimit-remaining: 95
x-ratelimit-reset: 1640995200
```

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 0 | OK | Success |
| 1 | CANCELLED | Operation cancelled |
| 3 | INVALID_ARGUMENT | Invalid request |
| 5 | NOT_FOUND | Resource not found |
| 7 | PERMISSION_DENIED | Permission denied |
| 8 | RESOURCE_EXHAUSTED | Rate limit exceeded |
| 13 | INTERNAL | Internal server error |
| 14 | UNAVAILABLE | Service unavailable |

## Client Examples

### Python Client

```python
import grpc
from devex.api.v1 import chat_pb2, chat_pb2_grpc

# Create channel and stub
channel = grpc.insecure_channel('localhost:50051')
stub = chat_pb2_grpc.ChatServiceStub(channel)

# Create request
request = chat_pb2.SendMessageRequest(
    session_id="session-123",
    message="How do I deploy to AWS?",
    options=chat_pb2.MessageOptions(
        stream=False,
        max_tokens=1000
    )
)

# Send request
metadata = [('authorization', f'Bearer {token}')]
response = stub.SendMessage(request, metadata=metadata)

print(f"Response: {response.content}")
```

### Node.js Client

```javascript
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// Load proto
const packageDefinition = protoLoader.loadSync('chat.proto');
const proto = grpc.loadPackageDefinition(packageDefinition);

// Create client
const client = new proto.devex.api.v1.ChatService(
    'localhost:50051',
    grpc.credentials.createInsecure()
);

// Create request
const request = {
    session_id: 'session-123',
    message: 'How do I deploy to AWS?',
    options: {
        stream: false,
        max_tokens: 1000
    }
};

// Send request
const metadata = new grpc.Metadata();
metadata.set('authorization', `Bearer ${token}`);

client.sendMessage(request, metadata, (error, response) => {
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Response:', response.content);
    }
});
```

### Go Client

```go
package main

import (
    "context"
    "log"
    
    "google.golang.org/grpc"
    "google.golang.org/grpc/metadata"
    pb "github.com/your-org/devex/api/v1"
)

func main() {
    // Create connection
    conn, err := grpc.Dial("localhost:50051", grpc.WithInsecure())
    if err != nil {
        log.Fatalf("Failed to connect: %v", err)
    }
    defer conn.Close()
    
    // Create client
    client := pb.NewChatServiceClient(conn)
    
    // Create context with auth
    ctx := metadata.AppendToOutgoingContext(
        context.Background(),
        "authorization", "Bearer "+token,
    )
    
    // Create request
    request := &pb.SendMessageRequest{
        SessionId: "session-123",
        Message: "How do I deploy to AWS?",
        Options: &pb.MessageOptions{
            Stream: false,
            MaxTokens: 1000,
        },
    }
    
    // Send request
    response, err := client.SendMessage(ctx, request)
    if err != nil {
        log.Fatalf("Error: %v", err)
    }
    
    log.Printf("Response: %s", response.Content)
}
```

## Streaming Example

### Server-side Streaming

```python
# Python streaming client
def stream_responses(stub, session_id):
    request = chat_pb2.StreamRequest(session_id=session_id)
    metadata = [('authorization', f'Bearer {token}')]
    
    for response in stub.StreamResponse(request, metadata=metadata):
        print(f"Received: {response.content}")
        
        # Process widgets if present
        for widget in response.widgets:
            process_widget(widget)
```

### Bidirectional Streaming

```javascript
// Node.js bidirectional streaming
const call = client.chat();

// Send messages
call.write({ message: 'Hello' });
call.write({ message: 'How are you?' });

// Receive responses
call.on('data', (response) => {
    console.log('Received:', response);
});

call.on('end', () => {
    console.log('Stream ended');
});
```

## Testing

### Using grpcurl

```bash
# List services
grpcurl -plaintext localhost:50051 list

# Describe service
grpcurl -plaintext localhost:50051 describe devex.api.v1.ChatService

# Call method
grpcurl -plaintext \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "session_id": "test-session",
    "message": "Hello"
  }' \
  localhost:50051 devex.api.v1.ChatService/SendMessage
```

## Performance Considerations

1. **Connection Pooling**: Reuse gRPC channels
2. **Deadlines**: Set appropriate deadlines for calls
3. **Retry Logic**: Implement exponential backoff
4. **Compression**: Enable gzip compression for large payloads
5. **Streaming**: Use streaming for real-time updates

## Security

1. **TLS**: Always use TLS in production
2. **Authentication**: JWT tokens in metadata
3. **Rate Limiting**: Respect rate limits
4. **Input Validation**: Validate all inputs
5. **Timeouts**: Set appropriate timeouts

## Related Documentation

- [Protocol Buffer Style Guide](https://developers.google.com/protocol-buffers/docs/style)
- [gRPC Best Practices](https://grpc.io/docs/guides/performance/)
- [Authentication Guide](../guides/authentication.md)
- [Error Handling Guide](../guides/error-handling.md)