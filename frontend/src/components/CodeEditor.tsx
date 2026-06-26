import { useState, useRef, useCallback } from 'react'
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
  onLanguageChange?: (lang: Language) => void
}

// CodeEditor is the main component that owns all state and wires everything together
export function CodeEditor({ language, wsUrl, onLanguageChange }: CodeEditorProps) {
  // Track if a process is currently executing
  const [isRunning, setIsRunning] = useState(false)
  // layout controls the panel orientation 
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical')

  // gives access to EditorPane's imperative API
  const editorRef   = useRef<EditorHandle>(null)
  // gives access to TerminalPane's imperative API
  const terminalRef = useRef<TerminalHandle>(null)

  // Used to accumulate output for the ai feedback
  const outputRef = useRef<string>('')

  // WebSocket execution hook
  const { run, stop, sendInput, sendResize } = useExecutionSocket({
    wsUrl,

    onReady: useCallback(() => {
      setIsRunning(true)
    }, []),

    onOutput: useCallback((data: string) => {
      terminalRef.current?.write(data)
      outputRef.current += data
    }, []),

    onExit: useCallback(async (code: number | null) => {
      setIsRunning(false)
      terminalRef.current?.write(
        `\r\n\x1b[90m[Process exited with code ${code ?? 0}]\x1b[0m\r\n`
      )

      // Analyze code and output after exit for ai feedback
      const currentCode = editorRef.current?.getValue() ?? ''
      const currentOutput = outputRef.current
      outputRef.current = ''

      try{
        const res = await fetch('http://localhost:3001/api/analyze',{
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({code: currentCode, output: currentOutput}),
        })
        const {analysis} = await res.json()
        console.log('[analyze]', analysis)
      }catch(err){
        console.error('[analyze] Failed: ', err)
      }
    }, []),

    onError: useCallback((message: string) => {
      setIsRunning(false)
      terminalRef.current?.write(`\r\n\x1b[31m[Error: ${message}]\x1b[0m\r\n`)
    }, []),
  })

  // Run handler
  const handleRun = useCallback(() => {
    const code = editorRef.current?.getValue() ?? ''
    // Don't send an empty run request
    if (!code.trim()) return
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
            // Tell the platform that the user has typed code that needs to be saved and forward the changes
            onContentChange={(code) => {
              window.parent.postMessage({ 
                type: 'CODE_CHANGE', // The platfrom will have to listen for this message type
                payload: {code, language}
              }, '*')
            }}
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