const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

/**
 * Database configuration and connection management for Kargho Chat
 */
class Database {
  constructor() {
    this.pool = null;
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'chatmini',
      charset: 'utf8mb4',
      connectionLimit: 10,
      queueLimit: 0
    };
  }

  /**
   * Initialize database connection pool
   */
  async initialize() {
    try {
      this.pool = mysql.createPool(this.config);
      
      // Test connection
      const connection = await this.pool.getConnection();
      console.log('✅ Database connected successfully');
      connection.release();
      
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Get database connection from pool
   */
  async getConnection() {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return await this.pool.getConnection();
  }

  /**
   * Execute a query with parameters
   */
  async query(sql, params = []) {
    const connection = await this.getConnection();
    try {
      console.log(`[35m[DB QUERY][0m SQL: [36m${sql}[0m`);
      if (params.length > 0) {
        console.log(`[35m[DB QUERY][0m Params: [36m${JSON.stringify(params)}[0m`);
      }
      const [results] = await connection.execute(sql, params);
      console.log(`[35m[DB QUERY][0m Results: [36m${JSON.stringify(results)}[0m`);
      return results;
    } finally {
      connection.release();
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction(queries) {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();
      
      const results = [];
      for (const { sql, params } of queries) {
        const [result] = await connection.execute(sql, params || []);
        results.push(result);
      }
      
      await connection.commit();
      return results;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations() {
    const connection = await this.getConnection();
    try {
      const migrationsPath = path.join(__dirname, '../../migrations');
      const files = await fs.readdir(migrationsPath);
      const sqlFiles = files.filter(file => file.endsWith('.sql')).sort();

      console.log(`Found ${sqlFiles.length} migration files`);

      for (const file of sqlFiles) {
        if (file === 'README.md') continue;
        
        console.log(`Running migration: ${file}`);
        const filePath = path.join(migrationsPath, file);
        const sql = await fs.readFile(filePath, 'utf8');
        
        // Split SQL file by semicolons and execute each statement
        const statements = sql.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
          if (statement.trim()) {
            // Use query() instead of execute() for migration statements
            // This allows SET commands and other non-prepared statements
            await connection.query(statement);
          }
        }
        
        console.log(`✅ Migration ${file} completed`);
      }
      
      console.log('🎉 All migrations completed successfully');
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Check database health
   */
  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as health');
      return result[0]?.health === 1;
    } catch (error) {
      console.error('Database health check failed:', error.message);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const [tables] = await this.query(`
        SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? 
        ORDER BY TABLE_NAME
      `, [this.config.database]);
      
      return tables;
    } catch (error) {
      console.error('Failed to get database stats:', error.message);
      return [];
    }
  }

  /**
   * Close database connections
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('Database connections closed');
    }
  }
}

// Export singleton instance
const database = new Database();
module.exports = database;
module.exports.Database = Database;