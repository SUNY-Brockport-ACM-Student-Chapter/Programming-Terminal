import {EditorState, Compartment} from "@codemirror/state"
import {EditorView, basicSetup} from "codemirror"
import { keymap } from "@codemirror/view"
import {indentWithTab} from "@codemirror/commands"
import {StreamLanguage} from "@codemirror/language"
import {syntaxTree} from "@codemirror/language"
import {linter, lintGutter, type Diagnostic} from "@codemirror/lint"
import {oneDark} from "@codemirror/theme-one-dark"

import {pythonLanguage} from "@codemirror/lang-python" // Python is imported without auto-completion
import {java} from "@codemirror/lang-java"
import {cpp} from "@codemirror/lang-cpp"
import { sql } from "@codemirror/lang-sql"
import { rust } from "@codemirror/lang-rust"
import { go } from "@codemirror/lang-go"
import {javascript} from "@codemirror/lang-javascript"
import { cobol } from "@codemirror/legacy-modes/mode/cobol"
import {shell} from "@codemirror/legacy-modes/mode/shell"
import {commonLisp} from "@codemirror/legacy-modes/mode/commonlisp"
import { r } from "codemirror-lang-r"
//import {prolog} from "@codemirror/legacy-modes/mode/prolog"

// Language support mapping NOTE: Prolog was removed due to errors. Will re-add later
export const SUPPORTED_LANGUAGES =[ 'c', 'cobol','cpp', 'go', 'java', 'javascript', 'python', 'lisp',
    'r', 'rust','shell', 'sql', 'typescript'] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]

export const languageExtensions: Record<SupportedLanguage, any> = {
    c: cpp(),
    cpp: cpp(),
    go: go(),
    java: java(),
    javascript: javascript(),
    python: pythonLanguage,
    sql: sql(),
    r: r(),
    rust: rust(),
    typescript: javascript({ typescript: true }),
    cobol: StreamLanguage.define(cobol),
    shell: StreamLanguage.define(shell),
    lisp: StreamLanguage.define(commonLisp),
    //prolog: StreamLanguage.define(prolog)
}

export const startingCode: Record<SupportedLanguage, string> = {
    python: '# Python\ndef greet(name: str) -> str:\n    return f"Hello, {name}!"\n\nprint(greet("World"))\n',
    java:   '// Java\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
    c:      '// C\n#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n',
    cpp:    '// C++\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n',
    shell:  '#!/bin/bash\necho "Hello, World!"\nls -la\n',
    lisp:   '; Common Lisp\n(defun greet (name)\n  (format t "Hello, ~a!~%" name))\n\n(greet "World")\n',
    r:      '# R\nprint("Hello, World!")\n',
    rust:   '// Rust\nfn main() {\n    println!("Hello, World!");\n}\n',
    sql:    '-- SQL\nSELECT *;\n',
    go:     '// Go\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n',
    typescript: '// TypeScript\nfunction greet(name: string): string {\n    return `Hello, ${name}!`;\n}\n\nconsole.log(greet("World"));\n',
    javascript: '// JavaScript\nfunction greet(name) {\n    return `Hello, ${name}!`;\n}\n\nconsole.log(greet("World"));\n',
    cobol: '* COBOL\nIDENTIFICATION DIVISION.\nPROGRAM-ID. HELLO-WORLD.\nPROCEDURE DIVISION.\n    DISPLAY "Hello, World!".\n    STOP RUN.\n',
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

  
  //The EditorState is a state object that maintains the data structures and modifications that make up your document.
  const state = EditorState.create({
    doc: config.doc ?? startingCode[lang],
    extensions: [
      basicSetup, // Basic editor features like line numbers, syntax highlighting, etc.
      keymap.of([indentWithTab]), // Enable tab indentation
      languageCompartment.of(languageExtensions[lang]), // Set initial language support
      oneDark, // One Dark theme for better aesthetics
      codeLinter, // Custom linter for syntax error feedback
      lintGutter(), // Show linting errors in the gutter
      EditorView.lineWrapping, // Enable line wrapping for better readability
      EditorView.updateListener.of((update) => { 
        if (update.docChanged) {
          config.onChange?.(update.state.doc.toString())
        }
      }),
    ],
  })

  /*
  EditorView is a display adapter that translates the state into a visible editor you can interact with.
  Those interactions are then translated into state updates.
  */
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

// The linter provides syntax error feedback by scanning the syntax tree for nodes named "⚠" and marking them as errors.
  const codeLinter = linter((view) => {
    const diagnostics: Diagnostic[] = []

    syntaxTree(view.state).cursor().iterate(node => {
      // In CodeMirror's syntax tree, nodes with the name "⚠" indicate syntax errors.
      if (node.name === "⚠")
      {
        let pos = node.from

        // Walk back from the error node past any whitespaces and newlines to find the most accurate position the error occurred 
        while(pos > 0)
        {
          const char = view.state.doc.sliceString(pos - 1, pos)
          if(char !== ' ' && char !== '\t' && char !== '\n' && char !== '\r')
          {
            break
          }
          pos--
        }

        // If we moved back, use that position. Otherwise, use the original node position.
        const adjustedPos = pos > 0 ? pos : node.from
        diagnostics.push({
          from: adjustedPos, // Start position of where the error is located
          to: adjustedPos, // End position of the error
          severity: "error",
          message: "Syntax error"
        })
      }
    })

    return diagnostics
})