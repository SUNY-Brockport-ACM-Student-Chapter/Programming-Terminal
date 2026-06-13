import '../component/CodeEditorElement'
import type { CodeEditorElement } from '../component/CodeEditorElement'

const editor = document.getElementById('editor') as CodeEditorElement

// Read configuration from URL parameters
const params = new URLSearchParams(window.location.search)
const WS_URL = params.get('wsUrl') ?? 'ws://localhost:3001/ws'
const initLang = params.get('language') ?? 'java' 

editor.setLanguage(initLang as any)

// Websocket  connection to execution backend

type BackendMessage = 
| { type: 'ready'}
| { type: 'output'; data: string}
| { type: 'exit'; code: number | null}
| { type: 'error'; message: string}

let ws: WebSocket | null = null
let isRunning: boolean = false

function connectWebSocket(): WebSocket {
    const socket = new WebSocket(WS_URL)

    socket.addEventListener('open', () => {
        console.log('[iframe] Connected to execution backend')
    })

    socket.addEventListener('message', (event) => {
        let msg: BackendMessage
        try { msg = JSON.parse(event.data as string) as BackendMessage}
        catch { return }

        switch(msg.type){
            case 'ready':
                // Code is ruuning - open stdin so the user can interact with it
                isRunning = true
                editor.setRunningState(true)
                break

                case 'output':
                    editor.streamOutput(msg.data)
                    break

                case 'exit':
                    // Code has finished executing - close stdin, terminal becomes read-only
                    isRunning = false
                    editor.setRunningState(false)
                    editor.streamOutput(`\r\n\x1b[90m[Process exited with code ${msg.code ?? 0}]\x1b[0m\r\n`)
                    break

                case 'error':
                    isRunning = false
                    editor.setRunningState(false)
                    editor.streamOutput(`\r\n\x1b[31m[Error: ${msg.message}]\x1b[0m\r\n`)
                    break
        }
    })

    socket.addEventListener('close', () => {
        console.log('[iframe] WebSocket closed - reconnecting...')
        isRunning = false
        editor.setRunningState(false)
        setTimeout(() => {ws = connectWebSocket() }, 3000)
    })

    socket.addEventListener('error', () => {
        editor.streamOutput('\r\n\x1b[31m[Could not connect to execution server. Make sure it is running.]\x1b[0m\r\n')
    })

    return socket 
}

function send(msg: object): void {
    if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg))
    }
}

ws = connectWebSocket()

// Editor event listeners 
// Run code
editor.addEventListener('editor-run', (e:Event) => {
    const { code, language } = (e as CustomEvent).detail as { code: string; language: string }
    if(!ws || ws.readyState !== WebSocket.OPEN) {
        editor.streamOutput('\r\n\x1b[31m[Not connected to execution server]\x1b[0m\r\n')
        return
    }
    if(isRunning) send({ type: 'stop'})
        editor.clearTerminal()
    send({ type: 'run', code, language })
})

// Stop code
editor.addEventListener('editor-stop', () => {
    send({ type: 'stop' })
})

// Input listener
editor.addEventListener('terminal-input', (e: Event) => {
    const { data } = (e as CustomEvent).detail as { data: string }
    if (isRunning){
        send({ type: 'input', data})
    }
})

// Resize listener
editor.addEventListener('terminal-resize', (e: Event) => {
    const { cols, rows} = (e as CustomEvent).detail as {cols: number; rows: number}
    send({ type: 'resize', cols, rows })
})

// Inbound postMessage from platform
window.addEventListener('message', (event) => {
    const { type, payload } = (event.data ?? {}) as { type?: string; payload?: any}
    if(type == 'SET_CONFIG'){
        if(payload?.language) editor.setLanguage(payload.language)
        if(payload?.code) editor.setValue(payload.code)
    }
})


