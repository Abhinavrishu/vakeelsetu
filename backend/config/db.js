import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../database/schema.js';

let db;

export const connectDB = async () => {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Test the connection
    const client = await pool.connect();
    console.log(`PostgreSQL Connected: ${client.query ? 'OK' : 'FAIL'}`);
    client.release();

    db = drizzle(pool, { schema });
    return db;
  } catch (error) {
    console.error(`PostgreSQL Connection Failed: ${error.message}`);
    process.exit(1);
  }
};

export const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB() first.');
  }
  return db;
};
