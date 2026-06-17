import 'dotenv/config'
import http from 'http'
import express from 'express'
import cors from 'cors'
import routes from './routes.js'
import { attachWebSocketServer } from './ws-handler.js'
import {containerPool} from './pool.js'

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? '').split(',').map(s =>s.trim())

const app = express()
app.use(cors({origin: CORS_ORIGINS}))
app.use(express.json())
app.use('/api', routes)

const server = http.createServer(app)
attachWebSocketServer(server)

async function main(){
    await containerPool.init()
    server.listen(PORT, () => console.log(`[server] Execution backend listening on :${PORT}`))
}

const shutdown = async () => { await containerPool.shutdown(); process.exit(0)}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

main().catch(err => {console.error('[server] Fatal:', err); process.exit(1)})