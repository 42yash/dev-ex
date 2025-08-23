import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// gRPC client instances
let chatClient: any = null
let aiClient: any = null

const PROTO_PATH = path.join(__dirname, '../../../../proto')

export async function initializeGrpcClients(): Promise<void> {
  try {
    // Load proto files
    const chatProtoPath = path.join(PROTO_PATH, 'chat.proto')
    const commonProtoPath = path.join(PROTO_PATH, 'common.proto')
    
    const packageDefinition = protoLoader.loadSync(
      [chatProtoPath, commonProtoPath],
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [PROTO_PATH]
      }
    )
    
    const proto = grpc.loadPackageDefinition(packageDefinition) as any
    
    // Create client for AI service
    const ChatService = proto.devex.api.v1.ChatService
    
    chatClient = new ChatService(
      config.grpc.aiServiceUrl,
      grpc.credentials.createInsecure(),
      {
        'grpc.max_send_message_length': 50 * 1024 * 1024,
        'grpc.max_receive_message_length': 50 * 1024 * 1024,
      }
    )
    
    logger.info('gRPC clients initialized')
  } catch (error) {
    logger.error('Failed to initialize gRPC clients:', error)
    // Don't throw error in development to allow API to start without AI service
    if (config.app.env === 'production') {
      throw error
    }
  }
}

export function getChatClient() {
  return chatClient
}

export async function checkGrpcHealth(): Promise<boolean> {
  try {
    if (!chatClient) return false
    
    // Try to check health with a deadline
    return new Promise((resolve) => {
      const deadline = new Date()
      deadline.setSeconds(deadline.getSeconds() + 5)
      
      // Since we don't have health check implemented yet, just check if client exists
      // In production, you would call a health check RPC
      resolve(chatClient !== null)
    })
  } catch (error) {
    logger.error('gRPC health check failed:', error)
    return false
  }
}

// Helper function to create metadata with auth
export function createMetadata(token?: string): grpc.Metadata {
  const metadata = new grpc.Metadata()
  if (token) {
    metadata.set('authorization', `Bearer ${token}`)
  }
  return metadata
}

// Chat service wrapper functions
export async function sendMessage(
  sessionId: string,
  message: string,
  options?: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!chatClient) {
      reject(new Error('Chat service not available'))
      return
    }
    
    const request = {
      session_id: sessionId,
      message: message,
      options: options || {}
    }
    
    chatClient.SendMessage(request, createMetadata(), (error: any, response: any) => {
      if (error) {
        logger.error('gRPC SendMessage error:', error)
        reject(error)
      } else {
        resolve(response)
      }
    })
  })
}

export async function createSession(userId: string, metadata?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!chatClient) {
      reject(new Error('Chat service not available'))
      return
    }
    
    const request = {
      user_id: userId,
      metadata: metadata || {}
    }
    
    chatClient.CreateSession(request, createMetadata(), (error: any, response: any) => {
      if (error) {
        logger.error('gRPC CreateSession error:', error)
        reject(error)
      } else {
        resolve(response)
      }
    })
  })
}

export async function getHistory(
  sessionId: string,
  limit: number = 50,
  offset: number = 0
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!chatClient) {
      reject(new Error('Chat service not available'))
      return
    }
    
    const request = {
      session_id: sessionId,
      limit: limit,
      offset: offset
    }
    
    chatClient.GetHistory(request, createMetadata(), (error: any, response: any) => {
      if (error) {
        logger.error('gRPC GetHistory error:', error)
        reject(error)
      } else {
        resolve(response)
      }
    })
  })
}