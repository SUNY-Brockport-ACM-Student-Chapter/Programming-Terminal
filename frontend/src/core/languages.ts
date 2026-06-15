import {StreamLanguage} from '@codemirror/language'
import {pythonLanguage} from '@codemirror/lang-python' // Python is imported without autocomplete
import {java} from '@codemirror/lang-java'
import {cpp} from '@codemirror/lang-cpp'
import {shell} from '@codemirror/legacy-modes/mode/shell'
import {commonLisp} from '@codemirror/legacy-modes/mode/commonlisp'
import {prolog} from 'codemirror-lang-prolog'
import type {Language} from '../types'

export function getLanguageExtension(language: Language){
  switch (language) {
    case 'python': return pythonLanguage
    case 'java':   return java()
    case 'c':      return cpp()
    case 'shell':  return StreamLanguage.define(shell)
    case 'lisp':   return StreamLanguage.define(commonLisp)
    case 'prolog': return prolog()
  }
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  python: 'Python',
  java:   'Java',
  c:      'C',
  shell:  'Unix / Shell',
  lisp:   'Common Lisp',
  prolog: 'Prolog',
}