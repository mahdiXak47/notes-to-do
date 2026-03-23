import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import './App.css'
import { DeleteConfirmModal } from '../components/modals/DeleteConfirmModal.jsx'
import { MoveTargetModal } from '../components/modals/MoveTargetModal.jsx'
import { EditorEmptyState } from '../components/editor/EditorEmptyState.jsx'
import { MarkdownEditor } from '../components/editor/MarkdownEditor.jsx'
import { QuickOpenDialog } from '../components/modals/QuickOpenDialog.jsx'
import { SettingsModal } from '../components/modals/SettingsModal.jsx'
import { VaultNavbar } from '../components/vault/VaultNavbar.jsx'
import { VaultSidebar } from '../components/vault/VaultSidebar.jsx'
import {
  collectExpandedByFolderId,
  createFolder,
  createNote,
  deleteFolder,
  deleteNote,
  duplicateFolderRoot,
  duplicateNoteAsCopy,
  downloadNoteAsMarkdownFile,
  fetchVaultTree,
  folderPkFromClientId,
  moveFolderToParent,
  moveNoteToFolder,
  normalizeTreeFromApi,
  notePkFromClientId,
  patchNoteName,
} from '../lib/vaultApi.js'
import { initialVaultState, vaultReducer } from '../lib/vaultReducer.js'
import {
  collectDescendantFolderIdsIncludingSelf,
  collectPinnedFileNodes,
  collectPinnedFolderNodes,
  filterTree,
  findFolderNode,
  sortTree,
  stripPinnedFilesFromNodes,
} from '../lib/vaultTreeOps.js'
import {
  findFile,
  findParentFolderUidForFile,
  findParentFolderUidForFolder,
  listFolderMoveTargets,
} from '../lib/vaultTreePaths.js'
import { useFolderRename } from '../hooks/useFolderRename.js'
import { useNoteAutosave } from '../hooks/useNoteAutosave.js'
import { useVaultKeyboardShortcuts } from '../hooks/useVaultKeyboardShortcuts.js'
import { lintAndFixMarkdown } from '../lib/markdownLintFix.js'

const SKIP_DELETE_CONFIRM_KEY = 'notes_skip_delete_confirm'
const LINE_NUMBERS_STORAGE_KEY = 'notes_editor_line_numbers'
const LINT_TOAST_DURATION_MS = 6000

