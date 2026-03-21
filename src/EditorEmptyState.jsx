import './components/editor/EditorEmptyState.css'

export function EditorEmptyState({
  vaultLoading,
  modLabel,
  onNewNote,
  onOpenQuickOpen,
  onCloseTab,
  canCloseEditorTab,
}) {
  return (
    <div className="editor-empty" role="region" aria-label="No file open">
      <div className="editor-empty-inner">
        <button
          type="button"
          className="editor-empty-line"
          disabled={vaultLoading}
          onClick={() => void onNewNote()}
        >
          Create new note{' '}
          <span className="editor-empty-shortcut">({modLabel} N)</span>
        </button>
        <button
          type="button"
          className="editor-empty-line"
          disabled={vaultLoading}
          onClick={onOpenQuickOpen}
        >
          Go to file{' '}
          <span className="editor-empty-shortcut">({modLabel} O)</span>
        </button>
        <button
          type="button"
          className="editor-empty-line"
          disabled={!canCloseEditorTab}
          onClick={() => onCloseTab()}
        >
          Close{' '}
          <span className="editor-empty-shortcut">({modLabel} W)</span>
        </button>
      </div>
    </div>
  )
}
