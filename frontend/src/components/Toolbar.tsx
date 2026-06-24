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
  layout,
  onRun,
  onStop,
  onLanguageChange,
  onLayoutToggle,
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
        className="bg-[#057019] hover:bg-[#079C23] disabled:bg-[#555] disabled:cursor-not-allowed text-white text-sm px-3 py-1 rounded"
      >
      ➤ Run
      </button>

      <button
        onClick={onStop}
        disabled={!isRunning}
        className="bg-[#B12020] hover:bg-[#CC2525] disabled:bg-[#555] disabled:cursor-not-allowed text-white text-sm px-3 py-1 rounded"
      >
        ■ Stop
      </button>

      <button
        onClick={onLayoutToggle}
        title={layout === 'vertical' ? 'Move terminal to the right' : 'Move terminal below'}
        className="ml-auto bg-[#3c3c3c] hover:bg-[#505050] text-[#d4d4d4] text-sm px-3 py-1 rounded"
      >
        {layout === 'vertical' ? '⎅ Terminal Right' : '⊟ Terminal Below'}
      </button>
    </div>
  )
}