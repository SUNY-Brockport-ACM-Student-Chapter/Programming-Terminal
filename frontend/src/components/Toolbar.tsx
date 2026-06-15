import { LANGUAGE_LABELS} from '../core/languages'
import { LANGUAGES, type Language } from '../types'

interface ToolbarProps {
  language:         Language
  isRunning:        boolean
  layout:           'vertical' | 'horizontal'
  onRun:            () => void
  onStop:           () => void
  onLanguageChange: (lang: Language) => void
  onLayoutToggle:   () => void
}

export function Toolbar({
  language,
  isRunning,
  onRun,
  onStop,
  onLanguageChange,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2d2d2d] border-b border-[#444] flex-shrink-0">
      <select
        value={language}
        onChange={(e) => onLanguageChange(e.target.value as Language)}
        className="bg-[#3c3c3c] text-[#d4d4d4] border border-[#555] rounded px-2 py-1 text-sm cursor-pointer"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {LANGUAGE_LABELS[lang]}
          </option>
        ))}
      </select>

      <button
        onClick={onRun}
        disabled={isRunning}
        className="bg-[#0e639c] hover:bg-[#1177bb] disabled:bg-[#555] disabled:cursor-not-allowed text-white text-sm px-3 py-1 rounded"
      >
        ▶ Run
      </button>

      <button
        onClick={onStop}
        disabled={!isRunning}
        className="bg-[#6b2020] hover:bg-[#8b3030] disabled:bg-[#555] disabled:cursor-not-allowed text-white text-sm px-3 py-1 rounded"
      >
        ■ Stop
      </button>
    </div>
  )
}