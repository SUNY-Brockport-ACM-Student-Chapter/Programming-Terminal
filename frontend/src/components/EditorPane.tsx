import type { Extension } from '@codemirror/state'
import { forwardRef, useEffect, useImperativeHandle, useRef} from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor,
         rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab }  from '@codemirror/commands'
import { indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentUnit } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { getLanguageExtension } from '../core/languages'
import { starterCode } from '../core/starterCode'
import type { Language } from '../types'


export interface EditorHandle {
  getValue(): string
  setValue(code: string): void
}

interface EditorPaneProps {
  language: Language
  onContentChange: (code: string) => void
}

const languageCompartment = new Compartment()

export const EditorPane = forwardRef<EditorHandle, EditorPaneProps>(
  ({ language, onContentChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef      = useRef<EditorView | null>(null)
    // Keep a stable ref to onContentChange to avoid recreating the editor
    const onChangeRef  = useRef(onContentChange)
    useEffect(() => { onChangeRef.current = onContentChange }, [onContentChange])

    // Initialize CodeMirror once on mount
    useEffect(() => {
      if (!containerRef.current) return

      const view = new EditorView({
        state: EditorState.create({
          doc: starterCode[language],
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
        parent: containerRef.current,
      })

      viewRef.current = view
      // Notify parent of initial content
      onChangeRef.current(view.state.doc.toString())

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
        changes:{
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: starterCode[language]
        },
      })
    }, [language])

    // Imperative API for Programming Terminal parent
    useImperativeHandle(ref, () => ({
      getValue: () => viewRef.current?.state.doc.toString() ?? '',
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

    return (
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden"
      />
    )
  }
)

EditorPane.displayName = 'EditorPane'