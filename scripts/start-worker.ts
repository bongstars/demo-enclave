// scripts/start-worker.ts
import { fork } from 'child_process'
import path from 'path'

function startWorker() {
	const worker = fork(path.join(__dirname, '../workers/price-monitor.ts'), [], {
		env: process.env,
	})

	worker.on('exit', (code) => {
		console.log(`Worker exited with code ${code}`)
		// Restart worker if it crashes
		startWorker()
	})
}

startWorker()
