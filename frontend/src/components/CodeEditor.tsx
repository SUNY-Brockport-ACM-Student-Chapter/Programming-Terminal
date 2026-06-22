import { useState, useRef, useCallback } from 'react'
import { Group, Panel, Separator} from 'react-resizable-panels'
import { Toolbar } from './Toolbar'
import { EditorPane, type EditorHandle } from './EditorPane'
import { TerminalPane, type TerminalHandle } from './TerminalPane'
import { useExecutionSocket } from '../hooks/useExecutionSocket'
import type { Language } from '../types'

interface CodeEditorProps {
  language: Language
  wsUrl:    string
  onLanguageChange?: (lang: Language) => void
}

export function CodeEditor({ language, wsUrl, onLanguageChange }: CodeEditorProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [layout, setLayout]       = useState<'vertical' | 'horizontal'>('vertical')

  const editorRef   = useRef<EditorHandle>(null)
  const terminalRef = useRef<TerminalHandle>(null)

  // WebSocket execution hook
  const { run, stop, sendInput, sendResize } = useExecutionSocket({
    wsUrl,

    onReady: useCallback(() => {
      setIsRunning(true)
    }, []),

    onOutput: useCallback((data: string) => {
      terminalRef.current?.write(data)
    }, []),

    onExit: useCallback((code: number | null) => {
      setIsRunning(false)
      terminalRef.current?.write(
        `\r\n\x1b[90m[Process exited with code ${code ?? 0}]\x1b[0m\r\n`
      )
    }, []),

    onError: useCallback((message: string) => {
      setIsRunning(false)
      terminalRef.current?.write(`\r\n\x1b[31m[Error: ${message}]\x1b[0m\r\n`)
    }, []),
  })

  // Run handler
  const handleRun = useCallback(() => {
    const code = editorRef.current?.getValue() ?? ''
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
            onContentChange={() => {}}
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