export interface TerminalHandle {
    write(data: string): void;
    clear(): void;
}
interface TerminalPaneProps {
    isRunning: boolean;
    onData: (data: string) => void;
    onResize: (cols: number, rows: number) => void;
}
export declare const TerminalPane: import('react').ForwardRefExoticComponent<TerminalPaneProps & import('react').RefAttributes<TerminalHandle>>;
export {};
