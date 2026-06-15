import { useState, useEffect } from 'react'
import { CodeEditor } from './components/CodeEditor'
import type { Language } from './types'
import { LANGUAGES } from './types'
import './index.css'

function isValidLanguage(lang: string): lang is Language {
  return LANGUAGES.includes(lang as Language)
}

export function App() {
  // Read initial config from URL query params 
  const params = new URLSearchParams(window.location.search)
  const wsUrl = params.get('wsUrl') ?? 'ws://localhost:3001/ws'
  const initLang = params.get('language') ?? 'java'

  const [language, setLanguage] = useState<Language>(
    isValidLanguage(initLang) ? initLang : 'java'
  )

  // Handle SET_CONFIG postMessage from the embedding platform
  // The platform can push a new language at any time after load.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const { type, payload } = (event.data ?? {}) as {
        type?: string
        payload?: { language?: string; code?: string }
      }
      if (type !== 'SET_CONFIG') return
      if (payload?.language && isValidLanguage(payload.language)) {
        setLanguage(payload.language)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <CodeEditor
      language={language}
      wsUrl={wsUrl}
      onLanguageChange={setLanguage}
    />
  )
}