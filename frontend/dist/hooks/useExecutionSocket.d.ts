import { Language } from '../types';
interface UseExecutionSocketOptions {
    wsUrl: string;
    onReady: () => void;
    onOutput: (data: string) => void;
    onExit: (code: number | null) => void;
    onError: (message: string) => void;
}
interface ExecutionSocketHandle {
    run(language: Language, code: string): void;
    stop(): void;
    sendInput(data: string): void;
    sendResize(cols: number, rows: number): void;
}
export declare function useExecutionSocket({ wsUrl, onReady, onOutput, onExit, onError, }: UseExecutionSocketOptions): ExecutionSocketHandle;
export {};
