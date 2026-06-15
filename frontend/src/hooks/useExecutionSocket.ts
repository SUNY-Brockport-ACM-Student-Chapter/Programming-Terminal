import {useEffect, useRef, useCallback} from 'react'
import type {ClientMessage, ServerMessage, Language} from '../types'

interface UseExecutionSocketOptions {
    wsUrl: string
    onReady: () => void
    onOutput: (data: string) => void
    onExit: (code: number | null) => void
    onError: (message: string) => void
}

interface ExecutionSocketHandle{
    run(language: Language, code: string): void
    stop(): void
    sendInput(data: string): void
    sendResize(cols: number, rows: number): void
}

export function useExecutionSocket({
    wsUrl,
    onReady,
    onOutput, 
    onExit,
    onError,
}: UseExecutionSocketOptions): ExecutionSocketHandle {
    const wsRef = useRef<WebSocket | null>(null)
    const isRunningRef = useRef(false)

    const onReadyRef = useRef(onReady)
    const onOutputRef = useRef(onOutput)
    const onExitRef = useRef(onExit)
    const onErrorRef = useRef(onError)

    useEffect(() => {onReadyRef.current = onReady}, [onReady])
    useEffect(() => {onOutputRef.current = onOutput}, [onOutput])
    useEffect(() => {onExitRef.current = onExit}, [onExit])
    useEffect(() => {onErrorRef.current = onError}, [onError])

    useEffect(() => {
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null
        let destroyed = false

        function connect() {
            if(destroyed) return
            const socket = new WebSocket(wsUrl)
            wsRef.current = socket

            socket.addEventListener('open', () => {
                console.log('[editor] Connected to execution backend')
            })

            socket.addEventListener('message', (event) => {
                let msg: ServerMessage
                try {
                    msg = JSON.parse(event.data as string) as ServerMessage
                } catch { 
                    return
                }

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

            socket.addEventListener('close', () => {
                console.log('[editor] WebSocket closed - reconnecting...')
                isRunningRef.current = false
                if(!destroyed){
                    reconnectTimer = setTimeout(connect, 3000)
                }
            })

            socket.addEventListener('error', () => {
                onErrorRef.current('Could not connect to execution server. Make sure it is running.')
            })
        }

        connect()

        return () => {
            destroyed = true
            if (reconnectTimer) {
                clearTimeout(reconnectTimer)
            }
            wsRef.current?.close()
            wsRef.current = null
        }
    }, [wsUrl])

        const send = useCallback((msg: ClientMessage) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify(msg))
            }
        }, [])

        const run = useCallback((language: Language, code: string) => {
            if (isRunningRef.current) send({ type: 'stop' })
            send({ type: 'run', language, code })
        }, [send])

        const stop = useCallback(() => {
            send({ type: 'stop' })
        }, [send])

        const sendInput = useCallback((data: string) => {
            if (isRunningRef.current) send({ type: 'input', data })
        }, [send])

        const sendResize = useCallback((cols: number, rows: number) => {
            send({ type: 'resize', cols, rows })
        }, [send])

        return { run, stop, sendInput, sendResize }
}
