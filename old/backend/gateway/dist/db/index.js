import { Pool } from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
let pool = null;
const poolConfig = {
    connectionString: config.database.url,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};
export async function initializeDatabase() {
    try {
        pool = new Pool(poolConfig);
        // Test the connection
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        logger.info('Database connection established');
    }
    catch (error) {
        logger.error('Failed to initialize database:', error);
        throw error;
    }
}
export async function query(text, params) {
    if (!pool) {
        throw new Error('Database not initialized');
    }
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug({
            query: text,
            duration,
            rows: res.rowCount
        }, 'Executed query');
        return res.rows;
    }
    catch (error) {
        logger.error({
            query: text,
            error
        }, 'Query failed');
        throw error;
    }
}
export async function getClient() {
    if (!pool) {
        throw new Error('Database not initialized');
    }
    return pool.connect();
}
export async function transaction(callback) {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
export async function checkDatabaseHealth() {
    try {
        const result = await query('SELECT 1');
        return result.length > 0;
    }
    catch (error) {
        logger.error('Database health check failed:', error);
        return false;
    }
}
export async function closeDatabase() {
    if (pool) {
        await pool.end();
        pool = null;
        logger.info('Database connection closed');
    }
}
//# sourceMappingURL=index.js.map