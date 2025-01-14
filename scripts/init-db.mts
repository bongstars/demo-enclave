// scripts/init-db.ts
import { initializeDb } from '../lib/db'

async function initialize() {
	try {
		await initializeDb()
		console.log('Database initialized successfully')
	} catch (error) {
		console.error('Error initializing database:', error)
		process.exit(1)
	}
}

initialize()
