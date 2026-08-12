export type Language = 'python' | 'java' | 'c' | 'shell' | 'lisp' | 'prolog';
export declare const LANGUAGES: Language[];
export interface EditorFile {
    id: string;
    filename: string;
    content: string;
}
export type ClientMessage = {
    type: 'run';
    language: Language;
    files: EditorFile[];
    entryPoint?: string;
} | {
    type: 'input';
    data: string;
} | {
    type: 'resize';
    cols: number;
    rows: number;
} | {
    type: 'stop';
};
export type ServerMessage = {
    type: 'ready';
} | {
    type: 'output';
    data: string;
} | {
    type: 'exit';
    code: number | null;
} | {
    type: 'error';
    message: string;
};