function readStoredLineNumbersVisible() {
  try {
    return localStorage.getItem(LINE_NUMBERS_STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

function modKeyLabel() {
  if (typeof navigator === 'undefined') return 'Ctrl'
  return /Mac|iPhone|iPod/i.test(navigator.platform || '') ? '⌘' : 'Ctrl'
}

function App({ onLogout = () => {}, username = '' }) {
  const [state, dispatch] = useReducer(vaultReducer, initialVaultState)
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleteModalDontAskAgain, setDeleteModalDontAskAgain] = useState(false)
  const [pinnedSectionOpen, setPinnedSectionOpen] = useState(true)
  const [vaultLoading, setVaultLoading] = useState(true)
  const [vaultError, setVaultError] = useState(null)
  const [quickOpenOpen, setQuickOpenOpen] = useState(false)
  const vaultNavbarRef = useRef(null)
  const pendingNoteTitleEditRef = useRef(null)
  const vaultRef = useRef([])
  vaultRef.current = state.vault
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [moveModal, setMoveModal] = useState(null)
  const [lintBusy, setLintBusy] = useState(false)
  const [lintMessage, setLintMessage] = useState('')
  const lintProgressFillRef = useRef(null)
  const lintToastRafRef = useRef(null)
  const lintToastDeadlineRef = useRef(null)
  const lintToastInitialMsRef = useRef(LINT_TOAST_DURATION_MS)
  const lintToastPausedRef = useRef(false)
  const lintToastRemainingMsRef = useRef(null)
  const [editorPaneMode, setEditorPaneMode] = useState('split')
  const [editorLineNumbersVisible, setEditorLineNumbersVisible] = useState(
    readStoredLineNumbersVisible,
  )
  const modLabel = useMemo(() => modKeyLabel(), [])

  const toggleEditorLineNumbers = useCallback(() => {
    setEditorLineNumbersVisible((v) => {
      const next = !v
      try {
        localStorage.setItem(LINE_NUMBERS_STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore quota / private mode. */
      }
      return next
    })
  }, [])

  const syncVaultFromServer = useCallback(async () => {
    const expanded = collectExpandedByFolderId(vaultRef.current)
    const raw = await fetchVaultTree()
    dispatch({
      type: 'SET_VAULT',
      vault: normalizeTreeFromApi(raw, expanded),
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setVaultLoading(true)
      setVaultError(null)
      try {
        const raw = await fetchVaultTree()
        if (cancelled) return
        const expanded = collectExpandedByFolderId(vaultRef.current)
        dispatch({
          type: 'SET_VAULT',
          vault: normalizeTreeFromApi(raw, expanded),
        })
      } catch (e) {
        if (!cancelled) {
          setVaultError(
            e instanceof Error ? e.message : 'Failed to load vault.',
          )
        }
      } finally {
        if (!cancelled) setVaultLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [username])

  const activeFile = state.activeFileId
    ? findFile(state.vault, state.activeFileId)
    : null

  useNoteAutosave({
    activeFileId: state.activeFileId,
    activeFileContent: activeFile?.content,
    vault: state.vault,
    vaultRef,
    setVaultError,
  })

  const {
    focusedFolderId,
    onFolderRowFocus,
    folderRenameId,
    folderRenameDraft,
    setFolderRenameDraft,
    folderRenameInputRef,
    onStartFolderRename,
    commitFolderRename,
    cancelFolderRename,
  } = useFolderRename({
    vaultRef,
    vaultLoading,
    dispatch,
    activeFileId: state.activeFileId,
    setVaultError,
  })

  const openDeleteModal = useCallback((target) => {
    setDeleteModalDontAskAgain(false)
    setDeleteModal(target)
  }, [])

  const closeDeleteModal = useCallback(() => {
    setDeleteModalDontAskAgain(false)
    setDeleteModal(null)
  }, [])

  const closeSettingsModal = useCallback(() => {
    setSettingsModalOpen(false)
  }, [])

  async function runDelete(target) {
    setVaultError(null)
    if (target.kind === 'folder') {
      const pk = folderPkFromClientId(target.id)
      if (pk != null) await deleteFolder(pk)
    } else {
      const pk = notePkFromClientId(target.id)
      if (pk != null) await deleteNote(pk)
    }
    await syncVaultFromServer()
  }

  async function confirmDelete() {
    if (!deleteModal) return
    if (deleteModalDontAskAgain) {
      try {
        localStorage.setItem(SKIP_DELETE_CONFIRM_KEY, '1')
      } catch {
        /* ignore quota / private mode. */
      }
    }
    const target = deleteModal
    closeDeleteModal()
    try {
      await runDelete(target)
    } catch (e) {
      setVaultError(e instanceof Error ? e.message : 'Delete failed.')
    }
  }

  function handleDeleteRequest(target) {
    try {
      if (localStorage.getItem(SKIP_DELETE_CONFIRM_KEY) === '1') {
        void runDelete(target).catch((e) => {
          setVaultError(e instanceof Error ? e.message : 'Delete failed.')
        })
        return
      }
    } catch {
      /* fall through to modal. */
    }
    openDeleteModal(target)
  }

  const handleNewNote = useCallback(async () => {
    try {
      setVaultError(null)
      const created = await createNote(null, 'Untitled', vaultRef.current)
      await syncVaultFromServer()
      dispatch({ type: 'OPEN_FILE', id: `n-${created.id}` })
    } catch (e) {
      setVaultError(e instanceof Error ? e.message : 'Could not create note.')
    }
  }, [syncVaultFromServer])

  async function handleNewFolder() {
    try {
      setVaultError(null)
      await createFolder(null, 'New folder', vaultRef.current)
      await syncVaultFromServer()
    } catch (e) {
      setVaultError(
        e instanceof Error ? e.message : 'Could not create folder.',
      )
    }
  }

  const requestNoteTitleEdit = useCallback(
    (fileId, name) => {
      if (vaultLoading) return
      if (state.activeFileId === fileId) {
        vaultNavbarRef.current?.beginTitleEdit(name)
        return
      }
      pendingNoteTitleEditRef.current = { fileId, name }
      dispatch({ type: 'OPEN_FILE', id: fileId })
    },
    [vaultLoading, state.activeFileId, dispatch],
  )

  const displayTree = useMemo(() => {
    const sorted = sortTree(state.vault, state.sortAZ)
    return filterTree(sorted, state.searchQuery)
  }, [state.vault, state.sortAZ, state.searchQuery])

  const pinnedFileNodes = useMemo(
    () => collectPinnedFileNodes(state.vault, state.pinnedIds),
    [state.vault, state.pinnedIds],
  )

  const pinnedFolderNodes = useMemo(
    () => collectPinnedFolderNodes(state.vault, state.pinnedIds),
    [state.vault, state.pinnedIds],
  )

  const mainTreeNodes = useMemo(
    () => stripPinnedFilesFromNodes(displayTree, state.pinnedIds),
    [displayTree, state.pinnedIds],
  )

  const moveModalTargets = useMemo(() => {
    if (!moveModal) return []
    if (moveModal.kind === 'folder') {
      const folderNode = findFolderNode(state.vault, moveModal.node.id)
      if (!folderNode) return listFolderMoveTargets(state.vault, null)
      const exclude = collectDescendantFolderIdsIncludingSelf(folderNode)
      return listFolderMoveTargets(state.vault, exclude)
    }
    return listFolderMoveTargets(state.vault, null)
  }, [moveModal, state.vault])

  const moveModalCurrentParent = useMemo(() => {
    if (!moveModal) return null
    if (moveModal.kind === 'file') {
      return findParentFolderUidForFile(state.vault, moveModal.node.id)
    }
    return findParentFolderUidForFolder(state.vault, moveModal.node.id)
  }, [moveModal, state.vault])

  const closeMoveModal = useCallback(() => {
    setMoveModal(null)
  }, [])

  const confirmMoveToFolder = useCallback(
    async (targetFolderUid) => {
      if (!moveModal) return
      const { kind, node } = moveModal
      const targetPk =
        targetFolderUid == null ? null : folderPkFromClientId(targetFolderUid)
      if (kind === 'folder' && targetFolderUid === node.id) {
        closeMoveModal()
        return
      }
      if (kind === 'file') {
        const cur = findParentFolderUidForFile(state.vault, node.id)
        if (cur === targetFolderUid) {
          closeMoveModal()
          return
        }
      } else {
        const curParent = findParentFolderUidForFolder(state.vault, node.id)
        if (curParent === targetFolderUid) {
          closeMoveModal()
          return
        }
      }
      try {
        setVaultError(null)
        if (kind === 'file') {
          const pk = notePkFromClientId(node.id)
          if (pk == null) return
          await moveNoteToFolder(pk, targetPk)
        } else {
          const pk = folderPkFromClientId(node.id)
          if (pk == null) return
          await moveFolderToParent(pk, targetPk)
        }
        closeMoveModal()
        await syncVaultFromServer()
      } catch (e) {
        setVaultError(e instanceof Error ? e.message : 'Move failed.')
      }
    },
    [moveModal, state.vault, syncVaultFromServer, closeMoveModal],
  )

  const onVaultContextAction = useCallback(
    (action, kind, node) => {
      void (async () => {
        if (vaultLoading) return
        try {
          switch (action) {
            case 'newNote': {
              if (kind !== 'folder') return
              setVaultError(null)
              const created = await createNote(
                node.id,
                'Untitled',
                vaultRef.current,
              )
              await syncVaultFromServer()
              dispatch({ type: 'OPEN_FILE', id: `n-${created.id}` })
              break
            }
            case 'newFolder': {
              if (kind !== 'folder') return
              setVaultError(null)
              await createFolder(node.id, 'New folder', vaultRef.current)
              await syncVaultFromServer()
              break
            }
            case 'duplicate': {
              setVaultError(null)
              if (kind === 'file') {
                await duplicateNoteAsCopy(node, vaultRef.current)
              } else {
                await duplicateFolderRoot(
                  node,
                  () => vaultRef.current,
                  syncVaultFromServer,
                )
              }
              await syncVaultFromServer()
              break
            }
            case 'move':
              setMoveModal({ kind, node })
              break
            case 'download': {
              if (kind !== 'file') return
              downloadNoteAsMarkdownFile(node.name, node.content)
              break
            }
            case 'rename': {
              if (kind === 'folder') onStartFolderRename(node.id, node.name)
              else requestNoteTitleEdit(node.id, node.name)
              break
            }
            case 'pin':
              dispatch({ type: 'TOGGLE_PIN', id: node.id })
              break
            case 'delete':
              handleDeleteRequest({
                kind: kind === 'folder' ? 'folder' : 'file',
                id: node.id,
                name: node.name,
                folderNonEmpty:
                  kind === 'folder' &&
                  Boolean(node.children && node.children.length > 0),
              })
              break
            default:
              break
          }
        } catch (e) {
          setVaultError(
            e instanceof Error
              ? e.message
              : 'That action could not be completed.',
          )
        }
      })()
    },
    [
      vaultLoading,
      syncVaultFromServer,
      dispatch,
      onStartFolderRename,
      requestNoteTitleEdit,
      handleDeleteRequest,
    ],
  )

  const openVaultFile = useCallback((id) => {
    dispatch({ type: 'OPEN_FILE', id })
  }, [dispatch])

  const closeQuickOpen = useCallback(() => {
    setQuickOpenOpen(false)
  }, [])

  const canCloseEditorTab = Boolean(
    state.activeFileId || state.openTabs.length > 0,
  )

  const closeEditorTab = useCallback(() => {
    if (state.activeFileId) {
      dispatch({ type: 'CLOSE_TAB', id: state.activeFileId })
      return
    }
    if (state.openTabs.length > 0) {
      dispatch({
        type: 'CLOSE_TAB',
        id: state.openTabs[state.openTabs.length - 1],
      })
    }
  }, [state.activeFileId, state.openTabs])

  useVaultKeyboardShortcuts({
    deleteModal,
    quickOpenOpen,
    setQuickOpenOpen,
    handleNewNote,
    closeEditorTab,
  })

  const renameActiveNote = useCallback(
    async (fileId, trimmed) => {
      const pk = notePkFromClientId(fileId)
      if (pk == null) return
      setVaultError(null)
      await patchNoteName(pk, trimmed)
      dispatch({ type: 'RENAME_NOTE', fileId, name: trimmed })
    },
    [dispatch],
  )

  const onRenameNoteError = useCallback((message) => {
    setVaultError(message)
  }, [])

  const stopLintToastAnimation = useCallback(() => {
    if (lintToastRafRef.current != null) {
      cancelAnimationFrame(lintToastRafRef.current)
      lintToastRafRef.current = null
    }
  }, [])

  const dismissLintToast = useCallback(() => {
    stopLintToastAnimation()
    lintToastDeadlineRef.current = null
    lintToastPausedRef.current = false
    lintToastRemainingMsRef.current = null
    setLintMessage('')
  }, [stopLintToastAnimation])

  const runLintToastLoop = useCallback(() => {
    stopLintToastAnimation()
    const loop = (now) => {
      const fill = lintProgressFillRef.current
      const deadline = lintToastDeadlineRef.current
      const initial = lintToastInitialMsRef.current
      if (!fill || deadline == null) return
      if (lintToastPausedRef.current) return

      const remaining = Math.max(0, deadline - now)
      const progress =
        initial > 0 ? Math.min(1, (initial - remaining) / initial) : 1
      fill.style.transform = `scaleX(${progress})`

      if (remaining <= 0) {
        dismissLintToast()
        return
      }
      lintToastRafRef.current = requestAnimationFrame(loop)
    }
    lintToastRafRef.current = requestAnimationFrame(loop)
  }, [dismissLintToast, stopLintToastAnimation])

  const showLintMessage = useCallback((message) => {
    setLintMessage(message)
  }, [])

  useEffect(() => {
    if (!lintMessage) {
      stopLintToastAnimation()
      lintToastDeadlineRef.current = null
      lintToastPausedRef.current = false
      lintToastRemainingMsRef.current = null
      return
    }
    lintToastPausedRef.current = false
    lintToastInitialMsRef.current = LINT_TOAST_DURATION_MS
    lintToastDeadlineRef.current = performance.now() + LINT_TOAST_DURATION_MS
    requestAnimationFrame(() => {
      const el = lintProgressFillRef.current
      if (el) el.style.transform = 'scaleX(0)'
    })
    runLintToastLoop()
    return () => stopLintToastAnimation()
  }, [lintMessage, runLintToastLoop, stopLintToastAnimation])

  const onLintToastPointerEnter = useCallback(() => {
    const deadline = lintToastDeadlineRef.current
    if (deadline == null) return
    const now = performance.now()
    lintToastRemainingMsRef.current = Math.max(0, deadline - now)
    lintToastPausedRef.current = true
    stopLintToastAnimation()
  }, [stopLintToastAnimation])

  const onLintToastPointerLeave = useCallback(() => {
    if (!lintToastPausedRef.current) return
    lintToastPausedRef.current = false
    const rem = lintToastRemainingMsRef.current ?? 0
    lintToastDeadlineRef.current = performance.now() + rem
    lintToastRemainingMsRef.current = null
    runLintToastLoop()
  }, [runLintToastLoop])

  useEffect(() => {
    if (state.openTabs.length > 0) return
    stopLintToastAnimation()
    setLintMessage('')
    setLintBusy(false)
    setEditorPaneMode('split')
  }, [state.openTabs.length, stopLintToastAnimation])

  const toggleEditorLeftPane = useCallback(() => {
    setEditorPaneMode((m) => {
      if (m === 'split') return 'preview-only'
      if (m === 'preview-only') return 'split'
      if (m === 'source-only') return 'preview-only'
      return m
    })
  }, [])

  const toggleEditorRightPane = useCallback(() => {
    setEditorPaneMode((m) => {
      if (m === 'split') return 'source-only'
      if (m === 'source-only') return 'split'
      if (m === 'preview-only') return 'source-only'
      return m
    })
  }, [])

  const onLintActiveNote = useCallback(async () => {
    if (!activeFile || lintBusy) return
    setLintBusy(true)
    setLintMessage('')
    try {
      const {
        text,
        initialIssueCount,
        remainingIssueCount,
        remainingIssues,
      } = await lintAndFixMarkdown(activeFile.content)
      if (text !== activeFile.content) {
        dispatch({
          type: 'SET_CONTENT',
          fileId: activeFile.id,
          content: text,
        })
      }
      if (initialIssueCount === 0) {
        showLintMessage('No markdownlint issues found.')
      } else if (remainingIssueCount === 0) {
        showLintMessage(
          `Applied auto-fixes for ${initialIssueCount} issue(s). All clear.`,
        )
      } else {
        const sorted = [...remainingIssues].sort(
          (a, b) =>
            a.lineNumber - b.lineNumber ||
            String(a.ruleName).localeCompare(String(b.ruleName)),
        )
        const maxDetail = 18
        const detailLines = sorted.slice(0, maxDetail).map((i) => {
          const extra = i.detail ? ` (${i.detail})` : ''
          return `Line ${i.lineNumber}: ${i.ruleName} ${i.description}${extra}`
        })
        let body = detailLines.join('\n')
        if (sorted.length > maxDetail) {
          body += `\n… and ${sorted.length - maxDetail} more.`
        }
        showLintMessage(
          `Applied fixes where possible.\nWarnings (optional review):\n${body}`,
        )
      }
    } catch (e) {
      showLintMessage(
        e instanceof Error ? e.message : 'Markdown lint failed.',
      )
    } finally {
      setLintBusy(false)
    }
  }, [activeFile, lintBusy, dispatch, showLintMessage])

  return (
    <div className="app-obsidian">
      <div className="app-body">
        <VaultSidebar
          vault={state.vault}
          vaultLoading={vaultLoading}
          vaultError={vaultError}
          searchQuery={state.searchQuery}
          sortAZ={state.sortAZ}
          pinnedIds={state.pinnedIds}
          activeFileId={state.activeFileId}
          dispatch={dispatch}
          pinnedFolderNodes={pinnedFolderNodes}
          pinnedFileNodes={pinnedFileNodes}
          mainTreeNodes={mainTreeNodes}
          pinnedSectionOpen={pinnedSectionOpen}
          setPinnedSectionOpen={setPinnedSectionOpen}
          onNewNote={handleNewNote}
          onNewFolder={handleNewFolder}
          onRequestDelete={handleDeleteRequest}
          focusedFolderId={focusedFolderId}
          onFolderRowFocus={onFolderRowFocus}
          folderRenameId={folderRenameId}
          folderRenameDraft={folderRenameDraft}
          onFolderRenameDraftChange={setFolderRenameDraft}
          onStartFolderRename={onStartFolderRename}
          onCommitFolderRename={commitFolderRename}
          onCancelFolderRename={cancelFolderRename}
          folderRenameInputRef={folderRenameInputRef}
          onRequestNoteTitleEdit={requestNoteTitleEdit}
          username={username}
          onLogout={onLogout}
          setSettingsModalOpen={setSettingsModalOpen}
          onVaultContextAction={onVaultContextAction}
        />

        <section className="editor-pane" aria-label="Editor">
          <VaultNavbar
            ref={vaultNavbarRef}
            vault={state.vault}
            openTabs={state.openTabs}
            activeFileId={state.activeFileId}
            nav={state.nav}
            dispatch={dispatch}
            vaultLoading={vaultLoading}
            onNewNote={handleNewNote}
            pendingNoteTitleEditRef={pendingNoteTitleEditRef}
            onRenameActiveNote={renameActiveNote}
            onRenameNoteError={onRenameNoteError}
            onLintActiveNote={onLintActiveNote}
            lintBusy={lintBusy}
            editorPaneMode={editorPaneMode}
            onToggleEditorLeftPane={toggleEditorLeftPane}
            onToggleEditorRightPane={toggleEditorRightPane}
            showEditorLineNumbers={editorLineNumbersVisible}
            onToggleEditorLineNumbers={toggleEditorLineNumbers}
          />

          {activeFile ? (
            <MarkdownEditor
              file={activeFile}
              dispatch={dispatch}
              paneMode={editorPaneMode}
              showLineNumbers={editorLineNumbersVisible}
            />
          ) : (
            <EditorEmptyState
              vaultLoading={vaultLoading}
              modLabel={modLabel}
              onNewNote={handleNewNote}
              onOpenQuickOpen={() => setQuickOpenOpen(true)}
              onCloseTab={closeEditorTab}
              canCloseEditorTab={canCloseEditorTab}
            />
          )}
        </section>
      </div>

      {lintMessage ? (
        <div
          className="lint-toast"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          onPointerEnter={onLintToastPointerEnter}
          onPointerLeave={onLintToastPointerLeave}
        >
          <div className="lint-toast-body">
            <span className="lint-toast-text">{lintMessage}</span>
            <button
              type="button"
              className="lint-toast-dismiss"
              aria-label="Dismiss notification"
              onClick={dismissLintToast}
            >
              <i className="bi bi-x-lg" aria-hidden />
            </button>
          </div>
          <div className="lint-toast-progress-track" aria-hidden="true">
            <div
              ref={lintProgressFillRef}
              className="lint-toast-progress-fill"
            />
          </div>
        </div>
      ) : null}

      <QuickOpenDialog
        open={quickOpenOpen}
        onClose={closeQuickOpen}
        vault={state.vault}
        onPick={openVaultFile}
      />

      <SettingsModal
        open={settingsModalOpen}
        username={username}
        onClose={closeSettingsModal}
      />

      <DeleteConfirmModal
        target={deleteModal}
        dontAskAgain={deleteModalDontAskAgain}
        onDontAskAgainChange={setDeleteModalDontAskAgain}
        onConfirm={confirmDelete}
        onClose={closeDeleteModal}
      />

      <MoveTargetModal
        open={Boolean(moveModal)}
        title={
          moveModal
            ? moveModal.kind === 'file'
              ? `Move file “${moveModal.node.name}” to…`
              : `Move folder “${moveModal.node.name}” to…`
            : ''
        }
        targets={moveModalTargets}
        currentFolderUid={moveModalCurrentParent ?? null}
        onPick={(folderUid) => void confirmMoveToFolder(folderUid)}
        onClose={closeMoveModal}
      />
    </div>
  )
}

export default App
