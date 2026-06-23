import 'dotenv/config'
import http from 'http'
import express from 'express'
import cors from 'cors'
import routes from './routes'
import { attachWebSocketServer } from './ws-handler'
import {containerPool} from './pool'

// Read the port from the enviroment variables, default to 3001
const PORT = parseInt(process.env.PORT ?? '3001', 10)
// Parse the CORS_ORIGIN env variable into an array of allowed origins
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? '').split(',').map(s =>s.trim())

// Create Express application
const app = express()
// Register CORS middleware
app.use(cors({origin: CORS_ORIGINS}))
// Register JSON body parsing middleware
app.use(express.json())
// Mount our routes at the '/api' prefix
app.use('/api', routes)

// Create the HTTP server wrapping the express app. WebSocketServer needs to be attached to a Server instance, not an Express app
const server = http.createServer(app)
// Attach the Websocket server to the same HTTP server. 
attachWebSocketServer(server)

// main is async so we can await at the top level
async function main(){
    // Initialize the container pool
    await containerPool.init()
    // Start listening for incoming connections on the specified port
    server.listen(PORT, () => console.log(`[server] Execution backend listening on :${PORT}`))
}

// Shutdown handler
const shutdown = async () => { 
    // Destroy all managed containers
    await containerPool.shutdown(); 
    // Exit with code 0 to signal that shutdown was not the result of an error
    process.exit(0)
}

// Register the shutdown handler for both signals
process.on('SIGTERM', shutdown) // SIGTERM is sent by process managers (Docker) when stopping the server
process.on('SIGINT', shutdown) // SIGINT is sent when Ctrl+C is pressed in the terminal

// Register any rejections
process.on('unhandledRejection', (reason) => {
    console.error('[server] Unhandled rejection', reason)
})

// Register any exceptions
process.on('uncaughtException', (err) =>{
    console.error('[server] Uncaught exception', err)
})

// Call main and handle any startup errors
main().catch(err => {console.error('[server] Fatal:', err); process.exit(1)})