# Programming Terminal

[![npm version](https://img.shields.io/npm/v/@edually/programming-terminal.svg)](https://www.npmjs.com/package/@edually/programming-terminal)
[![npm downloads](https://img.shields.io/npm/dm/@edually/programming-terminal.svg)](https://www.npmjs.com/package/@edually/programming-terminal)

An embeddable React code editor and interactive terminal for programming exercises. It combines CodeMirror, xterm.js, multi-file editing, and a WebSocket execution protocol in one component.

Programming Terminal supports C, Java, Common Lisp, Prolog, Python, and shell scripts. The included execution server runs submitted code in isolated, network-disabled Docker containers.

## Features

- CodeMirror editor with syntax highlighting and familiar editing shortcuts
- Interactive xterm.js terminal with stdin and terminal resizing
- Multiple files with add, rename, close, and per-language file history
- Vertical and horizontal editor/terminal layouts
- Automatic entry-point detection for every supported language
- Run, stop, output, error, and exit-code handling over WebSockets
- Typed React API with ESM and CommonJS builds
- Starter programs for all supported languages

## Install

```bash
npm install @edually/programming-terminal
```

React 18 or 19 is required. Import the package stylesheet once in your application:

```tsx
import '@edually/programming-terminal/styles.css'
```

## Quick start

`CodeEditor` needs a WebSocket execution server and a parent with an explicit height.

```tsx
import { useState } from 'react'
import {
  CodeEditor,
  type Language,
} from '@edually/programming-terminal'
import '@edually/programming-terminal/styles.css'

export function Playground() {
  const [language, setLanguage] = useState<Language>('python')

  return (
    <div style={{ height: 640 }}>
      <CodeEditor
        language={language}
        wsUrl="ws://localhost:3001/ws"
        allowedLanguages={['python', 'java', 'c']}
        onLanguageChange={setLanguage}
        onFilesChange={(files) => console.log(files)}
        onExecutionResult={({ output, exitCode, error }) => {
          console.log({ output, exitCode, error })
        }}
      />
    </div>
  )
}
```

The editor creates a starter file when `initialFiles` is omitted. If you provide `initialFiles`, keep the array reference stable unless you intend to replace the current exercise.

For Next.js App Router, render the editor from a Client Component (`'use client'`). In production, use a secure `wss://` URL when your page is served over HTTPS.

## `CodeEditor` API

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `language` | `Language` | Yes | Active language. Treat this as a controlled value when language selection is enabled. |
| `wsUrl` | `string` | Yes | Full WebSocket URL for the execution endpoint, including `/ws`. |
| `initialFiles` | `EditorFile[]` | No | Files used to initialize or replace the current exercise. |
| `entryPoint` | `string` | No | Overrides automatic entry-point detection. Java expects a class name; other languages expect a filename. |
| `allowedLanguages` | `Language[]` | No | Languages displayed in the toolbar. Defaults to every supported language. |
| `onLanguageChange` | `(language: Language) => void` | No | Called when the user selects a language. Update the `language` prop here. |
| `onFilesChange` | `(files: EditorFile[]) => void` | No | Called after file contents or the file list changes. |
| `onExecutionResult` | `(result: ExecutionResult) => void` | No | Called after execution exits or reports an error. |

```ts
type Language = 'python' | 'java' | 'c' | 'shell' | 'lisp' | 'prolog'

interface EditorFile {
  id: string
  filename: string
  content: string
}

interface ExecutionResult {
  output: string
  exitCode: number | null
  error?: string
}
```

Entry points are detected as follows:

| Language | Default behavior |
| --- | --- |
| Python | First `.py` file, falling back to `main.py` |
| Java | Class containing `public static void main`, falling back to `Main` |
| C | First `.c` file, falling back to `main.c` |
| Shell | First `.sh` file, falling back to `main.sh` |
| Common Lisp | First `.lisp` file, falling back to `main.lisp` |
| Prolog | First `.pl` file, falling back to `main.pl` |

## Execution server

The React package is the browser client. To execute code, run the server from this repository or implement the WebSocket protocol below.

### Run the included server locally

You need Node.js, npm, Docker, and permission to access the Docker daemon.

```bash
git clone https://github.com/SUNY-Brockport-ACM-Student-Chapter/Programming-Terminal.git
cd Programming-Terminal

npm install
npm run install:all
docker build -t programming-runner:latest execution-server/docker

cp execution-server/.env.example execution-server/.env
npm run dev
```

Configure `execution-server/.env` before starting:

```dotenv
PORT=3001
POOL_SIZE=5
MAX_EXECUTION_TIME=15000
CORS_ORIGIN=http://localhost:5173
```

`CORS_ORIGIN` accepts a comma-separated list. The server exposes `GET /api/health` for a pool-status health check and WebSockets at `/ws`.

Each execution receives a fresh container with a 256 MB memory limit, half of one CPU, no network access, and a configurable timeout. Used containers are destroyed rather than reused.

### WebSocket protocol

Client-to-server messages:

```ts
type ClientMessage =
  | { type: 'run'; language: Language; files: EditorFile[]; entryPoint?: string }
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'stop' }
```

Server-to-client messages:

```ts
type ServerMessage =
  | { type: 'ready' }
  | { type: 'output'; data: string }
  | { type: 'exit'; code: number | null }
  | { type: 'error'; message: string }
```

The client reconnects automatically three seconds after a disconnected socket closes.

## Advanced exports

The package also exports the lower-level `EditorPane`, `TerminalPane`, `Toolbar`, `TabBar`, and `useExecutionSocket` building blocks. `getStarterFiles(language)` returns a fresh starter-file array, while `EditorHandle` and `TerminalHandle` expose the imperative editor and terminal methods used internally.

## Production security

Running untrusted code is security-sensitive. Container limits are a useful isolation layer, but they are not a complete public-service security boundary. Before exposing the execution server to the internet, add authentication, authorization, request and connection rate limits, TLS, strict origin validation, monitoring, capacity controls, and host-level Docker hardening. Never expose the Docker daemon itself to clients.

## Development

```bash
npm install
npm run install:all
npm run dev
```

Build the publishable frontend library with:

```bash
npm run build
```

## Contributing

Issues and pull requests are welcome in the [GitHub repository](https://github.com/SUNY-Brockport-ACM-Student-Chapter/Programming-Terminal).
