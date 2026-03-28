import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import './VaultNavbar.css'
import { notePkFromClientId } from '../../lib/vaultApi.js'
import { findFile } from '../../lib/vaultTreePaths.js'

export const VaultNavbar = forwardRef(function VaultNavbar(
  {
  vault,
  openTabs,
  activeFileId,
  nav,
  dispatch,
  vaultLoading,
  onNewNote,
  pendingNoteTitleEditRef,
  onRenameActiveNote,
  onRenameNoteError,
  onLintActiveNote,
  lintBusy,
  editorPaneMode = 'split',
  onToggleEditorLeftPane,
  onToggleEditorRightPane,
  showEditorLineNumbers = true,
  onToggleEditorLineNumbers,
  onExportPdf,
  },
  ref,
) {
  const [titleEditing, setTitleEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const titleInputRef = useRef(null)
  const titleBlurIgnoredUntilRef = useRef(0)
  const prevTitleResetFileIdRef = useRef(null)
  const moreMenuRef = useRef(null)

  useImperativeHandle(
    ref,
    () => ({
      beginTitleEdit(name) {
        setTitleDraft(name)
        setTitleEditing(true)
      },
    }),
    [],
  )

  const activeFile = useMemo(
    () => (activeFileId ? findFile(vault, activeFileId) : null),
    [vault, activeFileId],
  )

  const canBack = nav.i > 0
  const canForward = nav.i < nav.ids.length - 1

  useEffect(() => {
    if (prevTitleResetFileIdRef.current === activeFileId) return
    prevTitleResetFileIdRef.current = activeFileId
    const pending = pendingNoteTitleEditRef.current
    pendingNoteTitleEditRef.current = null
    if (pending && activeFileId && pending.fileId === activeFileId) {
      setTitleDraft(pending.name)
      setTitleEditing(true)
      return
    }
    setTitleEditing(false)
    setTitleDraft('')
  }, [activeFileId, pendingNoteTitleEditRef])

  useEffect(() => {
    if (!titleEditing) return undefined
    titleBlurIgnoredUntilRef.current = Date.now() + 220
    const t = window.setTimeout(() => {
      titleBlurIgnoredUntilRef.current = 0
    }, 240)
    return () => window.clearTimeout(t)
  }, [titleEditing])

  useEffect(() => {
    if (!titleEditing) return undefined
    const raf = window.requestAnimationFrame(() => {
      const el = titleInputRef.current
      if (el) {
        el.focus()
        el.select()
      }
    })
    return () => window.cancelAnimationFrame(raf)
  }, [titleEditing])

  // Close more menu on outside click
  useEffect(() => {
    if (!moreOpen) return undefined
    const handler = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [moreOpen])

  const commitNoteTitleEdit = useCallback(async () => {
    if (!activeFile) {
      setTitleEditing(false)
      return
    }
    const trimmed = titleDraft.trim()
    if (!trimmed) {
      setTitleDraft(activeFile.name)
      setTitleEditing(false)
      return
    }
    if (trimmed === activeFile.name) {
      setTitleEditing(false)
      return
    }
    if (notePkFromClientId(activeFile.id) == null) {
      setTitleEditing(false)
      return
    }
    try {
      await onRenameActiveNote(activeFile.id, trimmed)
      setTitleEditing(false)
    } catch (e) {
      onRenameNoteError(
        e instanceof Error ? e.message : 'Could not rename note.',
      )
      setTitleDraft(activeFile.name)
      setTitleEditing(false)
    }
  }, [activeFile, titleDraft, onRenameActiveNote, onRenameNoteError])

  const hasActiveTab = openTabs.length > 0

  const sourceLabel =
    editorPaneMode === 'preview-only' ? 'Show source pane' : 'Hide source pane'
  const previewLabel =
    editorPaneMode === 'source-only' ? 'Show preview pane' : 'Hide preview pane'
  const lineNumLabel = showEditorLineNumbers
    ? 'Hide line numbers'
    : 'Show line numbers'

  return (
    <>
      <div className="tab-bar" role="tablist">
        {openTabs.map((id) => {
          const f = findFile(vault, id)
          const label = f?.name ?? id
          const isActive = id === activeFileId
          return (
            <div
              key={id}
              role="tab"
              aria-selected={isActive}
              className={`tab-item ${isActive ? 'active' : ''}`}
            >
              <button
                type="button"
                className="tab-select flex-grow-1 text-truncate border-0 bg-transparent p-0 text-start"
                style={{ color: 'inherit' }}
                onClick={() => dispatch({ type: 'OPEN_FILE', id })}
              >
                {label}
              </button>
              <button
                type="button"
                className="tab-close"
                aria-label={`Close ${label}`}
                onClick={() => dispatch({ type: 'CLOSE_TAB', id })}
              >
                <i className="bi bi-x-lg" aria-hidden />
              </button>
            </div>
          )
        })}
        <button
          type="button"
          className="tab-new"
          title="New note"
          aria-label="New note"
          disabled={vaultLoading}
          onClick={() => void onNewNote()}
        >
          +
        </button>
      </div>

      <div className="sub-bar">
        <div className="sub-bar-start">
          <button
            type="button"
            className="btn-icon"
            title="Back"
            aria-label="Back"
            disabled={!canBack}
            onClick={() => dispatch({ type: 'GO_BACK' })}
          >
            <i className="bi bi-arrow-left" aria-hidden />
          </button>
          <button
            type="button"
            className="btn-icon"
            title="Forward"
            aria-label="Forward"
            disabled={!canForward}
            onClick={() => dispatch({ type: 'GO_FORWARD' })}
          >
            <i className="bi bi-arrow-right" aria-hidden />
          </button>
          <div className="sub-bar-title-wrap" aria-live="polite">
            {activeFile ? (
              titleEditing ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  className="sub-bar-title-input"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => {
                    if (Date.now() < titleBlurIgnoredUntilRef.current) return
                    void commitNoteTitleEdit()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                      void commitNoteTitleEdit()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setTitleDraft(activeFile.name)
                      setTitleEditing(false)
                    }
                  }}
                  aria-label="Note title"
                  maxLength={255}
                />
              ) : (
                <h1
                  className="sub-bar-title sub-bar-title--clickable"
                  onClick={() => {
                    if (vaultLoading) return
                    setTitleDraft(activeFile.name)
                    setTitleEditing(true)
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault()
                    if (vaultLoading) return
                    setTitleDraft(activeFile.name)
                    setTitleEditing(true)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (!vaultLoading) {
                        setTitleDraft(activeFile.name)
                        setTitleEditing(true)
                      }
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  title="Click or double-click to rename"
                >
                  {activeFile.name}
                </h1>
              )
            ) : (
              <span className="sub-bar-title-placeholder text-muted" />
            )}
          </div>
        </div>

        <div className="sub-bar-center" />

        <div className="sub-bar-end">
          {hasActiveTab ? (
            <div className="sub-bar-more-wrap" ref={moreMenuRef}>
              <button
                type="button"
                className={`btn-icon sub-bar-more-btn${moreOpen ? ' is-active' : ''}`}
                title="More options"
                aria-label="More options"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((o) => !o)}
              >
                <i className="bi bi-three-dots" aria-hidden />
              </button>

              {moreOpen && (
                <div className="sub-bar-more-menu" role="menu">
                  <button
                    type="button"
                    className="sub-bar-more-item"
                    role="menuitem"
                    disabled={lintBusy || !activeFile || !onLintActiveNote}
                    onClick={() => {
                      setMoreOpen(false)
                      void onLintActiveNote?.()
                    }}
                  >
                    <i className="bi bi-check2-circle" aria-hidden />
                    {lintBusy ? 'Linting…' : 'Lint'}
                  </button>

                  <button
                    type="button"
                    className="sub-bar-more-item"
                    role="menuitem"
                    disabled={!activeFile || !onExportPdf}
                    onClick={() => {
                      setMoreOpen(false)
                      onExportPdf?.()
                    }}
                  >
                    <i className="bi bi-file-earmark-pdf" aria-hidden />
                    Export as PDF
                  </button>

                  <div className="sub-bar-more-sep" role="separator" />

                  <button
                    type="button"
                    className="sub-bar-more-item"
                    role="menuitem"
                    disabled={!onToggleEditorLineNumbers}
                    onClick={() => {
                      setMoreOpen(false)
                      onToggleEditorLineNumbers?.()
                    }}
                  >
                    <i className="bi bi-list-ol" aria-hidden />
                    {lineNumLabel}
                  </button>

                  <button
                    type="button"
                    className="sub-bar-more-item"
                    role="menuitem"
                    disabled={!onToggleEditorLeftPane}
                    onClick={() => {
                      setMoreOpen(false)
                      onToggleEditorLeftPane?.()
                    }}
                  >
                    <i className="bi bi-layout-sidebar-reverse" aria-hidden />
                    {sourceLabel}
                  </button>

                  <button
                    type="button"
                    className="sub-bar-more-item"
                    role="menuitem"
                    disabled={!onToggleEditorRightPane}
                    onClick={() => {
                      setMoreOpen(false)
                      onToggleEditorRightPane?.()
                    }}
                  >
                    <i className="bi bi-layout-sidebar" aria-hidden />
                    {previewLabel}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
})
