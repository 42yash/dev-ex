# Frontend Implementation Guide

## Overview

The Dev-Ex frontend is built with Vue.js 3, implementing a dynamic Single Page Application (SPA) with a widget-based architecture. The interface emphasizes functionality, clarity, and minimalism with a "Hyprland rice" aesthetic.

## Technology Stack

- **Framework**: Vue.js 3 with Composition API
- **Language**: TypeScript
- **State Management**: Pinia
- **Communication**: gRPC-Web
- **Build Tool**: Vite
- **Styling**: CSS Modules with PostCSS

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   ├── views/           # Page components
│   ├── stores/          # Pinia stores
│   ├── services/        # API services
│   ├── widgets/         # Dynamic widget components
│   ├── composables/     # Vue composables
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript definitions
│   └── assets/          # Static assets
├── proto/               # Protocol Buffer definitions
├── tests/              # Test files
└── public/             # Public assets
```

## Core Components

### Application Structure

```typescript
// Main App Component
export default defineComponent({
  name: 'DocumentationQA',
  setup() {
    const store = useAppStore();
    const { currentTheme } = useTheme();
    
    const layoutConfig = computed(() => ({
      theme: currentTheme.value,
      layout: store.ui.layout,
      widgets: store.widgets.active
    }));
    
    return {
      layoutConfig,
      handleCommand: (cmd: Command) => store.dispatch('executeCommand', cmd),
      handleWidgetAction: (action: WidgetAction) => store.dispatch('widgetAction', action)
    };
  }
});
```

### Component Architecture

#### Container Components (Smart)

Container components manage state and business logic:

```typescript
// ChatView.vue
<template>
  <div class="chat-view">
    <ChatHeader :session="currentSession" />
    <MessageList :messages="messages" />
    <WidgetContainer :widgets="activeWidgets" />
    <MessageInput @send="sendMessage" />
  </div>
</template>

<script setup lang="ts">
import { useSessionStore } from '@/stores/session';
import { useChatService } from '@/services/chat';

const sessionStore = useSessionStore();
const chatService = useChatService();

const currentSession = computed(() => sessionStore.currentSession);
const messages = computed(() => sessionStore.messages);
const activeWidgets = computed(() => sessionStore.widgets);

async function sendMessage(text: string) {
  await chatService.sendMessage(text);
}
</script>
```

#### Presentational Components (Dumb)

Presentational components focus on UI rendering:

```typescript
// ChatMessage.vue
<template>
  <div class="message" :class="messageClass">
    <div class="message-avatar">
      <img :src="avatarUrl" :alt="message.sender" />
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="sender">{{ message.sender }}</span>
        <span class="timestamp">{{ formattedTime }}</span>
      </div>
      <div class="message-text" v-html="processedContent" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatTime, processMarkdown } from '@/utils';

const props = defineProps<{
  message: Message;
}>();

const messageClass = computed(() => ({
  'message--user': props.message.sender === 'user',
  'message--ai': props.message.sender === 'ai'
}));

const formattedTime = computed(() => 
  formatTime(props.message.timestamp)
);

const processedContent = computed(() => 
  processMarkdown(props.message.content)
);
</script>
```

## Dynamic Widget System

### Widget Manager

```typescript
class WidgetManager {
  private registry: Map<string, WidgetDefinition> = new Map();
  private activeWidgets: Map<string, WidgetInstance> = new Map();
  
  registerWidget(definition: WidgetDefinition): void {
    this.registry.set(definition.type, definition);
  }
  
  async loadWidget(type: string, config: WidgetConfig): Promise<string> {
    const definition = this.registry.get(type);
    if (!definition) throw new Error(`Unknown widget type: ${type}`);
    
    const instance = await this.createInstance(definition, config);
    const id = nanoid();
    this.activeWidgets.set(id, instance);
    
    return id;
  }
  
  hotSwapWidget(oldId: string, newType: string, config: WidgetConfig): void {
    const oldWidget = this.activeWidgets.get(oldId);
    if (oldWidget) {
      oldWidget.cleanup();
      this.activeWidgets.delete(oldId);
    }
    
    this.loadWidget(newType, config);
  }
}
```

### Widget Components

#### MCQ Selector Widget

```vue
<template>
  <div class="widget-mcq">
    <h3 class="widget-title">{{ title }}</h3>
    <div class="options-grid">
      <div 
        v-for="option in options" 
        :key="option.id"
        @click="selectOption(option)"
        class="option-card"
        :class="{ 'option-card--selected': selectedId === option.id }"
      >
        <div class="option-header">
          <Icon :name="option.icon" />
          <h4>{{ option.title }}</h4>
        </div>
        <p class="option-description">{{ option.description }}</p>
        <div class="option-metadata">
          <div class="pros">
            <span class="label">Pros:</span>
            <ul>
              <li v-for="pro in option.pros" :key="pro">{{ pro }}</li>
            </ul>
          </div>
          <div class="cons">
            <span class="label">Cons:</span>
            <ul>
              <li v-for="con in option.cons" :key="con">{{ con }}</li>
            </ul>
          </div>
        </div>
        <div class="option-footer">
          <Badge :text="option.complexity" :color="complexityColor(option.complexity)" />
          <span class="cost">{{ option.cost }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  title: string;
  options: PathwayOption[];
  onSelect: (option: PathwayOption) => void;
}>();

