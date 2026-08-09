import type { Extension } from '@codemirror/state'
import { forwardRef, useEffect, useImperativeHandle, useRef} from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor,
         rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab }  from '@codemirror/commands'
import { indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentUnit } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { getLanguageExtension } from '../core/languages'
import type { Language } from '../types'

// Defines imperative API the parent (CodeEditor) can call
export interface EditorHandle {
  getValue(): string // returns current content of the editor
  setValue(code: string): void // replaces the editor content with new code 
}


interface EditorPaneProps {
  language: Language // currently selected language
  initialContent: string // content of the currently active file 
  onContentChange: (code: string) => void // called whenever the editor content changes 
}

const languageCompartment = new Compartment()

export const EditorPane = forwardRef<EditorHandle, EditorPaneProps>(
  ({ language, initialContent, onContentChange }, ref) => {
    // Points to div that CodeMirror will render into 
    const containerRef = useRef<HTMLDivElement>(null)
    // Holds the CodeMirror Editorview instance
    const viewRef = useRef<EditorView | null>(null)
    // Keep a stable ref to onContentChange to avoid recreating the editor
    const onChangeRef  = useRef(onContentChange)
    // Update the ref whenever the callback prop changes
    useEffect(() => { onChangeRef.current = onContentChange }, [onContentChange])

    // Initialize CodeMirror once on mount
    useEffect(() => {
      if (!containerRef.current) return

      // Create initial editor state will all extensions configured
      const view = new EditorView({
        state: EditorState.create({
          doc: initialContent,
          extensions: [
            lineNumbers(),
            highlightActiveLineGutter(),
            highlightSpecialChars(),
            history(),
            foldGutter(),
            drawSelection(),
            dropCursor(),
            EditorState.allowMultipleSelections.of(true),
            indentOnInput(),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            bracketMatching(),
            rectangularSelection(),
            crosshairCursor(),
            highlightActiveLine(),
            keymap.of([
              ...defaultKeymap,
              ...historyKeymap,
              indentWithTab,
            ]),
            indentUnit.of('    '),
            oneDark,
            languageCompartment.of(getLanguageExtension(language) as Extension),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                onChangeRef.current(update.state.doc.toString())
              }
            }),
            EditorView.theme({
              '&': { height: '100%' },
              '.cm-scroller': { overflow: 'auto' },
            }),
          ],
        }),
        // mount the editor into the container div
        parent: containerRef.current,
      })

      // Store view in ref for later use
      viewRef.current = view
      // Notify parent of initial content
      onChangeRef.current(view.state.doc.toString())

      // Destroy the Codemirror instance when the component unmounts
      return () => {
        view.destroy()
        viewRef.current = null
      }
    }, []) // Only on mount — language is handled by the next effect

    // Swap language extension when language prop changes
    useEffect(() => {
      if (!viewRef.current) return
      viewRef.current.dispatch({
        effects: languageCompartment.reconfigure(getLanguageExtension(language) as Extension),
      })
    }, [language])

    // Imperative API for Programming Terminal parent
    useImperativeHandle(ref, () => ({
      // returns the current content of the editor as a plain string
      getValue: () => viewRef.current?.state.doc.toString() ?? '',
      // Replaces the entire editor content with the provided code string 
      setValue: (code: string) => {
        if (!viewRef.current) return
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to:   viewRef.current.state.doc.length,
            insert: code,
          },
        })
      },
    }))

    // Render a div that Codemirror populates 
    return (
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden"
      />
    )
  }
)

EditorPane.displayName = 'EditorPane'