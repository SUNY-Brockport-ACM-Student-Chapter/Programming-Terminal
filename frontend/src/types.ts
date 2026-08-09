export type Language = 'python' | 'java' | 'c' | 'shell' | 'lisp' | 'prolog'

export const LANGUAGES: Language[] = ['python', 'java', 'c', 'shell', 'lisp', 'prolog']

// Represents a single file tab in the editor
export interface EditorFile{
    id: string
    filename: string
    content: string
}

// WebSocket protocol 
//frontend to backend messages
export type ClientMessage =
| { type: 'run'; language: Language; files: EditorFile[]; entryPoint?: string} // sent when a user clicks run
| { type: 'input'; data: string} // sent for every keystroke
| { type: 'resize'; cols: number; rows: number} // sent when the terminal's pixel dimensions change
| { type: 'stop'} // sent when a user clicks stop

// backend to frontend messages 
export type ServerMessage =
| { type: 'ready'} // sent once a container has been acquired
| { type: 'output'; data: string} // sent for each chunk of PTY output from the running process
| { type: 'exit'; code: number | null} // sent when the process finishes or was killed
| { type: 'error'; message: string} // sent when something goes wrong on the server side 

