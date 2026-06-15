export type Language = 'python' | 'java' | 'c' | 'shell' | 'lisp' | 'prolog'

export const LANGUAGES: Language[] = ['python', 'java', 'c', 'shell', 'lisp', 'prolog']

export const RUNNER_IMAGE = 'programming-runner:latest'

export const LANGUAGE_FILENAMES: Record<Language, string> = {
    python: 'main.py',
    java: 'Main.java', // public class must be named Main
    c: 'main.c',
    shell: 'main.sh',
    lisp: 'main.lisp',
    prolog: 'main.pl',
}

export const LANGUAGE_RUN_COMMANDS: Record<Language, string[]> = {
    python: ['python3', '-u', '/code/main.py'],
    java:   ['/bin/sh', '-c', 'cd /code && javac Main.java 2>&1 && java Main'],
    c:      ['/bin/sh', '-c', 'cd /code && gcc -o main main.c 2>&1 && ./main'],
    shell:  ['/bin/sh', '/code/main.sh'],
    lisp:   ['sbcl', '--script', '/code/main.lisp'],
    prolog: ['swipl', '-q', '-g', "consult('/code/main.pl'),halt", '-t', 'halt'],
}

// Frontend -> Backend messages
export type ClientMessage =
    | { type: 'run'; language: Language; code:string}
    | { type: 'input'; data:string}
    | { type: 'resize'; cols: number; rows: number }
    | { type: 'stop'}

// Backend -> Frontend messages
export type ServerMessage = 
    | { type: 'ready'}
    | {type: 'output'; data: string}
    | {type: 'exit'; code: number | null}
    | {type: 'error'; message: string}