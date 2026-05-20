// Used for testing purposes only.

import './component/CodeEditorElement'

// For testing that CodeEditorElement can be embeded
const app = document.getElementById('app')!
const editor = document.createElement('code-editor')
editor.setAttribute('language', 'java')
app.appendChild(editor)

// For testing the editor as an iframe
/*
const app = document.getElementById('app')!
const iframe = document.createElement('iframe')
iframe.src = '/iframe/index.html'
iframe.style.width = '100%'
iframe.style.height = '100%'
iframe.style.border = 'none'
app.appendChild(iframe)
*/