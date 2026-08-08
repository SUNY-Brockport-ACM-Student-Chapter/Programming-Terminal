import { useState } from "react";
import type { EditorFile, Language} from "../types";

const DEFAULT_FILENAMES: Record<Language, string > = {
  c: 'newfile.c',
  java: 'NewFile.java',
  lisp: 'newfile.lisp',
  prolog: 'newfile.pl',
  python: 'newfile.py',
  shell: 'newfile.sh'
}

interface TabBarProps{
    files: EditorFile[]
    activeId: string
    language: Language
    onSelect: (id: string) => void
    onClose: (id: string) => void
    onAdd: (filename: string) => void
}

export function TabBar({
    files, activeId, language, onSelect, onClose, onAdd
}: TabBarProps){
  // Controls whether the filename input is visible
  const [isAdding, setIsAdding] = useState(false)

  // Tracks what the use is typing as the new filename
  const [newFilename, setNewFilename] = useState('')

  const handleAddClick = () => {
    setNewFilename(DEFAULT_FILENAMES[language]) // pre-fill with the language's default filename
    setIsAdding(true)
  }

  const handleAddConfirm = () => {
    const trimmed = newFilename.trim()
    if(!trimmed){
      setIsAdding(false)
      return
    }
    onAdd(trimmed)
    setIsAdding(false)
    setNewFilename('')
  }

  const handleAddCancel = () => {
    setIsAdding(false)
    setNewFilename('')
  }

  const handleCloseClick = (e: React.MouseEvent, file: EditorFile) => {
    e.stopPropagation() // Don't let clicking X select the tab
    const confirmed = window.confirm(`Close "${file.filename}"? Unsaved changes will be lost.`)
    if (confirmed) {
      onClose(file.id)
    }
  }
    return(
        <div className="flex items-center bg-[#252526] border-b border-[#444] flex-shrink-0 overflow-x-auto">
      {files.map((file) => (
        <div
          key={file.id}
          onClick={() => onSelect(file.id)}
          className={`
            flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer
            border-r border-[#444] flex-shrink-0 select-none
            ${file.id === activeId
              ? 'bg-[#1e1e1e] text-[#d4d4d4] border-t-2 border-t-[#007acc]'
              : 'bg-[#2d2d2d] text-[#888] hover:text-[#d4d4d4]'
            }
          `}
        >
          <span>{file.filename}</span>
          {/* Only show close button if more than one file is open */}
          {files.length > 1 && (
            <span
              onClick={(e) => handleCloseClick(e, file)}
              className="hover:text-white hover:bg-[#555] rounded px-0.5 text-xs leading-none"
              title="Close tab"
            >
              ✕
            </span>
          )}
        </div>
      ))}

      {/* Inline filename input — appears when user clicks + */}
      {isAdding && (
        <div className="flex items-center gap-1 px-2 py-1 bg-[#1e1e1e] border-r border-[#444] flex-shrink-0">
          <input
            autoFocus
            type="text"
            value={newFilename}
            onChange={(e) => setNewFilename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  handleAddConfirm()
              if (e.key === 'Escape') handleAddCancel()
            }}
            placeholder={DEFAULT_FILENAMES[language]}
            className="bg-[#3c3c3c] text-[#d4d4d4] text-sm px-2 py-0.5 rounded border border-[#007acc] outline-none w-36"
          />
          {/* Confirm button */}
          <button
            onClick={handleAddConfirm}
            className="text-[#0dbc79] hover:text-white text-xs px-1"
            title="Create file"
          >
            ✓
          </button>
          {/* Cancel button */}
          <button
            onClick={handleAddCancel}
            className="text-[#888] hover:text-white text-xs px-1"
            title="Cancel"
          >
            ✕
          </button>
        </div>
      )}

      {/* Add new file button — hidden while input is open */}
      {!isAdding && (
        <button
          onClick={handleAddClick}
          title="New file"
          className="px-3 py-1.5 text-[#888] hover:text-[#d4d4d4] hover:bg-[#3c3c3c] text-sm flex-shrink-0"
        >
          +
        </button>
      )}
    </div>
  )
}