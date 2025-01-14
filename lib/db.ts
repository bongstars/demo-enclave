// lib/db.ts
import { Database } from 'sqlite3'
import { open } from 'sqlite'

// Singleton database connection
let db: any = null

export async function getDb() {
	if (!db) {
		db = await open({
			filename: './data/orders.db',
			driver: Database,
		})
	}
	return db
}

// Initialize database tables
export async function initializeDb() {
	const db = await getDb()

	await db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      targetPrice REAL NOT NULL,
      smartWalletAddress TEXT NOT NULL,
      sessionKey TEXT NOT NULL,
      tokenAddress TEXT NOT NULL,
      chainId INTEGER NOT NULL,
      status TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      executedAt DATETIME,
      transactionHash TEXT
    )
  `)
}
