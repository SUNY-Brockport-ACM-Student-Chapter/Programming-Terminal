import '../component/CodeEditorElement'
import type { CodeEditorElement } from '../component/CodeEditorElement'

const editor = document.getElementById('editor') as CodeEditorElement

// Listen for custom events from the CodeEditorElement and forward them to the parent window
editor.addEventListener('editor-run', (e:Event) => {
    const { code, language } = (e as CustomEvent).detail
    window.parent.postMessage({ type: 'RUN_CODE', payload: { code, language } }, '*') 
})

editor.addEventListener('editor-ai', (e:Event) => {
    // Pass the full detail including terminalOutput and sessionTranscript ao the platform can include them in the AI prompt
    const {code, language, terminalOutput, sessionTranscript} = (e as CustomEvent).detail
    window.parent.postMessage({ type: 'AI_FEEDBACK_REQUEST', payload: { code, language, terminalOutput, sessionTranscript}, },'*')
})

window.addEventListener('message', (event) => {
    const { type, payload } = event.data

    switch(type){
        case 'SET_CONFIG':
            if(payload.language) editor.setLanguage(payload.language)
            if(payload.code) editor.setValue(payload.code)
            break
        case 'EXECUTION_RESULT':
            editor.showOutput(payload.stdout ?? '', payload.stderr ?? '')
            break
    case 'AI_RESPONSE':
        //editor.showFeedback(payload.text)
        break
}
})