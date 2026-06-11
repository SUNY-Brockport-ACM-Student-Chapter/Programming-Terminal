/*
This file defines a custom web component that wraps createEditor in a Shadow DOM.
(A Shadow Document Object model provides encapsulation for the component's internal structure and styles, preventing them from affecting or being affected by the rest of the page.)

It adds a toolbar with language selection, Run button, and AI Feedback button, and integrates an xterm.js terminal for output display.
*/
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import xtermCss from '@xterm/xterm/css/xterm.css?inline'

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
    'editor-stop': {}
    'terminal-input': {data: string} // Fired for every keystroke index.ts forwards to stdin, only while running.
    'terminal-resize': {cols: number; rows: number} // When the terminal is resized index.ts notifies the backend PTY
}

export class CodeEditorElement extends HTMLElement {
    private editor!: EditorInstance
    private terminal!: Terminal
    private fitAddon!: FitAddon // For resizing the terminal to fit its container
    private language: SupportedLanguage = 'java' // default language
    private isRunning: boolean = false

    static get observedAttributes() {
        return ['language', 'code']
    }

    constructor(){
        super()
        this.attachShadow({mode: 'open'}) // Use Shadow DOM to encapsulate styles and structure
    }

    // Initialize the editor and terminal when the component is added to the DOM
    connectedCallback(){
        this.language = (this.getAttribute('language') as SupportedLanguage) ?? 'java'
        const initialCode = this.getAttribute('code') ?? startingCode[this.language]
        this.buildDOM()
        this.initEditor(initialCode)
        this.initTerminal()
        this.bindToolbar()
    }

    // Clean up resources when the component is removed from the DOM
    disconnectedCallback(){
        this.editor?.destroy()
        this.terminal?.dispose()
    }

    // Respond to attribute changes (e.g., language or code updates)
    attributeChangedCallback(name:string, _oldValue: string | null, newValue: string | null){
        if(!this.editor) return

        if(name === 'language' && newValue && SUPPORTED_LANGUAGES.includes(newValue as SupportedLanguage)){
            this.language = newValue as SupportedLanguage
            this.editor.setLanguage(this.language)
            const select = this.shadowRoot!.querySelector<HTMLSelectElement>('#lang-select')
            if(select) select.value = this.language
        }

        if(name === 'code' && newValue !== null){
            this.editor.setValue(newValue)
        }
    }

