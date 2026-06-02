/*
This file defines a custom web component that wraps createEditor in a Shadow DOM.
It adds a toolbar with language selection, Run button, and AI Feedback button, and integrates an xterm.js terminal for output display.
*/
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { AttachAddon } from "@xterm/addon-attach"
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
    private fitAddon!: FitAddon // For resizing the terminal to fit its container
    private language: SupportedLanguage = 'java' // default language
    private lastOutput: string = '' // store last terminal output for AI context
    private sessionTranscript: string[] = [] // store REPL session transcript for AI context

    static get observedAttributes() {
        return ['language', 'code']
    }

    constructor(){
        super()
        this.attachShadow({mode: 'open'}) // Use Shadow DOM to encapsulate styles and structure
    }

    connectedCallback(){
        this.language = (this.getAttribute('language') as SupportedLanguage) ?? 'java'
        const initalCode = this.getAttribute('code') ?? startingCode[this.language]
            this.buildDOM()
            this.initEditor(initalCode)
            this.initTerminal()
            this.bindToolbar()
            this.bindDragAndDrop()
    }

    disconnectedCallback(){
        this.editor?.destroy()
        this.terminal?.dispose()
    }

    attributeChangedCallback(name:string, _oldValue: string | null, newValue: string | null){ // note: the underscore in _oldValue indicates it's intentionally unused.
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
        // This container holds the editor and terminal
        .workspace-body{ 
          display:flex;
          flex-direction: column; // Stack toolbar, editor, and terminal vertically as default
          flex: 1;
          min-height: 0;
          position: relative;
        }
        .workspace-body.horizontal {
          flex-direction: row; // Place editor and terminal side by side
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
        .editor-area {
          flex: 1;
          font-size: 14px;
          overflow: auto;
          min-height: 0; /* Allow the editor to shrink properly in flex layout */
          min-width: 0; /* Prevent horizontal overflow in flex layout */
        }
        // Keeps the terminal label and area together
        .terminal-container{
          display: flex;
          flex-direction: column;
          background: #0d0d0d;
          flex-shrink: 0;
          height: 200px;
          width: 100%;
        }
        .workspace-body.horizontal .terminal-container{
          height: 100%;
          width: 400px;
        }
        .terminal-label {
          font-size: 11px;
          color: #888;
          padding: 6px 8px;
          background: #1a1a1a;
          border-top: 1px solid #333;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          flex-shrink: 0;
          cursor: grab;
        }
        .terminal-area {
          flex: 1; 
          overflow: hidden;
          padding: 4px;
        }
        .cm-editor  { height: 100%; }
        .cm-scroller { min-height: 300px; max-height: 300px;} /* Sets a fixed height for the editor area. */
      </style>

      <div class="toolbar">
        <select id="lang-select">
          <option value="c">C</option>
          <option value="cobol">COBOL</option>
          <option value="cpp">C++</option>
          <option value="go">Go</option>
          <option value="java">Java</option>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="r">R</option>
          <option value="rust">Rust</option>
          <option value="shell">Unix / Shell</option>
          <option value="sql">SQL</option>
          <option value="typescript">TypeScript</option>
          <option value="lisp">Common Lisp</option>
          <!-- <option value="prolog">Prolog</option> -->
        </select>
        <button id="run-btn">&#9654; Run</button>
        <button id="ai-btn">&#10022; AI Feedback</button>
      </div>

      <div class="workspace-body" id="workspace-body">
        <div class="editor-area" id="editor-area"></div>

        <div class="terminal-container" id="terminal-container">
          <div class="terminal-label" id="terminal-drag-handle" draggable="true">Output</div>
          <div class="terminal-area" id="terminal-area"></div>
        </div>
      </div>
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
      cursorStyle: 'bar',
      cursorInactiveStyle: 'none',
      disableStdin: true,   // batch mode by default
      convertEol:   true,   // \n → \r\n for correct line endings
    })

    this.fitAddon = new FitAddon()
    this.terminal.loadAddon(this.fitAddon)
    this.terminal.open(terminalArea)
    this.fitAddon.fit()

    new ResizeObserver(() => this.fitAddon.fit()).observe(terminalArea)
    this.terminal.writeln('\x1b[37mReady. Click Run to execute code.\x1b[0m')
}

private bindToolbar(){
    const shadow = this.shadowRoot!

    shadow.querySelector('#run-btn')?.addEventListener('click', () => {
      //Clear previous context when a new run starts so the AI feedback only reads the most recent execution
      this.lastOutput = ''
      this.sessionTranscript = []
      this.showOutput('', '', true)
      this.emit('editor-run', {code: this.editor.getValue(), language: this.language})
    })

    shadow.querySelector('#ai-btn')?.addEventListener('click', () => {
      // Include terminal context alongside the source code so the AI can see runtime behavior, not just static code
      this.emit('editor-ai', {
        code: this.editor.getValue(),
        language: this.language,
        terminalOutput: this.lastOutput,
        sessionTranscript: this.sessionTranscript.join('\n'),
      })
    })

    shadow.querySelector<HTMLSelectElement>('#lang-select')?.addEventListener('change', (e) => {
      this.language = (e.target as HTMLSelectElement).value as SupportedLanguage
      this.editor.setLanguage(this.language)
    })  
}

