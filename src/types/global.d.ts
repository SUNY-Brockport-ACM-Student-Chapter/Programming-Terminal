/*
Augments HTMLElementTagNameMap to include our custom CodeEditorElement, 
so TypeScript recognizes <code-editor> tags in JSX and elsewhere.
*/

import type { CodeEditorElement } from "../component/CodeEditorElement"

declare global{
    interface HTMLElementTagNameMap {
        "code-editor": CodeEditorElement
    }
}

// JSX support for React / Next.js
declare namespace JSX {
    interface IntrinsicElements {
        "code-editor": RecordingState.DetailedHTMLProps<RecordingState.HTMLAttributes<HTMLElement> & {
            language?: string
            code?: string
        }, HTMLElement>
    }
}


// Full IntelliSense support everytwhere
const editor = document.querySelector('code-editor')!
editor.getValue()
editor.setLanguage('java')
editor.showOutput('hi', '')
editor.attachInteractiveSession(ws)