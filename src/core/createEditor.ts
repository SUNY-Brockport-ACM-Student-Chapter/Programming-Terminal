import {EditorState, Compartment} from "@codemirror/state"
import {EditorView, basicSetup} from "codemirror"
import { keymap } from "@codemirror/view"
import {indentWithTab} from "@codemirror/commands"
import {StreamLanguage} from "@codemirror/language"
import {oneDark} from "@codemirror/theme-one-dark"

import {python} from "@codemirror/lang-python"
import {java} from "@codemirror/lang-java"
import {cpp} from "@codemirror/lang-cpp"
import {shell} from "@codemirror/legacy-modes/mode/shell"
import {commonLisp} from "@codemirror/legacy-modes/mode/commonlisp"
//import {prolog} from "@codemirror/legacy-modes/mode/prolog"

// Language support mapping NOTE: Prolog was removed due to errors. Will re-add later
export const SUPPORTED_LANGUAGES =['python', 'java', 'c', 
    'shell', 'lisp', ] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]

export const languageExtensions: Record<SupportedLanguage, any> = {
    python: python(),
    java: java(),
    c: cpp(),
    shell: StreamLanguage.define(shell),
    lisp: StreamLanguage.define(commonLisp),
    //prolog: StreamLanguage.define(prolog)
}

export const startingCode: Record<SupportedLanguage, string> = {
    python: '# Python\ndef greet(name: str) -> str:\n    return f"Hello, {name}!"\n\nprint(greet("World"))\n',
    java:   '// Java\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
    c:      '// C\n#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n',
    shell:  '#!/bin/bash\necho "Hello, World!"\nls -la\n',
    lisp:   '; Common Lisp\n(defun greet (name)\n  (format t "Hello, ~a!~%" name))\n\n(greet "World")\n',
    //prolog: "% Prolog\n:- initialization(main).\n\nmain :-\n    write('Hello, World!'), nl.\n",
}

// Editor Instance - the public API returned by createEditor
export type EditorInstance = {
    view: EditorView
    getValue: () => string
    setValue: (val: string) => void
    setLanguage: (lang: SupportedLanguage) => void
    destroy: () => void
}

// Create a CodeMirror editor instance
export function createEditor(
  parent: HTMLElement, // The DOM element to which the editor will be attached
  config: {
    language?: SupportedLanguage
    doc?:      string
    onChange?: (val: string) => void
  }
): EditorInstance {
  const lang = config.language ?? 'java' // set the default language to Java
  const languageCompartment = new Compartment() // Compartment allows dynamic reconfiguration of language support

  const state = EditorState.create({
    doc: config.doc ?? startingCode[lang],
    extensions: [
      basicSetup, // Basic editor features like line numbers, syntax highlighting, etc.
      keymap.of([indentWithTab]), // Enable tab indentation
      languageCompartment.of(languageExtensions[lang]), // Set initial language support
      oneDark, // One Dark theme for better aesthetics
      EditorView.lineWrapping, // Enable line wrapping for better readability
      EditorView.updateListener.of((update) => { 
        if (update.docChanged) {
          config.onChange?.(update.state.doc.toString())
        }
      }),
    ],
  })

  const view = new EditorView({ state, parent })

  return{
    view,
    getValue: () => view.state.doc.toString(),
    
    setValue: (val: string) => 
        view.dispatch({changes: {from:0, to: view.state.doc.length, 
            insert: val }}), 
        
        // Compartment.reconfigure() swaps the language without rebuilding the editor
        // Undo history, cursor position, and scroll state are preserved.
    setLanguage:(lang: SupportedLanguage) => 
    {
        view.dispatch({
            changes: {from: 0, to : view.state.doc.length, insert: startingCode[lang]},
            effects: languageCompartment.reconfigure(languageExtensions[lang])
        })
    },

    destroy: () => view.destroy(),
  }
}