private bindDragAndDrop(){
  const shadow = this.shadowRoot!;
  const workspaceBody = shadow.querySelector<HTMLDivElement>('#workspace-body')!;
  const dragHandle = shadow.querySelector<HTMLDivElement>('#terminal-drag-handle')!;
  const editorArea = shadow.querySelector<HTMLDivElement>('#editor-area')!;

  dragHandle.addEventListener('dragstart', (e) => {
    if(e.dataTransfer){
      e.dataTransfer.setData('application/x-terminal-panel', 'true');
      e.dataTransfer.effectAllowed = 'move';
    }
    dragHandle.style.cursor = 'grabbing';
  });

  dragHandle.addEventListener('dragend', () => {
    dragHandle.style.cursor = 'grab';
  });

  workspaceBody.addEventListener('dragover', (e) => {
    e.preventDefault();
    if(e.dataTransfer){
      e.dataTransfer.dropEffect = 'move';
    }
  });

  workspaceBody.addEventListener('drop', (e) => {
    if(!e.dataTransfer?.getData('application/x-terminal-panel')){
      return; // Not a terminal panel drag, ignore
    }

    e.preventDefault();
    e.stopPropagation(); // Stop CodeMirror from interpreting the drop as a file upload

    // Determine drop position relative to the editor area
    const rect = editorArea.getBoundingClientRect();
    const dropX = e.clientX - rect.left;

    // If dropped on the right 40% of the editor area, move the terminal to the right side.
    if(dropX > rect.width * 0.6){
      workspaceBody.classList.add('horizontal');
    } else {
      // Otherwise, keep the terminal below the editor.
      workspaceBody.classList.remove('horizontal');
    }

    // Trigger xterm's fit addon to resize the terminal after moving
    if(this.fitAddon){
      setTimeout(() => {
        this.fitAddon.fit();
      }, 50); // Slight delay to allow CSS changes to take effect before resizing
    }
  });
}

// Public API

getValue(): string {
    return this.editor.getValue()
}

setValue(val: string) {
    this.editor.setValue(val)
}

setLanguage(lang: SupportedLanguage) {
  this.language = lang
  this.editor.setLanguage(lang)
  const select = this.shadowRoot!.querySelector<HTMLSelectElement>('#language-select')
  if(select) select.value = lang
}

// Display output in the terminal area. 
// Stores output in lastOutput for AI to read when the user clicks AI Feedback after running their code.
showOutput(stdout:string, stderr: string, loading = false){
  this.terminal.clear()

  if(loading)
  {
    this.terminal.writeln('\x1b[33mRunning...\x1b[0m')
    return
  }

  // Combine stdout and stderr into a readable string
  if(stdout || stderr)
  {
    this.lastOutput = [
      stdout ? `STDOUT:\n${stdout}` : '',
      stderr ? `STDERR:\n${stderr}` : ''
    ].filter(Boolean).join('\n\n')

    if(stdout){
      this.terminal.write(stdout)
      if(!stdout.endsWith('\n')) this.terminal.writeln('')
    }

    if(stderr){
      stderr.split('\n').forEach(line => {
        if (line) this.terminal.writeln(`\x1b[31m${line}\x1b[0m`) // Red color for stderr
      })
    }

    if(!stdout && !stderr){
      this.terminal.writeln('\x1b[37mNo output.\x1b[0m')
    }
  }
}

/*
Switch the terminal to interactive REPL mode and capture the full session transcript for AI context.
The WebSocket carries two directions of data:
1. Messages from the the server (container stdout/stderr) arrive as ws.onmessage
2. Keystrokes from the user fire terminal.onData before going to the server

Both are logged into sessionTranscript so the AI feedback can read the full REPL session history, not just the final output.
*/
attachInteractiveSession(ws: WebSocket){
    this.terminal.options.disableStdin = false
    this.terminal.options.cursorBlink = true
    this.terminal.loadAddon(new AttachAddon(ws))

    ws.addEventListener('message', (event) => {
      const text = typeof event.data === 'string' 
        ? event.data 
        : new TextDecoder().decode(event.data as ArrayBuffer)
      if(text.trim()){
        this.sessionTranscript.push(`[OUTPUT] ${text.replace(/\r?\n/g, '')}`)
      }
    })

    //Capture user input (what they type at the prompt). terminal.onData fires before the keystroke is sent to the WebSocket
    this.terminal.onData((data) => {
      // Only log printable characters and Enter key. Skip control characters like arrow keys, Ctrl+C, etc. to keep the transcript focused on user intent rather than terminal control sequences.
      if(data === '\r'){
        this.sessionTranscript.push('[ENTER]')
      }else if (data.charCodeAt(0) >= 32){
        // Accumulate printable chars into last INPUT entry if it exists
        const lastEntry =  this.sessionTranscript[this.sessionTranscript.length - 1]
        if(lastEntry?.startsWith('[INPUT]')){
          this.sessionTranscript[this.sessionTranscript.length - 1] = lastEntry + data
        }else{
          this.sessionTranscript.push(`[INPUT] ${data}`)
        }
      }
    })
  }

  // AI Feedback is displayed in the terminal for now. Will likely be in the platform's own container
  showFeedback(text: string){
    this.terminal.writeln('')
    this.terminal.writeln('\x1b[36m=== AI Feedback ===\x1b[0m')
    text.split('\n').forEach(line => {
      this.terminal.writeln(`\x1b[36m${line}\x1b[0m`)
    })
  }

// Event helper to emit typed custom events
private emit<K extends keyof CodeEditorEvents>(type: K, detail: CodeEditorEvents[K]){
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }))
    }
}

customElements.define('code-editor', CodeEditorElement)