    // Build the component's internal DOM structure and styles
    private buildDOM(){

        const shadow = this.shadowRoot!

        //  Inject xterm.css styles directly into the Shadow DOM to style the terminal
        const xtermStyle = document.createElement('style')
        xtermStyle.textContent = xtermCss
        shadow.appendChild(xtermStyle)


    shadow.innerHTML += `
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
          background: #252525;
          border-bottom: 1px solid #343434;
          flex-shrink: 0;
        }

        select {
          background: #3c3c3c;
          color: #d4d4d4;
          border: 1px solid #555;
          padding: 3px 16px;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
        }

        button {
          background: #005c17;
          color: white;
          border: none;
          padding: 4px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        button:hover    { background: #008020; }
        button:disabled { background: #555; cursor: not-allowed; }

        #stop-btn { background: #6b2020;}
        #stop-btn:hover    { background: #8b3030; }
        #stop-btn:disabled { background: #555; cursor: not-allowed; }

        .editor-area {
          flex: 1;
          font-size: 14px;
          overflow: auto;
          min-height: 0; /* Allow the editor to shrink properly in flex layout */
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
        .cm-scroller { min-height: 300px; max-height: 300px;} /* Sets a fixed height for the editor area. */

      </style>

      <div class="toolbar">
        <select id="lang-select">
          <option value="c">C</option>
          <option value="java">Java</option>
          <option value="python">Python</option>
          <option value="shell">Unix / Shell</option>
          <option value="lisp">Common Lisp</option>
          <option value="prolog">Prolog</option>
        </select>

        <button id="run-btn">&#9654; Run</button>
        <button id="kill-btn" disabled>&#9632; Stop</button>

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



/*  Initialize the xterm.js terminal
    xterm.js renders ANSI color codes, so GCC/javac/Python error messages display with proper colors
    For interactive languages (Prolog, Lisp, etc.) call attachInteractiveSession() to wire in a WebSocket REPL
*/

private initTerminal(){

    const terminalArea = this.shadowRoot!.querySelector<HTMLDivElement>('#terminal-area')!

    this.terminal = new Terminal({

      theme: {
        background: '#0d0d0d',
        foreground: '#d4d4d4',
        cursor:     'transparent', // Hide the cursor until we enter interactive mode
        cursorAccent: 'transparent',
        red:        '#cd3131',
        green:      '#0dbc79',
        yellow:     '#e5e510',
        blue:       '#2472c8',
        cyan:       '#11a8cd',
      },

      fontSize:     14,
      fontFamily:   'Menlo, Monaco, "Courier New", monospace',
      cursorBlink:  false,
      //cursorStyle: 'bar',
      //cursorInactiveStyle: 'none',
      disableStdin: true,   // read-only mode by defualt
      convertEol:   true,   // \n → \r\n for correct line endings
    })

    this.fitAddon = new FitAddon()
    this.terminal.loadAddon(this.fitAddon)
    this.terminal.open(terminalArea)
    requestAnimationFrame(() => this.fitAddon.fit())

    new ResizeObserver(() => this.fitAddon.fit()).observe(terminalArea)

    // onData only fires when the code is being executed (while running)
    this.terminal.onData((data) => {
      this.emit('terminal-input', { data })
    })

    // Keeps the backend PTY (pseudo-terminal) dimensions in sync with what the ui is displaying
    this.terminal.onResize(({cols, rows}) => {
      this.emit('terminal-resize', { cols, rows })
    })

    this.terminal.writeln('\x1b[37mReady. Click Run to execute code.\x1b[0m')

}


// Set up event listeners for the toolbar buttons and language selector.
private bindToolbar(){

    const shadow = this.shadowRoot!

    // Run button event listener
    shadow.querySelector('#run-btn')?.addEventListener('click', () => {
      this.terminal.clear()
      this.emit('editor-run', {code: this.editor.getValue(), language: this.language})
    })

    // Stop button event listener 
    shadow.querySelector('#stop-btn')!.addEventListener('click', () => {
      this.emit('editor-stop', {})
    })

    // Language selection event listener
    shadow.querySelector<HTMLSelectElement>('#lang-select')?.addEventListener('change', (e) => {
      this.language = (e.target as HTMLSelectElement).value as SupportedLanguage
      this.editor.setLanguage(this.language)
    })  

} 


    /* 
    Public API (Application Programming Interface) for interacting with the component 
    */

   // Get the current code from the editor
    getValue(): string { 
        return this.editor.getValue()
    }

    // Set the code in the editor
    setValue(val: string) {
        return this.editor.setValue(val)
    }

    // Set the programming language
    setLanguage(lang: SupportedLanguage) { 
      this.language = lang
      this.editor.setLanguage(lang)
      const select = this.shadowRoot!.querySelector<HTMLSelectElement>('#lang-select')
      if(select) select.value = lang
    }

    
    // Stream output to the terminal
    streamOutput(data: string) {
      this.terminal.write(data)
    }

    // Clear the terminal
    clearTerminal() {
      this.terminal.clear()
    }

    // Controls terminal's interactive state
    setRunningState(running: boolean) {
      this.isRunning = running
      const runBtn = this.shadowRoot!.querySelector<HTMLButtonElement>('#run-btn')!
      const stopBtn = this.shadowRoot!.querySelector<HTMLButtonElement>('#stop-btn')!
      runBtn.disabled = running
      stopBtn.disabled = !running
      this.terminal.options.cursorBlink = running
      this.terminal.options.disableStdin = !running
    }

    // Emit custom events to communicate with the outside world (e.g., when code changes, when Run is clicked, when AI Feedback is requested)
    private emit<K extends keyof CodeEditorEvents>(type: K, detail: CodeEditorEvents[K]){
        this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }))
    }
}

// Define the custom element, making it available for use in HTML as <code-editor></code-editor>
customElements.define('code-editor', CodeEditorElement)