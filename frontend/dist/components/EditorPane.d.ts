import { Language } from '../types';
export interface EditorHandle {
    getValue(): string;
    setValue(code: string): void;
}
interface EditorPaneProps {
    language: Language;
    onContentChange: (code: string) => void;
}
export declare const EditorPane: import('react').ForwardRefExoticComponent<EditorPaneProps & import('react').RefAttributes<EditorHandle>>;
export {};
