import { EditorFile, Language } from '../types';
interface TabBarProps {
    files: EditorFile[];
    activeId: string;
    language: Language;
    onSelect: (id: string) => void;
    onClose: (id: string) => void;
    onAdd: (filename: string) => void;
    onRename: (id: string, newFilename: string) => void;
}
export declare function TabBar({ files, activeId, language, onSelect, onClose, onAdd, onRename }: TabBarProps): import("react").JSX.Element;
export {};