const selectedId = ref<string | null>(null);

function selectOption(option: PathwayOption) {
  selectedId.value = option.id;
  props.onSelect(option);
}

function complexityColor(complexity: string): string {
  const colors: Record<string, string> = {
    'Low': 'green',
    'Medium': 'yellow',
    'High': 'red'
  };
  return colors[complexity] || 'gray';
}
</script>
```

## State Management with Pinia

### Store Structure

```typescript
// stores/session.ts
export const useSessionStore = defineStore('session', () => {
  // State
  const sessions = ref<Session[]>([]);
  const currentSessionId = ref<string | null>(null);
  const messages = ref<Message[]>([]);
  const widgets = ref<Widget[]>([]);
  
  // Getters
  const currentSession = computed(() => 
    sessions.value.find(s => s.id === currentSessionId.value)
  );
  
  const sortedMessages = computed(() => 
    [...messages.value].sort((a, b) => a.timestamp - b.timestamp)
  );
  
  // Actions
  async function createSession(): Promise<Session> {
    const session = await api.createSession();
    sessions.value.push(session);
    currentSessionId.value = session.id;
    return session;
  }
  
  async function sendMessage(text: string): Promise<void> {
    if (!currentSessionId.value) {
      await createSession();
    }
    
    const message: Message = {
      id: nanoid(),
      sessionId: currentSessionId.value!,
      sender: 'user',
      content: text,
      timestamp: Date.now()
    };
    
    messages.value.push(message);
    
    // Send to backend
    const response = await api.sendMessage(currentSessionId.value!, text);
    
    // Add AI response
    messages.value.push({
      id: response.id,
      sessionId: currentSessionId.value!,
      sender: 'ai',
      content: response.content,
      timestamp: Date.now()
    });
    
    // Load any widgets
    if (response.widgets) {
      widgets.value = response.widgets;
    }
  }
  
  return {
    sessions,
    currentSessionId,
    messages,
    widgets,
    currentSession,
    sortedMessages,
    createSession,
    sendMessage
  };
});
```

## gRPC-Web Integration

### Protocol Buffer Compilation

```bash
# Compile .proto files to TypeScript
protoc \
  --plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts \
  --plugin=protoc-gen-grpc-web=./node_modules/.bin/protoc-gen-grpc-web \
  --js_out=import_style=commonjs:./src/generated \
  --ts_out=./src/generated \
  --grpc-web_out=import_style=typescript,mode=grpcwebtext:./src/generated \
  ./proto/*.proto
```

### Service Client

```typescript
// services/chat.ts
import { ChatServiceClient } from '@/generated/chat_grpc_web_pb';
import { SendMessageRequest, SendMessageResponse } from '@/generated/chat_pb';

export class ChatService {
  private client: ChatServiceClient;
  
  constructor(apiUrl: string) {
    this.client = new ChatServiceClient(apiUrl);
  }
  
  async sendMessage(
    sessionId: string, 
    message: string
  ): Promise<SendMessageResponse> {
    const request = new SendMessageRequest();
    request.setSessionId(sessionId);
    request.setMessage(message);
    
    return new Promise((resolve, reject) => {
      const metadata = this.getAuthMetadata();
      
      this.client.sendMessage(request, metadata, (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    });
  }
  
  private getAuthMetadata(): grpc.Metadata {
    const metadata = new grpc.Metadata();
    const token = localStorage.getItem('auth_token');
    if (token) {
      metadata.set('authorization', `Bearer ${token}`);
    }
    return metadata;
  }
}
```

## Command Center

### Implementation

```typescript
class CommandCenter {
  private commands: Map<string, CommandHandler> = new Map();
  private shortcuts: Map<string, string> = new Map();
  private isOpen = ref(false);
  
  constructor() {
    this.registerDefaultCommands();
    this.setupKeyboardListeners();
  }
  
  private registerDefaultCommands(): void {
    // Search command
    this.register('search', {
      pattern: /^(search|find)\s+(.+)$/i,
      description: 'Search documentation',
      handler: async (match) => {
        const query = match[2];
        return await this.searchDocumentation(query);
      }
    });
    
    // Switch connector command
    this.register('switch-connector', {
      pattern: /^switch\s+to\s+(\w+)$/i,
      description: 'Switch documentation connector',
      handler: async (match) => {
        const connector = match[1];
        return await this.switchConnector(connector);
      }
    });
    
    // Theme command
    this.register('theme', {
      pattern: /^theme\s+(dark|light|auto)$/i,
      description: 'Change theme',
      handler: async (match) => {
        const theme = match[1];
        return await this.setTheme(theme);
      }
    });
  }
  
  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => {
      // Ctrl+K to open command center
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.toggle();
      }
      
      // Escape to close
      if (e.key === 'Escape' && this.isOpen.value) {
        this.close();
      }
    });
  }
  
  public execute(input: string): Promise<CommandResult> {
    for (const [name, handler] of this.commands) {
      const match = input.match(handler.pattern);
      if (match) {
        return handler.handler(match);
      }
    }
    
    return Promise.resolve({
      success: false,
      message: `Unknown command: ${input}`
    });
  }
}
```

## Styling and Theming

### Theme System

```typescript
// composables/useTheme.ts
export function useTheme() {
  const currentTheme = ref<Theme>('dark');
  
  const themes = {
    dark: {
      '--bg-primary': '#0a0a0a',
      '--bg-secondary': '#1a1a1a',
      '--text-primary': '#e0e0e0',
      '--text-secondary': '#a0a0a0',
      '--accent': '#00ff88',
      '--border': '#333333'
    },
    light: {
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f5f5f5',
      '--text-primary': '#1a1a1a',
      '--text-secondary': '#666666',
      '--accent': '#0066ff',
      '--border': '#e0e0e0'
    }
  };
  
  function applyTheme(theme: Theme) {
    const root = document.documentElement;
    const themeVars = themes[theme];
    
    Object.entries(themeVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
    currentTheme.value = theme;
    localStorage.setItem('theme', theme);
  }
  
  // Initialize theme on mount
  onMounted(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    applyTheme(savedTheme || 'dark');
  });
  
  return {
    currentTheme,
    applyTheme,
    themes
  };
}
```

### Component Styling

```vue
<style module>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.message {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  animation: slideIn 0.3s ease-out;
}

.message--user {
  background: var(--bg-secondary);
  align-self: flex-end;
}

.message--ai {
  background: linear-gradient(135deg, var(--bg-secondary), transparent);
  border: 1px solid var(--border);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Hyprland-inspired rounded corners and effects */
