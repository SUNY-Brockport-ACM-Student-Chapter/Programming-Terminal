import { Language } from '../types';
interface ToolbarProps {
    language: Language;
    isRunning: boolean;
    layout: 'vertical' | 'horizontal';
    onRun: () => void;
    onStop: () => void;
    onLanguageChange: (lang: Language) => void;
    onLayoutToggle: () => void;
}
export declare function Toolbar({ language, isRunning, layout, onRun, onStop, onLanguageChange, onLayoutToggle, }: ToolbarProps): import("react").JSX.Element;
export {};
