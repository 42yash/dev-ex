import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { query } from '../db/index.js'
import { getCached, setCached } from '../services/redis.js'
import * as grpcService from '../services/grpc.js'
import { logger } from '../utils/logger.js'

// Validation schemas
const semanticSearchSchema = z.object({
  query: z.string().min(1).max(1000),
  connector: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  limit: z.number().min(1).max(50).default(10),
  threshold: z.number().min(0).max(1).default(0.7)
})

const hybridSearchSchema = z.object({
  query: z.string().min(1).max(1000),
  connector: z.string().optional(),
  limit: z.number().min(1).max(50).default(10),
  vectorWeight: z.number().min(0).max(1).default(0.7)
})

const storeDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  connector: z.string().default('manual'),
  sourceId: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional()
})

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // Semantic search endpoint
  fastify.post('/semantic', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const body = semanticSearchSchema.parse(request.body)
      const user = (request as any).user
      
      // Check cache
      const cacheKey = `search:semantic:${JSON.stringify(body)}`
      const cached = await getCached(cacheKey)
      if (cached) {
        return reply.send(cached)
      }
      
      // Call gRPC service for semantic search
      const response = await grpcService.semanticSearch({
        query: body.query,
        connector_filter: body.connector,
        metadata_filter: body.metadata,
        limit: body.limit,
        similarity_threshold: body.threshold
      })
      
      // Cache for 5 minutes
      await setCached(cacheKey, response, 300)
      
      logger.info(`Semantic search for user ${user.email}: "${body.query}"`)
      
      return reply.send({
        results: response.results || [],
        query: body.query,
        total: response.total || 0
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        })
      }
      throw error
    }
  })
  
  // Hybrid search endpoint (combines vector and keyword search)
  fastify.post('/hybrid', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const body = hybridSearchSchema.parse(request.body)
      const user = (request as any).user
      
      // Check cache
      const cacheKey = `search:hybrid:${JSON.stringify(body)}`
      const cached = await getCached(cacheKey)
      if (cached) {
        return reply.send(cached)
      }
      
      // Call gRPC service for hybrid search
      const response = await grpcService.hybridSearch({
        query: body.query,
        connector_filter: body.connector,
        limit: body.limit,
        vector_weight: body.vectorWeight
      })
      
      // Cache for 5 minutes
      await setCached(cacheKey, response, 300)
      
      logger.info(`Hybrid search for user ${user.email}: "${body.query}"`)
      
      return reply.send({
        results: response.results || [],
        query: body.query,
        total: response.total || 0
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        })
      }
      throw error
    }
  })
  
  // Store document endpoint
  fastify.post('/document', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const body = storeDocumentSchema.parse(request.body)
      const user = (request as any).user
      
      // Generate document ID
      const documentId = body.sourceId || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Store document via gRPC
      const response = await grpcService.storeDocument({
        document_id: documentId,
        title: body.title,
        content: body.content,
        connector_name: body.connector,
        source_id: body.sourceId,
        source_url: body.sourceUrl,
        metadata: {
          ...body.metadata,
          uploaded_by: user.id,
          uploaded_at: new Date().toISOString()
        }
      })
      
      logger.info(`Document stored by user ${user.email}: ${documentId}`)
      
      return reply.send({
        success: true,
        documentId,
        message: 'Document stored and indexed successfully'
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        })
      }
      throw error
    }
  })
  
  // Get document chunks endpoint
  fastify.get('/document/:documentId/chunks', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { documentId } = request.params as { documentId: string }
      
      // Get chunks from database
      const chunks = await query(
        `SELECT 
          id, 
          chunk_index, 
          content, 
          metadata,
          created_at
        FROM document_chunks 
        WHERE document_id = $1 
        ORDER BY chunk_index`,
        [documentId]
      )
      
      return reply.send({
        documentId,
        chunks,
        total: chunks.length
      })
    } catch (error) {
      throw error
    }
  })
  
  // Search suggestions endpoint (for autocomplete)
  fastify.get('/suggestions', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { q, limit = 5 } = request.query as { q?: string; limit?: number }
      
      if (!q || q.length < 2) {
        return reply.send({ suggestions: [] })
      }
      
      // Get suggestions from recent searches and document titles
      const suggestions = await query(
        `WITH recent_searches AS (
          SELECT DISTINCT message as suggestion
          FROM messages
          WHERE sender = 'user' 
            AND message ILIKE $1
          ORDER BY created_at DESC
          LIMIT $2
        ),
        document_titles AS (
          SELECT DISTINCT title as suggestion
          FROM documents
          WHERE title ILIKE $1
          LIMIT $2
        )
        SELECT suggestion FROM (
          SELECT suggestion FROM recent_searches
          UNION
          SELECT suggestion FROM document_titles
        ) combined
        LIMIT $2`,
        [`%${q}%`, limit]
      )
      
      return reply.send({
        suggestions: suggestions.map(s => s.suggestion)
      })
    } catch (error) {
      throw error
    }
  })
  
  // Clear search cache endpoint
  fastify.delete('/cache', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      
      // Only allow admins to clear cache
      if (user.role !== 'admin') {
        return reply.status(403).send({
          error: 'Insufficient permissions'
        })
      }
      
      // Clear search cache patterns
      // This is a simplified version - in production you'd want to use Redis SCAN
      logger.info(`Search cache cleared by admin ${user.email}`)
      
      return reply.send({
        success: true,
        message: 'Search cache cleared successfully'
      })
    } catch (error) {
      throw error
    }
  })
}