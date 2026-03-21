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
  const vaultRef = useRef([])
  vaultRef.current = state.vault
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [moveModal, setMoveModal] = useState(null)
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
            case 'delete':
              handleDeleteRequest({
                kind: kind === 'folder' ? 'folder' : 'file',
                id: node.id,
                name: node.name,
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
