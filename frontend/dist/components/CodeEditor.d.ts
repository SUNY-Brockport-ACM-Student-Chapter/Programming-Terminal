import { Language } from '../types';
interface CodeEditorProps {
    language: Language;
    wsUrl: string;
    initialCode?: string;
    onLanguageChange?: (lang: Language) => void;
    onCodeChange?: (code: string) => void;
}
export declare function CodeEditor({ language, wsUrl, initialCode, onLanguageChange, onCodeChange }: CodeEditorProps): import("react").JSX.Element;
export {};
