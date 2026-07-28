import { Language } from '../types';
interface CodeEditorProps {
    language: Language;
    wsUrl: string;
    initialCode?: string;
    allowedLanguages?: Language[];
    onLanguageChange?: (lang: Language) => void;
    onCodeChange?: (code: string) => void;
    onExecutionResult?: (result: {
        output: string;
        exitCode: number | null;
        error?: string;
    }) => void;
}
export declare function CodeEditor({ language, wsUrl, initialCode, allowedLanguages, onLanguageChange, onCodeChange, onExecutionResult }: CodeEditorProps): import("react").JSX.Element;
export {};
