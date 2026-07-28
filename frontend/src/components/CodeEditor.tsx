import { useState, useRef, useCallback, useEffect } from 'react'
import { Group, Panel, Separator} from 'react-resizable-panels'
import { Toolbar } from './Toolbar'
import { EditorPane, type EditorHandle } from './EditorPane'
import { TerminalPane, type TerminalHandle } from './TerminalPane'
import { useExecutionSocket } from '../hooks/useExecutionSocket'
import type { Language } from '../types'

// Defines what the parent (App.tsx) passes to this component
interface CodeEditorProps {
  language: Language
  wsUrl:    string
  initialCode?: string 
  allowedLanguages?: Language[]
  onLanguageChange?: (lang: Language) => void
  onCodeChange?: (code:string) => void 
  onExecutionResult?: (result: {output: string; exitCode: number | null; error?: string}) => void
}

// CodeEditor is the main component that owns all state and wires everything together
export function CodeEditor({ language, wsUrl, initialCode, allowedLanguages, onLanguageChange, onCodeChange, onExecutionResult }: CodeEditorProps) {
  // Track if a process is currently executing
  const [isRunning, setIsRunning] = useState(false)
  // layout controls the panel orientation 
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical')

  // gives access to EditorPane's imperative API
  const editorRef   = useRef<EditorHandle>(null)
  // gives access to TerminalPane's imperative API
  const terminalRef = useRef<TerminalHandle>(null)

  // Accumulates stdout/stderr for the current program being run, so it can be handed to the onExecutionResult once the process exits
  const outputBufferRef = useRef('')

  useEffect(() => {
    if(initialCode !== undefined){
      editorRef.current?.setValue(initialCode)
    }
  }, [initialCode])

  // WebSocket execution hook
  const { run, stop, sendInput, sendResize } = useExecutionSocket({
    wsUrl,

    onReady: useCallback(() => {
      setIsRunning(true)
    }, []),

    onOutput: useCallback((data: string) => {
      outputBufferRef.current += data
      terminalRef.current?.write(data)
    }, []),

    onExit: useCallback((code: number | null) => {
      setIsRunning(false)
      terminalRef.current?.write(
        `\r\n\x1b[37m[Process exited with code ${code ?? 0}]\x1b[0m\r\n`
      )
      onExecutionResult?.({output: outputBufferRef.current, exitCode: code ?? null})
    }, [onExecutionResult]),

    onError: useCallback((message: string) => {
      setIsRunning(false)
      terminalRef.current?.write(`\r\n\x1b[31m[Error: ${message}]\x1b[0m\r\n`)
      onExecutionResult?.({output: outputBufferRef.current, exitCode: null, error: message})
    }, [onExecutionResult]),
  })

  // Run handler
  const handleRun = useCallback(() => {
    const code = editorRef.current?.getValue() ?? ''
    // Don't send an empty run request
    if (!code.trim()) return
    outputBufferRef.current = ''
    terminalRef.current?.clear()
    run(language, code)
  }, [language, run])

  // Resize handle CSS. Changes based on panel direction 
  const resizeHandleClass = layout === 'horizontal'
    ? 'w-1 bg-[#444] hover:bg-[#666] transition-colors cursor-col-resize flex-shrink-0'
    : 'h-1 bg-[#444] hover:bg-[#666] transition-colors cursor-row-resize flex-shrink-0'

  return (
    <div className="flex flex-col h-full w-full bg-[#1e1e1e] text-[#d4d4d4]">
      <Toolbar
        language={language}
        isRunning={isRunning}
        layout={layout}
        allowedLanguages={allowedLanguages}
        onRun={handleRun}
        onStop={stop}
        onLanguageChange={(lang) => onLanguageChange?.(lang)}
        onLayoutToggle={() =>
          setLayout(l => l === 'vertical' ? 'horizontal' : 'vertical')
        }
      />

      <Group orientation={layout} className="flex-1 min-h-0" >
        <Panel defaultSize={60} minSize={20}>
          <EditorPane
            ref={editorRef}
            language={language}
            onContentChange={(code) => {onCodeChange?.(code)}}
          />
        </Panel>

        <Separator className={resizeHandleClass} />

        <Panel defaultSize={40} minSize={15}>
          <TerminalPane
            ref={terminalRef}
            isRunning={isRunning}
            onData={sendInput}
            onResize={sendResize}
          />
        </Panel>
      </Group>
    </div>
  )
}