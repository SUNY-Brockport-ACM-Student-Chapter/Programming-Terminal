import { forwardRef, useEffect, useImperativeHandle, useRef} from 'react'
import { Terminal }  from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export interface TerminalHandle {
  write(data: string): void
  clear(): void
}

interface TerminalPaneProps {
  isRunning:  boolean
  onData:     (data: string) => void
  onResize:   (cols: number, rows: number) => void
}

export const TerminalPane = forwardRef<TerminalHandle, TerminalPaneProps>(
  ({ isRunning, onData, onResize }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const terminalRef  = useRef<Terminal | null>(null)
    const fitAddonRef  = useRef<FitAddon | null>(null)
    const onDataRef    = useRef(onData)
    const onResizeRef  = useRef(onResize)
    useEffect(() => { onDataRef.current   = onData   }, [onData])
    useEffect(() => { onResizeRef.current = onResize }, [onResize])

    // Initialize xterm once on mount 
    useEffect(() => {
      if (!containerRef.current) return

      // Create terminal instance with our configuration 
      const terminal = new Terminal({
        theme: {
          background: '#0d0d0d',
          foreground: '#d4d4d4',
          cursor:     '#d4d4d4',
          red:        '#cd3131',
          green:      '#0dbc79',
          yellow:     '#e5e510',
          blue:       '#2472c8',
          cyan:       '#11a8cd',
        },
        fontSize:     13,
        fontFamily:   'Menlo, Monaco, "Courier New", monospace',
        cursorBlink:  false,
        // Read-only until a process starts — setRunningState toggles this
        disableStdin: true,
        convertEol:   true,
      })

      const fitAddon = new FitAddon()
      terminal.loadAddon(fitAddon)
      terminal.open(containerRef.current)
      requestAnimationFrame(() => fitAddon.fit())

      terminalRef.current  = terminal
      fitAddonRef.current  = fitAddon

      // Forward stdin to the parent (only sent to backend when isRunning)
      terminal.onData((data) => onDataRef.current(data))

      // Forward resize events to the parent → backend PTY
      terminal.onResize(({ cols, rows }) => onResizeRef.current(cols, rows))

      terminal.writeln('\x1b[90mReady. Click Run to execute.\x1b[0m')

      // ResizeObserver keeps fitAddon in sync whenever the panel is dragged
      const observer = new ResizeObserver(() => fitAddonRef.current?.fit())
      observer.observe(containerRef.current)

      // Dispose the terminal and disconnect the observer on unmount
      return () => {
        observer.disconnect()
        terminal.dispose()
        terminalRef.current = null
        fitAddonRef.current = null
      }
    }, [])

    // Toggle stdin and cursor when running state changes
    useEffect(() => {
      if (!terminalRef.current) return
      terminalRef.current.options.disableStdin = !isRunning
      terminalRef.current.options.cursorBlink  = isRunning
    }, [isRunning])

    // Imperative API for Programming Terminal parent
    useImperativeHandle(ref, () => ({
      write: (data: string) => terminalRef.current?.write(data),
      clear: ()             => terminalRef.current?.clear(),
    }))

    return (
      <div className="flex flex-col h-full bg-[#0d0d0d]">
        <div className="text-[11px] text-[#888] px-2 py-0.5 bg-[#1a1a1a] border-t border-[#333] uppercase tracking-wide flex-shrink-0">
          Output
        </div>
        <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden" />
      </div>
    )
  }
)

TerminalPane.displayName = 'TerminalPane'