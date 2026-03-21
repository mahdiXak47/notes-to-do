import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import './App.css'
import { DeleteConfirmModal } from './DeleteConfirmModal.jsx'
import { EditorEmptyState } from './EditorEmptyState.jsx'
import { MarkdownEditor } from './MarkdownEditor.jsx'
import { QuickOpenDialog } from './QuickOpenDialog.jsx'
import { SettingsModal } from './SettingsModal.jsx'
import { VaultNavbar } from './VaultNavbar.jsx'
import { VaultSidebar } from './VaultSidebar.jsx'
import {
  collectExpandedByFolderId,
  createFolder,
  createNote,
  deleteFolder,
  deleteNote,
  fetchVaultTree,
  folderPkFromClientId,
  normalizeTreeFromApi,
  notePkFromClientId,
  patchFolderName,
  patchNoteBody,
  patchNoteName,
} from './vaultApi.js'
import { initialVaultState, vaultReducer } from './vaultReducer.js'
import {
  collectPinnedFileNodes,
  filterTree,
  findFolderNode,
  sortTree,
  stripPinnedFilesFromNodes,
} from './vaultTreeOps.js'
import { findFile } from './vaultTreePaths.js'

const SKIP_DELETE_CONFIRM_KEY = 'notes_skip_delete_confirm'

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
  const [focusedFolderId, setFocusedFolderId] = useState(null)
  const [folderRenameId, setFolderRenameId] = useState(null)
  const [folderRenameDraft, setFolderRenameDraft] = useState('')
  const folderRenameInputRef = useRef(null)
  const vaultRef = useRef([])
  vaultRef.current = state.vault
  const lastSavedBodyRef = useRef({})
  const prevActiveFileIdRef = useRef(null)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const modLabel = useMemo(() => modKeyLabel(), [])

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

  const onFolderRowFocus = useCallback((folderId) => {
    setFocusedFolderId(folderId)
  }, [])

  const cancelFolderRename = useCallback(() => {
    setFolderRenameId(null)
    setFolderRenameDraft('')
  }, [])

  const commitFolderRename = useCallback(async () => {
    if (!folderRenameId) return
    const folder = findFolderNode(vaultRef.current, folderRenameId)
    const trimmed = folderRenameDraft.trim()
    if (!folder) {
      cancelFolderRename()
      return
    }
    if (!trimmed) {
      setFolderRenameDraft(folder.name)
      setFolderRenameId(null)
      return
    }
    if (trimmed === folder.name) {
      setFolderRenameId(null)
      return
    }
    const pk = folderPkFromClientId(folderRenameId)
    if (pk == null) {
      setFolderRenameId(null)
      return
    }
    try {
      setVaultError(null)
      await patchFolderName(pk, trimmed)
      dispatch({
        type: 'RENAME_FOLDER',
        folderId: folderRenameId,
        name: trimmed,
      })
      setFolderRenameId(null)
      setFolderRenameDraft('')
    } catch (e) {
      setVaultError(
        e instanceof Error ? e.message : 'Could not rename folder.',
      )
      setFolderRenameDraft(folder.name)
      setFolderRenameId(null)
    }
  }, [folderRenameId, folderRenameDraft, dispatch, cancelFolderRename])

  const onStartFolderRename = useCallback(
    (folderId, name) => {
      if (vaultLoading) return
      setFolderRenameId(folderId)
      setFolderRenameDraft(name)
    },
    [vaultLoading],
  )

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

  const mainTreeNodes = useMemo(
    () => stripPinnedFilesFromNodes(displayTree, state.pinnedIds),
    [displayTree, state.pinnedIds],
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

  useEffect(() => {
    function onKeyDown(e) {
      if (deleteModal) return

      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === 'n') {
        e.preventDefault()
        if (quickOpenOpen) setQuickOpenOpen(false)
        void handleNewNote()
        return
      }
      if (k === 'o') {
        e.preventDefault()
        setQuickOpenOpen((open) => !open)
        return
      }
      if (k === 'w') {
        e.preventDefault()
        if (quickOpenOpen) {
          setQuickOpenOpen(false)
          return
        }
        closeEditorTab()
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteModal, quickOpenOpen, handleNewNote, closeEditorTab])

  const activeFile = state.activeFileId
    ? findFile(state.vault, state.activeFileId)
    : null

  useEffect(() => {
    if (!folderRenameId) return undefined
    const raf = window.requestAnimationFrame(() => {
      const el = folderRenameInputRef.current
      if (el) {
        el.focus()
        el.select()
      }
    })
    return () => window.cancelAnimationFrame(raf)
  }, [folderRenameId])

  useEffect(() => {
    if (!state.activeFileId) return
    setFocusedFolderId(null)
    setFolderRenameId(null)
    setFolderRenameDraft('')
  }, [state.activeFileId])

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

  useEffect(() => {
    if (state.activeFileId === prevActiveFileIdRef.current) return
    prevActiveFileIdRef.current = state.activeFileId
    const fid = state.activeFileId
    if (!fid || !String(fid).startsWith('n-')) return
    const f = findFile(state.vault, fid)
    if (f) lastSavedBodyRef.current[fid] = f.content
  }, [state.activeFileId, state.vault])

  useEffect(() => {
    const fileId = state.activeFileId
    if (!fileId || !String(fileId).startsWith('n-')) return undefined
    const pk = notePkFromClientId(fileId)
    if (pk == null) return undefined
    const savedRef = lastSavedBodyRef
    const t = setTimeout(() => {
      const file = findFile(vaultRef.current, fileId)
      if (!file || file.type !== 'file') return
      if (savedRef.current[fileId] === file.content) return
      void patchNoteBody(pk, file.content)
        .then(() => {
          savedRef.current[fileId] = file.content
        })
        .catch((e) => {
          setVaultError(
            e instanceof Error ? e.message : 'Failed to save note.',
          )
        })
    }, 600)
    return () => {
      clearTimeout(t)
      const file = findFile(vaultRef.current, fileId)
      if (
        file &&
        file.type === 'file' &&
        savedRef.current[fileId] !== file.content
      ) {
        void patchNoteBody(pk, file.content)
          .then(() => {
            savedRef.current[fileId] = file.content
          })
          .catch((e) => {
            setVaultError(
              e instanceof Error ? e.message : 'Failed to save note.',
            )
          })
      }
    }
  }, [state.activeFileId, activeFile?.content])

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
          />

          {activeFile ? (
            <MarkdownEditor file={activeFile} dispatch={dispatch} />
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
    </div>
  )
}

export default App
