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

const LANGUAGE_EXTENSIONS: Record<Language, string> = {
  c: '.c',
  java: '.java',
  lisp: '.lisp',
  prolog: '.pl',
  python: '.py',
  shell: '.sh'
}

interface TabBarProps{
    files: EditorFile[]
    activeId: string
    language: Language
    onSelect: (id: string) => void
    onClose: (id: string) => void
    onAdd: (filename: string) => void
    onRename: (id:string, newFilename: string) => void
}

export function TabBar({
    files, activeId, language, onSelect, onClose, onAdd, onRename
}: TabBarProps){
  // Controls whether the filename input is visible
  const [isAdding, setIsAdding] = useState(false)

  // Tracks what the use is typing as the new filename
  const [newFilename, setNewFilename] = useState('')

  // Tracks which tab is being renamed and what the user is typing
  const [renamingId, setRenamingId] =  useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Generate a new filename if the default or typed name is already taken
  function getUniqueFilename(base: string, excludeId?: string): string {
    const existingFilenames = new Set(files.filter(f => f.id !== excludeId).map(f => f.filename))
    if(!existingFilenames.has(base)) return base

    const dotIndex = base.lastIndexOf('.')
    const name = dotIndex !== -1 ? base.slice(0, dotIndex) : base
    const ext = dotIndex !== -1 ? base.slice(dotIndex) : ''

    let counter = 2
    while(existingFilenames.has(`${name}${counter}${ext}`)){
      counter++
    }
    return `${name}${counter}${ext}`
  }

  const handleAddClick = () => {
    setNewFilename(getUniqueFilename(DEFAULT_FILENAMES[language])) // pre-fill with the language's default filename
    setIsAdding(true)
  }

  const handleAddConfirm = () => {
    const trimmed = newFilename.trim()
    if(!trimmed){
      setIsAdding(false)
      return
    }

    // Reject filenames that contain unsafe characters or start with a period
    if(!/^[A-Za-z0-9_\-\.]+$/.test(trimmed) || trimmed.startsWith('.')){
      alert('Invalid filename. Only letters, numbers, underscores, hyphens, and periods are allowed. Filename cannot start with a period.')
      return
    }

    // Include the correct extension for the current language if the user didn't provide one
    const hasExtension = trimmed.includes('.')
    const withExtension = hasExtension ? trimmed : trimmed + LANGUAGE_EXTENSIONS[language]

    const finalFilename = getUniqueFilename(withExtension)

    onAdd(finalFilename)
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

  const handleRenameStart = (e: React.MouseEvent, file: EditorFile) => {
    e.stopPropagation()
    setRenamingId(file.id)
    setRenameValue(file.filename)
  }

  const handleRenameConfirm = (id: string) => {
    const trimmed  = renameValue.trim()
    const original = files.find(f => f.id === id)?.filename

    // If nothing changed or input is empty, cancel silently
    if (!trimmed || trimmed === original) {
      setRenamingId(null)
      return
    }

    if (!/^[A-Za-z0-9_\-\.]+$/.test(trimmed) || trimmed.startsWith('.')) {
      alert('Invalid filename. Only letters, numbers, underscores, hyphens, and periods are allowed. Filename cannot start with a period.')
      return
    }

    const hasExtension  = trimmed.includes('.')
    const withExtension = hasExtension ? trimmed : trimmed + LANGUAGE_EXTENSIONS[language]
    const finalFilename = getUniqueFilename(withExtension, id)

    onRename(id, finalFilename)
    setRenamingId(null)
  }

  const handleRenameCancel = () => {
    setRenamingId(null)
    setRenameValue('')
  }
    return (
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
          {/* NEW: show inline rename input when this tab is being renamed */}
          {renamingId === file.id ? (
            <div
              className="flex items-center gap-1"
              onClick={e => e.stopPropagation()}
            >
              <input
                autoFocus
                type="text"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter')  handleRenameConfirm(file.id)
                  if (e.key === 'Escape') handleRenameCancel()
                }}
                // Commit on blur so clicking away saves the rename
                onBlur={() => handleRenameConfirm(file.id)}
                className="bg-[#3c3c3c] text-[#d4d4d4] text-sm px-1 py-0.5 rounded border border-[#007acc] outline-none w-28"
              />
            </div>
          ) : (
            <>
              {/* NEW: double-click the filename label to start renaming */}
              <span
                onDoubleClick={(e) => handleRenameStart(e, file)}
                title="Double-click to rename"
              >
                {file.filename}
              </span>

              {files.length > 1 && (
                <span
                  onClick={(e) => handleCloseClick(e, file)}
                  className="hover:text-white hover:bg-[#555] rounded px-0.5 text-xs leading-none"
                  title="Close tab"
                >
                  ✕
                </span>
              )}
            </>
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
          <button
            onClick={handleAddConfirm}
            className="text-[#0dbc79] hover:text-white text-xs px-1"
            title="Create file"
          >
            ✓
          </button>
          <button
            onClick={handleAddCancel}
            className="text-[#888] hover:text-white text-xs px-1"
            title="Cancel"
          >
            ✕
          </button>
        </div>
      )}

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