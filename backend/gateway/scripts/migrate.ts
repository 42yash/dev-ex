#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import dotenv from 'dotenv'
import { logger } from '../src/utils/logger.js'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Migration {
  id: number
  filename: string
  sql: string
}

class MigrationRunner {
  private pool: pg.Pool
  
  constructor() {
    this.pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1
    })
  }
  
  async initialize() {
    // Create migrations table if it doesn't exist
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL,
        UNIQUE(filename)
      )
    `)
    
    logger.info('Migrations table ready')
  }
  
  async getExecutedMigrations(): Promise<Set<string>> {
    const result = await this.pool.query('SELECT filename FROM migrations')
    return new Set(result.rows.map(row => row.filename))
  }
  
  async loadMigrations(): Promise<Migration[]> {
    const migrationsDir = path.join(__dirname, '..', 'migrations')
    
    if (!fs.existsSync(migrationsDir)) {
      logger.warn(`Migrations directory not found: ${migrationsDir}`)
      return []
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()
    
    const migrations: Migration[] = []
    
    for (const file of files) {
      const filepath = path.join(migrationsDir, file)
      const sql = fs.readFileSync(filepath, 'utf8')
      
      // Extract migration ID from filename (e.g., 001_initial.sql -> 1)
      const match = file.match(/^(\d+)/)
      if (!match) {
        logger.warn(`Skipping file with invalid format: ${file}`)
        continue
      }
      
      migrations.push({
        id: parseInt(match[1]),
        filename: file,
        sql
      })
    }
    
    return migrations
  }
  
  calculateChecksum(sql: string): string {
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(sql).digest('hex')
  }
  
  async runMigration(migration: Migration) {
    const client = await this.pool.connect()
    
    try {
      await client.query('BEGIN')
      
      logger.info(`Running migration: ${migration.filename}`)
      
      // Execute migration SQL
      await client.query(migration.sql)
      
      // Record migration
      const checksum = this.calculateChecksum(migration.sql)
      await client.query(
        'INSERT INTO migrations (id, filename, checksum) VALUES ($1, $2, $3)',
        [migration.id, migration.filename, checksum]
      )
      
      await client.query('COMMIT')
      
      logger.info(`✓ Migration completed: ${migration.filename}`)
    } catch (error) {
      await client.query('ROLLBACK')
      logger.error(`✗ Migration failed: ${migration.filename}`, error)
      throw error
    } finally {
      client.release()
    }
  }
  
  async migrate() {
    try {
      await this.initialize()
      
      const executedMigrations = await this.getExecutedMigrations()
      const allMigrations = await this.loadMigrations()
      
      const pendingMigrations = allMigrations.filter(
        m => !executedMigrations.has(m.filename)
      )
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations')
        return
      }
      
      logger.info(`Found ${pendingMigrations.length} pending migration(s)`)
      
      for (const migration of pendingMigrations) {
        await this.runMigration(migration)
      }
      
      logger.info('All migrations completed successfully')
    } catch (error) {
      logger.error('Migration failed:', error)
      process.exit(1)
    } finally {
      await this.pool.end()
    }
  }
  
  async rollback(steps: number = 1) {
    try {
      await this.initialize()
      
      const result = await this.pool.query(
        'SELECT * FROM migrations ORDER BY id DESC LIMIT $1',
        [steps]
      )
      
      if (result.rows.length === 0) {
        logger.info('No migrations to rollback')
        return
      }
      
      logger.warn(`Rolling back ${result.rows.length} migration(s)`)
      
      for (const row of result.rows) {
        logger.info(`Rolling back: ${row.filename}`)
        
        // Note: Rollback logic would need to be implemented
        // This is a placeholder - you'd need DOWN migrations
        await this.pool.query(
          'DELETE FROM migrations WHERE id = $1',
          [row.id]
        )
        
        logger.info(`✓ Rolled back: ${row.filename}`)
      }
      
    } catch (error) {
      logger.error('Rollback failed:', error)
      process.exit(1)
    } finally {
      await this.pool.end()
    }
  }
  
  async status() {
    try {
      await this.initialize()
      
      const executedMigrations = await this.getExecutedMigrations()
      const allMigrations = await this.loadMigrations()
      
      console.log('\n=== Migration Status ===\n')
      
      for (const migration of allMigrations) {
        const status = executedMigrations.has(migration.filename) ? '✓' : '○'
        console.log(`${status} ${migration.filename}`)
      }
      
      const pending = allMigrations.filter(
        m => !executedMigrations.has(m.filename)
      ).length
      
      console.log(`\nTotal: ${allMigrations.length} | Executed: ${executedMigrations.size} | Pending: ${pending}\n`)
      
    } catch (error) {
      logger.error('Failed to get status:', error)
      process.exit(1)
    } finally {
      await this.pool.end()
    }
  }
}

// CLI
async function main() {
  const command = process.argv[2]
  const runner = new MigrationRunner()
  
  switch (command) {
    case 'up':
    case 'migrate':
      await runner.migrate()
      break
      
    case 'down':
    case 'rollback':
      const steps = parseInt(process.argv[3]) || 1
      await runner.rollback(steps)
      break
      
    case 'status':
      await runner.status()
      break
      
    default:
      console.log(`
Database Migration Tool

Usage:
  npm run migrate:up       Run pending migrations
  npm run migrate:down     Rollback last migration
  npm run migrate:status   Show migration status
  
Commands:
  up, migrate              Run all pending migrations
  down, rollback [n]       Rollback n migrations (default: 1)
  status                   Show migration status
      `)
      process.exit(1)
  }
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})