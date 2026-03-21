import { useEffect, useMemo, useRef, useState } from 'react'
import './QuickOpenDialog.css'

function flattenVaultFiles(nodes, prefix = []) {
  const out = []
  for (const n of nodes) {
    if (n.type === 'folder') {
      out.push(...flattenVaultFiles(n.children, [...prefix, n.name]))
    } else {
      const pathLabel = prefix.length ? `${prefix.join('/')}/${n.name}` : n.name
      out.push({ id: n.id, name: n.name, pathLabel })
    }
  }
  return out
}

export function QuickOpenDialog({ open, onClose, vault, onPick }) {
  const [query, setQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const inputRef = useRef(null)

  const flatFiles = useMemo(() => flattenVaultFiles(vault), [vault])
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return flatFiles
    return flatFiles.filter((row) =>
      row.pathLabel.toLowerCase().includes(q),
    )
  }, [flatFiles, query])

  useEffect(() => {
    setHighlightIndex((i) =>
      matches.length === 0 ? 0 : Math.min(i, matches.length - 1),
    )
  }, [matches])

  useEffect(() => {
    if (!open) return undefined
    setQuery('')
    setHighlightIndex(0)
    const raf = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(raf)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightIndex((i) =>
          Math.min(i + 1, Math.max(0, matches.length - 1)),
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' && matches.length > 0) {
        e.preventDefault()
        const row = matches[highlightIndex]
        if (row) {
          onPick(row.id)
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, matches, highlightIndex, onClose, onPick])

  if (!open) return null

  return (
    <>
      <div
        className="quick-open-backdrop"
        role="presentation"
        onClick={onClose}
      />
      <div
        className="quick-open-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-open-title"
      >
        <div className="quick-open-inner">
          <span id="quick-open-title" className="visually-hidden">
            Go to file
          </span>
          <input
            ref={inputRef}
            type="search"
            className="form-control form-control-sm quick-open-input"
            placeholder="Filter by name or path…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setHighlightIndex(0)
            }}
            aria-label="Filter files"
          />
          <ul className="quick-open-list" role="listbox">
            {matches.length === 0 ? (
              <li className="quick-open-empty text-muted small px-2 py-3">
                No matching notes.
              </li>
            ) : (
              matches.map((row, i) => (
                <li key={row.id} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === highlightIndex}
                    className={`quick-open-row ${i === highlightIndex ? 'is-active' : ''}`}
                    onClick={() => {
                      onPick(row.id)
                      onClose()
                    }}
                  >
                    <span className="quick-open-path text-truncate">
                      {row.pathLabel}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </>
  )
}
