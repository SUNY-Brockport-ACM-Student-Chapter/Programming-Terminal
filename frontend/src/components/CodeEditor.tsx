import { useState, useRef, useCallback, useEffect } from 'react'
import { Group, Panel, Separator} from 'react-resizable-panels'
import { Toolbar } from './Toolbar'
import { TabBar } from './TabBar'
import { EditorPane, type EditorHandle } from './EditorPane'
import { TerminalPane, type TerminalHandle } from './TerminalPane'
import { useExecutionSocket } from '../hooks/useExecutionSocket'
import { getStarterFiles, newFileTemplate } from '../core/starterCode'
import type { Language, EditorFile } from '../types'

// Defines what the parent (App.tsx) passes to this component
interface CodeEditorProps {
  language: Language
  wsUrl:    string
  initialFiles?: EditorFile[] 
  entryPoint?: string // this one is for Java to determine which file holds main()
  allowedLanguages?: Language[]
  onLanguageChange?: (lang: Language) => void
  onFilesChange?: (files: EditorFile[]) => void 
  onExecutionResult?: (result: {output: string; exitCode: number | null; error?: string}) => void
}

function detectJavaEntryPoint(files: EditorFile[]): string {
  for(const file of files)
  {
    if(file.content.includes('public static void main')){
      return file.filename.replace('.java', '')
    }
  }
  // Fallback to Main if there's no main method found
  return 'Main' 
}

// CodeEditor is the main component that owns all state and wires everything together
export function CodeEditor({ 
  language, 
  wsUrl, 
  initialFiles, 
  entryPoint, 
  allowedLanguages, 
  onLanguageChange, 
  onFilesChange, 
  onExecutionResult }: CodeEditorProps) {
  // Track if a process is currently executing
  const [isRunning, setIsRunning] = useState(false)
  // layout controls the panel orientation 
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical')

  // files is the array of all open files, activeId is the id of the currently active file
  const [editorState, setEditorState] = useState(() => {
    const fileState = initialFiles ?? getStarterFiles(language)
    return { files: fileState, activeId: fileState[0].id}
  })

  // Helper functions to update files and activeId in a single state object
  const { files, activeId } = editorState

  // gives access to EditorPane's imperative API
  const editorRef   = useRef<EditorHandle>(null)
  // gives access to TerminalPane's imperative API
  const terminalRef = useRef<TerminalHandle>(null)

  // Accumulates stdout/stderr for the current program being run, so it can be handed to the onExecutionResult once the process exits
  const outputBufferRef = useRef('')

  // Track whether this is the first render, so we can avoid overwriting the initialFiles prop on mount
  const isFirstRender = useRef(true)

  // Reset entire file state for different questions
  useEffect(() => {
    if(initialFiles && initialFiles.length > 0){
      setEditorState({ files: initialFiles, activeId: initialFiles[0].id})
    }
  }, [initialFiles])

  // When a new language is selected from the toolbar, reset to starter files for new language
  useEffect(() => {
    if(isFirstRender.current){
      isFirstRender.current = false
      return 
    }
    const starter = getStarterFiles(language)
    setEditorState({ files: starter, activeId: starter[0].id })
  }, [language])

  // Load active file content into the editor whenever the active tab changes
  const activeFile = files.find(f => f.id === activeId)
  useEffect(() => {
    if(activeFile){
      editorRef.current?.setValue(activeFile.content)
    }
  }, [activeId])

  // Save content of active file when editor reports a change
  const handleContentChange = useCallback((code: string) => {
    setEditorState(prev => {
      const updated = prev.files.map(f => f.id === prev.activeId ? {...f, content: code} : f)
      onFilesChange?.(updated)
      return { ...prev, files: updated}
    })
  }, [onFilesChange])

  // Switch tabs - save current content to active file first
  const handleTabSelect = useCallback((id: string) => {
    const currentContent = editorRef.current?.getValue() ?? ''
    setEditorState(prev => ({
      files: prev.files.map(f =>
        f.id === prev.activeId ? { ...f, content: currentContent } : f
      ),
      activeId: id,
    }))
  }, [])

  // Close a tab - if it's the active one, switch to another tab first
  const handleTabClose = useCallback((id:string) => {
    setEditorState(prev => {
      const remaining = prev.files.filter(f => f.id !== id)
      const newActiveId = id === prev.activeId && remaining.length > 0 ? remaining[0].id : prev.activeId
      return { files: remaining, activeId: newActiveId}
    })
  }, [])

  // Add a new file tab
  const handleTabAdd = useCallback((filename: string) => {
    const newFile = newFileTemplate(language, filename)
    setEditorState(prev => ({
      files: [...prev.files, newFile],
      activeId: newFile.id
    }))
  }, [language])

  

  // WebSocket execution hook
  const { run, stop, sendInput, sendResize } = useExecutionSocket({
    wsUrl,

    onReady: useCallback(() => {
      setIsRunning(true)
      outputBufferRef.current = '' // safety reset in case of mid-session disconnect
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

  // Run handler - saves active file content and sends all files to server
 const handleRun = useCallback(() => {
  const currentContent = editorRef.current?.getValue() ?? ''
  const allFiles = files.map(f => f.id === activeId ? {...f, content: currentContent} : f)
  if(allFiles.every(f => !f.content.trim())) return

  outputBufferRef.current = ''
  terminalRef.current?.clear()

  const ep = entryPoint ?? (language === 'java' ? detectJavaEntryPoint(allFiles) : undefined)

  run(language, allFiles, ep)
 }, [files, activeId, language, entryPoint, run])

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

      <TabBar
        files={files}
        activeId={activeId}
        language={language}
        onSelect={handleTabSelect}
        onClose={handleTabClose}
        onAdd={handleTabAdd}
      />

      <Group orientation={layout} className="flex-1 min-h-0" >
        <Panel defaultSize={60} minSize={20}>
          <EditorPane
            ref={editorRef}
            language={language}
            initialContent={activeFile?.content ?? ''}
            onContentChange={handleContentChange}
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