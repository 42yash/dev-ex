import { FastifyPluginAsync } from 'fastify'
import multipart from '@fastify/multipart'
import { randomUUID } from 'crypto'
import { createWriteStream, promises as fs } from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { query } from '../db/index.js'
import { logger } from '../utils/logger.js'

// File upload configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
const ALLOWED_EXTENSIONS = (process.env.ALLOWED_EXTENSIONS || 'pdf,txt,md,json,csv,png,jpg,jpeg,gif').split(',')
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/zip',
  'application/x-zip-compressed'
]

interface FileUpload {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  path: string
  userId: string
  sessionId?: string
  metadata?: any
}

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  // Register multipart plugin
  await fastify.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 10 // Max 10 files per request
    }
  })

  // Ensure upload directory exists
  await fs.mkdir(UPLOAD_DIR, { recursive: true })

  // Upload single file
  fastify.post('/upload', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = (request as any).user
    const data = await request.file()

    if (!data) {
      return reply.status(400).send({
        error: 'No file provided'
      })
    }

    try {
      // Validate file
      const validation = validateFile(data.filename, data.mimetype)
      if (!validation.valid) {
        return reply.status(400).send({
          error: validation.error
        })
      }

      // Generate unique filename
      const fileId = randomUUID()
      const ext = path.extname(data.filename)
      const filename = `${fileId}${ext}`
      const filepath = path.join(UPLOAD_DIR, filename)

      // Save file to disk
      await pipeline(data.file, createWriteStream(filepath))

      // Get file stats
      const stats = await fs.stat(filepath)

      // Save to database
      const result = await query(
        `INSERT INTO files (
          id, filename, original_name, mime_type, size, path, user_id, uploaded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        RETURNING *`,
        [fileId, filename, data.filename, data.mimetype, stats.size, filepath, user.id]
      )

      const file = result[0]

      logger.info(`File uploaded: ${file.original_name} by user ${user.email}`)

      return reply.send({
        file: {
          id: file.id,
          filename: file.original_name,
          mimeType: file.mime_type,
          size: file.size,
          uploadedAt: file.uploaded_at
        }
      })
    } catch (error) {
      logger.error('File upload failed:', error)
      return reply.status(500).send({
        error: 'File upload failed'
      })
    }
  })

  // Upload multiple files
  fastify.post('/upload/multiple', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = (request as any).user
    const parts = request.files()
    const uploadedFiles: FileUpload[] = []
    const errors: any[] = []

    for await (const part of parts) {
      try {
        // Validate file
        const validation = validateFile(part.filename, part.mimetype)
        if (!validation.valid) {
          errors.push({
            filename: part.filename,
            error: validation.error
          })
          continue
        }

        // Generate unique filename
        const fileId = randomUUID()
        const ext = path.extname(part.filename)
        const filename = `${fileId}${ext}`
        const filepath = path.join(UPLOAD_DIR, filename)

        // Save file to disk
        await pipeline(part.file, createWriteStream(filepath))

        // Get file stats
        const stats = await fs.stat(filepath)

        // Save to database
        const result = await query(
          `INSERT INTO files (
            id, filename, original_name, mime_type, size, path, user_id, uploaded_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
          RETURNING *`,
          [fileId, filename, part.filename, part.mimetype, stats.size, filepath, user.id]
        )

        uploadedFiles.push({
          id: result[0].id,
          filename: result[0].original_name,
          originalName: result[0].original_name,
          mimeType: result[0].mime_type,
          size: result[0].size,
          path: result[0].path,
          userId: user.id
        })
      } catch (error) {
        logger.error(`Failed to upload file ${part.filename}:`, error)
        errors.push({
          filename: part.filename,
          error: 'Upload failed'
        })
      }
    }

    return reply.send({
      uploaded: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined
    })
  })

  // Upload file for chat session
  fastify.post('/upload/session/:sessionId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = (request as any).user
    const { sessionId } = request.params as { sessionId: string }
    const data = await request.file()

    if (!data) {
      return reply.status(400).send({
        error: 'No file provided'
      })
    }

    // Verify session access
    const sessions = await query(
      'SELECT id FROM sessions WHERE id = $1 AND user_id = $2',
      [sessionId, user.id]
    )

    if (sessions.length === 0) {
      return reply.status(403).send({
        error: 'Session not found or access denied'
      })
    }

    try {
      // Validate file
      const validation = validateFile(data.filename, data.mimetype)
      if (!validation.valid) {
        return reply.status(400).send({
          error: validation.error
        })
      }

      // Generate unique filename
      const fileId = randomUUID()
      const ext = path.extname(data.filename)
      const filename = `${fileId}${ext}`
      const filepath = path.join(UPLOAD_DIR, 'sessions', sessionId, filename)

      // Ensure directory exists
      await fs.mkdir(path.dirname(filepath), { recursive: true })

      // Save file to disk
      await pipeline(data.file, createWriteStream(filepath))

      // Get file stats
      const stats = await fs.stat(filepath)

      // Save to database with session association
      const result = await query(
        `INSERT INTO files (
          id, filename, original_name, mime_type, size, path, user_id, session_id, uploaded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        RETURNING *`,
        [fileId, filename, data.filename, data.mimetype, stats.size, filepath, user.id, sessionId]
      )

      const file = result[0]

      // Process file based on type
      const processedData = await processFile(file)

      logger.info(`File uploaded to session ${sessionId}: ${file.original_name}`)

      return reply.send({
        file: {
          id: file.id,
          filename: file.original_name,
          mimeType: file.mime_type,
          size: file.size,
          sessionId: file.session_id,
          uploadedAt: file.uploaded_at,
          processed: processedData
        }
      })
    } catch (error) {
      logger.error('File upload failed:', error)
      return reply.status(500).send({
        error: 'File upload failed'
      })
    }
  })

  // Get file metadata
  fastify.get('/files/:fileId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = (request as any).user
    const { fileId } = request.params as { fileId: string }

    const files = await query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [fileId, user.id]
    )

    if (files.length === 0) {
      return reply.status(404).send({
        error: 'File not found'
      })
    }

    const file = files[0]

    return reply.send({
      file: {
        id: file.id,
        filename: file.original_name,
        mimeType: file.mime_type,
        size: file.size,
        sessionId: file.session_id,
        uploadedAt: file.uploaded_at,
        metadata: file.metadata
      }
    })
  })

  // Download file
  fastify.get('/files/:fileId/download', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = (request as any).user
    const { fileId } = request.params as { fileId: string }

    const files = await query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [fileId, user.id]
    )

    if (files.length === 0) {
      return reply.status(404).send({
        error: 'File not found'
      })
    }

    const file = files[0]

    // Check if file exists
    try {
      await fs.access(file.path)
    } catch {
      return reply.status(404).send({
        error: 'File not found on disk'
      })
    }

    // Set headers
    reply.header('Content-Type', file.mime_type)
    reply.header('Content-Disposition', `attachment; filename="${file.original_name}"`)

    // Stream file
    const stream = createReadStream(file.path)
    return reply.send(stream)
  })

  // Delete file
  fastify.delete('/files/:fileId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = (request as any).user
    const { fileId } = request.params as { fileId: string }

    const files = await query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [fileId, user.id]
    )

    if (files.length === 0) {
      return reply.status(404).send({
        error: 'File not found'
      })
    }

    const file = files[0]

    // Delete from disk
    try {
      await fs.unlink(file.path)
    } catch (error) {
      logger.error(`Failed to delete file from disk: ${file.path}`, error)
    }

    // Delete from database
    await query('DELETE FROM files WHERE id = $1', [fileId])

    logger.info(`File deleted: ${file.original_name} by user ${user.email}`)

    return reply.send({
      success: true
    })
  })

  // List user files
  fastify.get('/files', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = (request as any).user
    const { sessionId, limit = 20, offset = 0 } = request.query as any

    let queryStr = `
      SELECT id, original_name as filename, mime_type, size, session_id, uploaded_at
      FROM files
      WHERE user_id = $1
    `
    const params: any[] = [user.id]

    if (sessionId) {
      queryStr += ' AND session_id = $2'
      params.push(sessionId)
    }

    queryStr += ' ORDER BY uploaded_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2)
    params.push(limit, offset)

    const files = await query(queryStr, params)

    return reply.send({
      files
    })
  })
}

