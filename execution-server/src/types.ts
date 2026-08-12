export type Language = 'python' | 'java' | 'c' | 'shell' | 'lisp' | 'prolog'

// LANGUAGES is used for the websocket to validate the language in incoming run requests
export const LANGUAGES: Language[] = ['python', 'java', 'c', 'shell', 'lisp', 'prolog']

/*
Docker image name used for all containers in the pool. 
An image contains all language runtimes, so any container can run any language
*/
export const RUNNER_IMAGE = 'programming-runner:latest'

// Map each language to the command run via docker exec.
export const LANGUAGE_RUN_COMMANDS: Record<Language, (entryPoint?: string) => string[]> = {
    python: (ep = 'main.py') => ['python3', '-u', `/code/${ep}`],
    java:  (ep = 'Main') => {
        const safeEntryPoint = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(ep ?? '') ? ep : 'Main'
        return ['/bin/sh', '-c', `cd /code && javac *.java 2>&1 && java ${safeEntryPoint}`]
    },
    c:      (ep = 'main.c') => ['/bin/sh', '-c', `cd /code && gcc -o main ${ep} 2>&1 && ./main`],
    shell:  (ep = 'main.sh') => ['/bin/sh', `/code/${ep}`],
    lisp:   (ep = 'main.lisp') => ['sbcl', '--script', `/code/${ep}`],
    prolog: (ep = 'main.pl') => ['swipl', '-q', '-g', `consult('/code/${ep}'), halt`, '-t', 'halt'],
}

// Frontend -> Backend messages
export type ClientMessage =
    | { type: 'run'; language: Language; files: Array<{id: string; filename: string; content: string}>; entryPoint?: string }
    | { type: 'input'; data:string}
    | { type: 'resize'; cols: number; rows: number }
    | { type: 'stop'}

// Backend -> Frontend messages
export type ServerMessage = 
    | { type: 'ready'}
    | {type: 'output'; data: string}
    | {type: 'exit'; code: number | null}
    | {type: 'error'; message: string}