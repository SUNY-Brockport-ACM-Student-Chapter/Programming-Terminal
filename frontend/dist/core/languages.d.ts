import { StreamLanguage } from '@codemirror/language';
import { Language } from '../types';
export declare function getLanguageExtension(language: Language): import('@codemirror/language').LRLanguage | import('@codemirror/language').LanguageSupport | StreamLanguage<unknown>;
export declare const LANGUAGE_LABELS: Record<Language, string>;
