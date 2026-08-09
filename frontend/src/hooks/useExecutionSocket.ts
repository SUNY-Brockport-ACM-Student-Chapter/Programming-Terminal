import {useEffect, useRef, useCallback} from 'react'
import type {ClientMessage, ServerMessage, Language, EditorFile} from '../types'

// Defines what callback functions the hook calls when WebSocket events occur
interface UseExecutionSocketOptions {
    wsUrl: string
    onReady: () => void
    onOutput: (data: string) => void
    onExit: (code: number | null) => void
    onError: (message: string) => void
}

// Defines what the hook returns - the actions that components can call to interact with the WebSocket connection
interface ExecutionSocketHandle{
    run(language: Language, files: EditorFile[], entryPoint?: string): void
    stop(): void
    sendInput(data: string): void
    sendResize(cols: number, rows: number): void
}

// React hook that manages the entire WebSocket lifecycle 
export function useExecutionSocket({
    wsUrl,
    onReady,
    onOutput, 
    onExit,
    onError,
}: UseExecutionSocketOptions): ExecutionSocketHandle {
    // Holds WebSocket instance
    const wsRef = useRef<WebSocket | null>(null)
    // Tracks whether a process is currently executing 
    const isRunningRef = useRef(false)

    // Callback refs store the latest versions of the callback functions
    const onReadyRef = useRef(onReady)
    const onOutputRef = useRef(onOutput)
    const onExitRef = useRef(onExit)
    const onErrorRef = useRef(onError)

    // These effects run every time a callback prop changes, keeping the refs current
    useEffect(() => {onReadyRef.current = onReady}, [onReady])
    useEffect(() => {onOutputRef.current = onOutput}, [onOutput])
    useEffect(() => {onExitRef.current = onExit}, [onExit])
    useEffect(() => {onErrorRef.current = onError}, [onError])

    // WebSocket connection lifecycle 
    useEffect(() => {
        // holds the setTimeout ID for the reconnection delay
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null
        // Flag for when cleanup runs to prevent reconnection attempts after cleanup
        let destroyed = false
        // Flag to track if this is the first connection attempt
        let firstAttempt = true

        // Creates new WebSocket and sets up all its event listeners 
        function connect() {
            // Don't connect if the component unmounted
            if(destroyed) return

            // Create WebSocket connection to the execution server
            const socket = new WebSocket(wsUrl)
            // Store socket in the ref so the action functions can access it when called by components
            wsRef.current = socket

            // fires when the WebSocket handshake completes successfully
            socket.addEventListener('open', () => {
                console.log('[editor] Connected to execution backend')
            })

            // fires each time the server sends a JSON message 
            socket.addEventListener('message', (event) => {
                let msg: ServerMessage
                try {
                    msg = JSON.parse(event.data as string) as ServerMessage
                } catch { 
                    return
                }

                // Route each message to the appropriate callback 
                switch(msg.type){
                    case 'ready':
                        isRunningRef.current = true
                        onReadyRef.current()
                        break
                    case 'output':
                        onOutputRef.current(msg.data)
                        break
                    case 'exit':
                        isRunningRef.current = false
                        onExitRef.current(msg.code)
                        break
                    case 'error':
                        isRunningRef.current = false
                        onErrorRef.current(msg.message)
                        break
                }
            })

            // fires when the WebSocket disconnects for any reason 
            socket.addEventListener('close', () => {
                console.log('[editor] WebSocket closed - reconnecting...')
                isRunningRef.current = false
                // If the component hasn't unmounted schedule a reconnection attempt in 3 seconds 
                if(!destroyed){
                    reconnectTimer = setTimeout(connect, 3000)
                }
            })

            // fires when the connection attempt fails entirely 
            socket.addEventListener('error', () => {
                if(!destroyed && !firstAttempt){
                    onErrorRef.current('Could not connect to execution server. Make sure it is running.')
                }
                firstAttempt = false
            })
        }

        // Start the initial connection. Wrapped around a timer to give the page time to fully render and connect to the server
        reconnectTimer = setTimeout(connect, 2000)

        // Cleanup function when the component unmounts or wsUrl changes
        return () => {
            destroyed = true
            if (reconnectTimer) {
                clearTimeout(reconnectTimer)
            }
            wsRef.current?.close()
            wsRef.current = null
        }
    }, [wsUrl])

        // internal helper that serializes a ClientMessage to JSON
        const send = useCallback((msg: ClientMessage) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify(msg))
            }
        }, [])

        // sends run request to the server
        const run = useCallback((language: Language, files: EditorFile[], entryPoint?: string) => {
            // If something is running already, stop it first
            if (isRunningRef.current) send({ type: 'stop' })
            send({ type: 'run', language, files, entryPoint })
        }, [send])

        // sends stop request for the currently running process
        const stop = useCallback(() => {
            send({ type: 'stop' })
        }, [send])

        // forwards terminal keystrokes to the running process's stdin
        const sendInput = useCallback((data: string) => {
            if (isRunningRef.current) send({ type: 'input', data })
        }, [send])

        // notifies the server when the terminal's character dimensions change 
        const sendResize = useCallback((cols: number, rows: number) => {
            send({ type: 'resize', cols, rows })
        }, [send])

        // return the action functions
        return { run, stop, sendInput, sendResize }
}
