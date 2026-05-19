import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { AttachAddon } from "@xterm/addon-attach"
import '@xterm/xterm/css/xterm.css'

import {
    createEditor,
    startingCode,
    SUPPORTED_LANGUAGES,
    type EditorInstance,
    type SupportedLanguage,
} from "../core/createEditor"

// Typed event map
export type CodeEditorEvents = {
    'editor-change': { value: string }
    'editor-run': {code: string; language: string}
    // editor-ai includes terminal context fo the AI sees what happened at runtime, not just what the source code says
    'editor-ai': {
        code: string
        language: string
        terminalOutput: string // last batch run stdout + stderr output
        sessionTranscript: string // interactive REPL input/output log
    }
}

export class CodeEditorElement extends HTMLElement {
    private editor!: EditorInstance
    private terminal!: Terminal
    private fitAddon!: FitAddon
    private language: SupportedLanguage = 'java' // default language
    private lastOutput: string = '' // store last terminal output for AI context
    private sessionTranscript: string[] = [] // store REPL session transcript for AI context

    static get observedAttributes() {
        return ['language', 'code']
    }

    constructor(){
        super()
        this.attachShadow({mode: 'open'})
    }

    connectedCallback(){
        this.language = (this.getAttribute('language') as SupportedLanguage) ?? 'java'
        const initalCode = this.getAttribute('code') ?? startingCode[this.language]
            this.buildDOM()
            this.initEditor(initalCode)
            this.initTerminal()
            this.bindToolbar()
    }

    disconnectedCallback(){
        this.editor?.destroy()
        this.terminal?.dispose()
    }

    attributeChangedCallback(name:string, oldValue: string | null, newValue: string | null){
        if(!this.editor) return

        if(name === 'language' && newValue && SUPPORTED_LANGUAGES.includes(newValue as SupportedLanguage)){
            this.language = newValue as SupportedLanguage
            this.editor.setLanguage(this.language)
            const select = this.shadowRoot!.querySelector<HTMLSelectElement>('#language-select')
            if(select) select.value = this.language
        }

        if(name === 'code' && newValue !== null){
            this.editor.setValue(newValue)
        }
    }

    private buildDOM(){
        const shadow = this.shadowRoot!
    shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e1e1e;
          color: #d4d4d4;
          font-family: sans-serif;
        }
        .toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          background: #2d2d2d;
          border-bottom: 1px solid #444;
          flex-shrink: 0;
        }
        select {
          background: #3c3c3c;
          color: #d4d4d4;
          border: 1px solid #555;
          padding: 3px 6px;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
        }
        button {
          background: #0e639c;
          color: white;
          border: none;
          padding: 4px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        }
        button:hover    { background: #1177bb; }
        button:disabled { background: #555; cursor: not-allowed; }
        .editor-area {
          flex: 1;
          overflow: auto;
          min-height: 0;
        }
        .terminal-label {
          font-size: 11px;
          color: #888;
          padding: 2px 8px;
          background: #1a1a1a;
          border-top: 1px solid #333;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          flex-shrink: 0;
        }
        .terminal-area {
          height: 200px;
          background: #0d0d0d;
          flex-shrink: 0;
          overflow: hidden;
          padding: 4px;
        }
        .cm-editor  { height: 100%; }
        .cm-scroller { overflow: auto; }
      </style>

      <div class="toolbar">
        <select id="lang-select">
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="c">C</option>
          <option value="shell">Unix / Shell</option>
          <option value="lisp">Common Lisp</option>
          <option value="prolog">Prolog</option>
        </select>
        <button id="run-btn">&#9654; Run</button>
        <button id="ai-btn">&#10022; AI Feedback</button>
      </div>

      <div class="editor-area" id="editor-area"></div>
      <div class="terminal-label">Output</div>
      <div class="terminal-area" id="terminal-area"></div>
    `

    shadow.querySelector<HTMLSelectElement>('#lang-select')!.value = this.language
}

// Initialize the CodeMirror editor
private initEditor(initialCode: string){
    const editorArea = this.shadowRoot!.querySelector<HTMLDivElement>('#editor-area')!
    this.editor = createEditor(editorArea, {
        language: this.language,
        doc: initialCode,
        onChange: (val) => this.emit('editor-change', { value: val }),
    })
}

// Initialize the xterm.js terminal
// xterm.js renders ANSI color codes, so GCC/javac/Python error messages display with proper colors
// For interactive languages (Prolog, Lisp, etc.) call attachInteractiveSession() to wire in a WebSocket REPL
private initTerminal(){
    const terminalArea = this.shadowRoot!.querySelector<HTMLDivElement>('#terminal-area')!

    this.terminal = new Terminal({
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
      disableStdin: true,   // batch mode by default
      convertEol:   true,   // \n → \r\n for correct line endings
    })

    this.fitAddon = new FitAddon()
    this.terminal.loadAddon(this.fitAddon)
    this.terminal.open(terminalArea)
    this.fitAddon.fit()

    new ResizeObserver(() => this.fitAddon.fit()).observe(terminalArea)
    this.terminal.writeln('\x1b[90mReady. Click Run to execute code.\x1b[0m')
}

private bindToolbar(){
    const shadow = this.shadowRoot!
    
}


// Event helper to emit typed custom events
private emit<K extends keyof CodeEditorEvents>(type: K, detail: CodeEditorEvents[K]){
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }))
    }
}