export type Language = 'python' | 'java' | 'c' | 'shell' | 'lisp' | 'prolog'

export const LANGUAGES: Language[] = ['python', 'java', 'c', 'shell', 'lisp', 'prolog']

// WebSocket protocol 
//frontend to backend messages
export type ClientMessage =
| { type: 'run'; language: Language; code: string}
| { type: 'input'; data: string}
| { type: 'resize'; cols: number; rows: number}
| { type: 'stop'}

export type ServerMessage =
| { type: 'ready'}
| { type: 'output'; data: string}
| { type: 'exit'; code: number | null}
| { type: 'error'; message: string}