// Validate file
function validateFile(filename: string, mimetype: string): { valid: boolean; error?: string } {
  // Check extension
  const ext = path.extname(filename).toLowerCase().slice(1)
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `File extension '${ext}' is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
    }
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    return {
      valid: false,
      error: `File type '${mimetype}' is not allowed`
    }
  }

  // Check filename for security
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return {
      valid: false,
      error: 'Invalid filename'
    }
  }

  return { valid: true }
}

// Process uploaded file based on type
async function processFile(file: any): Promise<any> {
  const result: any = {}

  // Text files - extract content
  if (file.mime_type.startsWith('text/') || file.mime_type === 'application/json') {
    try {
      const content = await fs.readFile(file.path, 'utf-8')
      result.content = content.slice(0, 1000) // First 1000 chars
      result.lineCount = content.split('\n').length
    } catch (error) {
      logger.error('Failed to process text file:', error)
    }
  }

  // Images - get dimensions (would need image processing library)
  if (file.mime_type.startsWith('image/')) {
    result.type = 'image'
    // In production, use sharp or similar to get dimensions
  }

  // PDFs - extract metadata (would need PDF library)
  if (file.mime_type === 'application/pdf') {
    result.type = 'pdf'
    // In production, use pdf-parse or similar
  }

  return result
}

import { createReadStream } from 'fs'