.widget {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}
</style>
```

## Testing

### Unit Tests

```typescript
// tests/components/ChatMessage.test.ts
import { mount } from '@vue/test-utils';
import ChatMessage from '@/components/ChatMessage.vue';

describe('ChatMessage', () => {
  it('renders user message correctly', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: '1',
          sender: 'user',
          content: 'Hello, AI!',
          timestamp: Date.now()
        }
      }
    });
    
    expect(wrapper.find('.message--user').exists()).toBe(true);
    expect(wrapper.text()).toContain('Hello, AI!');
  });
  
  it('processes markdown content', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: '2',
          sender: 'ai',
          content: '**Bold** and *italic*',
          timestamp: Date.now()
        }
      }
    });
    
    const content = wrapper.find('.message-text');
    expect(content.html()).toContain('<strong>Bold</strong>');
    expect(content.html()).toContain('<em>italic</em>');
  });
});
```

### Integration Tests

```typescript
// tests/services/chat.test.ts
import { ChatService } from '@/services/chat';
import { mockGrpcClient } from '../mocks/grpc';

describe('ChatService', () => {
  let service: ChatService;
  
  beforeEach(() => {
    service = new ChatService('http://localhost:8080');
    service.client = mockGrpcClient;
  });
  
  it('sends message successfully', async () => {
    const response = await service.sendMessage('session-1', 'Test message');
    
    expect(response.getContent()).toBe('AI response');
    expect(response.getWidgetsList()).toHaveLength(1);
  });
});
```

## Performance Optimization

### Lazy Loading

```typescript
// router/index.ts
const routes = [
  {
    path: '/',
    component: () => import('@/views/HomeView.vue')
  },
  {
    path: '/chat',
    component: () => import('@/views/ChatView.vue')
  },
  {
    path: '/settings',
    component: () => import('@/views/SettingsView.vue')
  }
];
```

### Virtual Scrolling

```vue
<template>
  <VirtualList
    :items="messages"
    :item-height="80"
    :buffer="5"
    class="message-list"
  >
    <template #default="{ item }">
      <ChatMessage :message="item" />
    </template>
  </VirtualList>
</template>
```

## Build Configuration

### Vite Config

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@proto': resolve(__dirname, 'proto')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'pinia'],
          'grpc': ['grpc-web'],
          'widgets': ['@/widgets']
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
});
```

## Development Workflow

### Setup

```bash
# Install dependencies
npm install

# Generate gRPC code
npm run proto:generate

# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

### Hot Module Replacement

```typescript
// Enable HMR for Pinia stores
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSessionStore, import.meta.hot));
}
```

## Best Practices

1. **Component Organization**: Keep components small and focused
2. **Type Safety**: Use TypeScript strictly
3. **State Management**: Use Pinia stores for shared state
4. **Performance**: Implement lazy loading and virtual scrolling
5. **Testing**: Write tests for critical paths
6. **Accessibility**: Include ARIA labels and keyboard navigation

## Related Documentation

- [Backend Implementation](backend.md)
- [AI Services Implementation](ai-services.md)
- [Widget Development Guide](../guides/widget-development.md)
- [Frontend Testing Guide](../guides/frontend-testing.md)