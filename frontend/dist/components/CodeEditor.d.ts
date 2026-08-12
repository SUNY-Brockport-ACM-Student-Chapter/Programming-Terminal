import { Language, EditorFile } from '../types';
interface CodeEditorProps {
    language: Language;
    wsUrl: string;
    initialFiles?: EditorFile[];
    entryPoint?: string;
    allowedLanguages?: Language[];
    onLanguageChange?: (lang: Language) => void;
    onFilesChange?: (files: EditorFile[]) => void;
    onExecutionResult?: (result: {
        output: string;
        exitCode: number | null;
        error?: string;
    }) => void;
}
export declare function CodeEditor({ language, wsUrl, initialFiles, entryPoint, allowedLanguages, onLanguageChange, onFilesChange, onExecutionResult }: CodeEditorProps): import("react").JSX.Element;
export {};
