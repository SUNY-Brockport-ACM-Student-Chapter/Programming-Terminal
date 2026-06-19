import { WebSocketServer, WebSocket } from 'ws'
import type {Server} from 'http'
import { ExecutionSession } from './executor'
import { ClientMessage, LANGUAGES } from './types'

export function attachWebSocketServer(server: Server): void{
    const wss = new WebSocketServer({server, path: '/ws'})

    wss.on('connection', (ws:WebSocket) =>{
        const session = new ExecutionSession(ws)

        ws.on('message', async(raw) => {
            let msg: ClientMessage
            try{
                msg = JSON.parse(raw.toString()) as ClientMessage
            } catch {return}

            switch(msg.type){
                case 'run':
                    if(!LANGUAGES.includes(msg.language)){
                        ws.send(JSON.stringify({type: 'error', message: `Unknown language: ${msg.language}`}))
                        return
                    }
                    await session.run(msg.language, msg.code)
                    break
                case 'input':
                    session.writeInput(msg.data);
                    break
                case 'resize':
                    session.resize(msg.cols, msg.rows);
                    break
                case 'stop':
                    await session.kill();
                    break
            }
        })

        ws.on('close', async () => { await session.kill()})
        ws.on('error', err => {console.error('[ws] error', err)})
    })

    console.log('[ws] WebSocket server attached at /ws')
}