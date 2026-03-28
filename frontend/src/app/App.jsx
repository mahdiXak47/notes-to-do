import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import './App.css'
import { ToastStack } from '../components/AppToast.jsx'
import { DeleteConfirmModal } from '../components/modals/DeleteConfirmModal.jsx'
import { MoveTargetModal } from '../components/modals/MoveTargetModal.jsx'
import { EditorEmptyState } from '../components/editor/EditorEmptyState.jsx'
import { MarkdownEditor } from '../components/editor/MarkdownEditor.jsx'
import { UploadedAssetViewer } from '../components/editor/UploadedAssetViewer.jsx'
import { QuickOpenDialog } from '../components/modals/QuickOpenDialog.jsx'
import { SettingsModal } from '../components/modals/SettingsModal.jsx'
import { VaultNavbar } from '../components/vault/VaultNavbar.jsx'
import { VaultSidebar } from '../components/vault/VaultSidebar.jsx'
import {
  addPin,
  collectExpandedByFolderId,
  createFolder,
  createNote,
  deleteFolder,
  deleteNote,
  downloadFolderAsZip,
  folderHasFiles,
  duplicateFolderRoot,
  duplicateNoteAsCopy,
  downloadNoteAsMarkdownFile,
  fetchPins,
  fetchVaultTree,
  folderPkFromClientId,
  moveFolderToParent,
  moveNoteToFolder,
  normalizeTreeFromApi,
  notePkFromClientId,
  patchNoteBody,
  patchNoteName,
  removePin,
} from '../lib/vaultApi.js'
import { initialVaultState, vaultReducer } from '../lib/vaultReducer.js'
import {
  collectDescendantFolderIdsIncludingSelf,
  collectPinnedFileNodes,
  collectPinnedFolderNodes,
  filterTree,
  findFolderNode,
  sortTree,
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
import { apiUrl, authorizedFetch, getAccessToken } from '../lib/auth.js'
import {
  classifyVaultUploadFile,
  readVaultUploadBody,
} from '../lib/vaultUpload.js'

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
  const [uploadedSectionOpen, setUploadedSectionOpen] = useState(true)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [vaultLoading, setVaultLoading] = useState(true)
  const [vaultError, setVaultError] = useState(null)
  const [quickOpenOpen, setQuickOpenOpen] = useState(false)
  const vaultNavbarRef = useRef(null)
  const pendingNoteTitleEditRef = useRef(null)
  const vaultRef = useRef([])
  vaultRef.current = state.vault
  const pinnedIdsRef = useRef(state.pinnedIds)
  pinnedIdsRef.current = state.pinnedIds
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [moveModal, setMoveModal] = useState(null)
  const [lintBusy, setLintBusy] = useState(false)
  const [lintMessage, setLintMessage] = useState('')
  const [uploadedAssets, setUploadedAssets] = useState([])
  const [activeUploadAssetId, setActiveUploadAssetId] = useState(null)
  const [toasts, setToasts] = useState([])
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

  const reloadUploadedAssets = useCallback(async () => {
    try {
      const res = await authorizedFetch('/api/vault/uploads-list/', {
        method: 'GET',
      })
      const data = await res.json().catch(() => ({}))
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : []
      setUploadedAssets(items)
    } catch (e) {
      setVaultError(e instanceof Error ? e.message : 'Failed to load uploads.')
    }
  }, [setUploadedAssets, setVaultError])

  const addToast = useCallback((message, variant = 'success') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, variant }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    if (!username) return
    void reloadUploadedAssets()
  }, [username, reloadUploadedAssets])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setVaultLoading(true)
      setVaultError(null)
      try {
        const [raw, pinnedIds] = await Promise.all([fetchVaultTree(), fetchPins()])
        if (cancelled) return
        const expanded = collectExpandedByFolderId(vaultRef.current)
        dispatch({
          type: 'SET_VAULT',
          vault: normalizeTreeFromApi(raw, expanded),
        })
        dispatch({ type: 'SET_PINNED_IDS', pinnedIds })
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

  const activeUploadAsset = useMemo(() => {
    if (!activeUploadAssetId) return null
    return uploadedAssets.find((a) => a.id === activeUploadAssetId) ?? null
  }, [uploadedAssets, activeUploadAssetId])

  const dispatchWithUploadClear = useCallback(
    (action) => {
      if (action?.type === 'OPEN_FILE') setActiveUploadAssetId(null)
      dispatch(action)
    },
    [dispatch],
  )

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

  const runDelete = useCallback(
    async (target) => {
      setVaultError(null)
      if (target.kind === 'upload') {
        const res = await authorizedFetch(`/api/vault/uploads/${target.id}/`, { method: 'DELETE' })
        if (!res.ok) throw new Error(`Failed to delete uploaded file (${res.status}).`)
        await reloadUploadedAssets()
        if (activeUploadAssetId === target.id) setActiveUploadAssetId(null)
      } else if (target.kind === 'folder') {
        const pk = folderPkFromClientId(target.id)
        if (pk != null) await deleteFolder(pk)
        await syncVaultFromServer()
      } else {
        const pk = notePkFromClientId(target.id)
        if (pk != null) await deleteNote(pk)
        await syncVaultFromServer()
      }
    },
    [syncVaultFromServer, reloadUploadedAssets, activeUploadAssetId],
  )

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

  const handleDeleteRequest = useCallback(
    (target) => {
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
    },
    [runDelete, openDeleteModal],
  )

  const onUploadContextAction = useCallback(
    async (action, storedName, thirdArg) => {
      // action='delete': thirdArg is the full asset object
      // action='copyLink': thirdArg is the full asset object
      // action='rename': storedName is the current stored id, thirdArg is the new display name string
      if (action === 'delete') {
        const asset = thirdArg
        handleDeleteRequest({
          kind: 'upload',
          id: storedName,
          name: asset?.original_name || storedName,
        })
        return
      }
      if (action === 'copyLink') {
        const asset = thirdArg
        const token = getAccessToken()
        const url = apiUrl(`/api/vault/uploads/${storedName}/`) + (token ? `?access_token=${token}` : '')
        const displayName = asset?.original_name || storedName
        const isImage = typeof asset?.mime_type === 'string' && asset.mime_type.startsWith('image/')
        const mdLink = isImage ? `![${displayName}](${url})` : `[${displayName}](${url})`
        try {
          await navigator.clipboard.writeText(mdLink)
          addToast('Link copied to clipboard.', 'success')
        } catch {
          addToast('Could not copy to clipboard.', 'error')
        }
        return
      }
      if (action === 'rename') {
        const newDisplayName = thirdArg
        try {
          const res = await authorizedFetch(`/api/vault/uploads/${storedName}/`, {
            method: 'PATCH',
            body: JSON.stringify({ name: newDisplayName }),
          })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.detail || `Rename failed (${res.status}).`)
          }
          await reloadUploadedAssets()
          addToast('File renamed.', 'success')
        } catch (e) {
          addToast(e instanceof Error ? e.message : 'Rename failed.', 'error')
        }
      }
    },
    [handleDeleteRequest, reloadUploadedAssets, addToast],
  )

  const handleNewNote = useCallback(async () => {
    try {
      setVaultError(null)
      const created = await createNote(null, 'Untitled', vaultRef.current)
      await syncVaultFromServer()
      dispatchWithUploadClear({
        type: 'OPEN_FILE',
        id: `n-${created.id}`,
      })
    } catch (e) {
      setVaultError(e instanceof Error ? e.message : 'Could not create note.')
    }
  }, [syncVaultFromServer, dispatchWithUploadClear])

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

  const handleVaultFileUpload = useCallback(
    async (fileList) => {
      if (vaultLoading || uploadBusy) return
      const files = Array.from(fileList ?? [])
      if (files.length === 0) return
      const rejected = []
      const newIds = []
      setUploadBusy(true)
      setVaultError(null)
      try {
        for (const file of files) {
          const spec = classifyVaultUploadFile(file)
          if (!spec) {
            rejected.push({ name: file.name, msg: 'Unsupported file type. Allowed: .md, .png, .jpg, .jpeg, .svg.' })
            continue
          }
          if (spec.kind === 'markdown') {
            const body = await readVaultUploadBody(file, spec.kind)
            const created = await createNote(null, spec.stem, vaultRef.current)
            await patchNoteBody(created.id, body)
            await syncVaultFromServer()
            const id = `n-${created.id}`
            newIds.push(id)
            addToast(`"${file.name}" imported as a new note.`, 'success')
            continue
          }

          const fd = new FormData()
          fd.append('files', file)
          const res = await authorizedFetch('/api/vault/uploads/', {
            method: 'POST',
            body: fd,
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            rejected.push({ name: file.name, msg: data?.detail || data?.message || data?.error || 'Upload failed.' })
            continue
          }

          const items = Array.isArray(data?.items) ? data.items : []
          const lastItem = items[items.length - 1]
          if (!lastItem?.id) {
            rejected.push({ name: file.name, msg: 'Upload returned no items.' })
            continue
          }
          await reloadUploadedAssets()
          setActiveUploadAssetId(lastItem.id)
          addToast(`"${file.name}" uploaded successfully.`, 'success')
        }
        if (newIds.length > 0) {
          dispatchWithUploadClear({
            type: 'OPEN_FILE',
            id: newIds[newIds.length - 1],
          })
        }
        if (rejected.length > 0) {
          for (const { name, msg } of rejected) {
            addToast(`"${name}": ${msg}`, 'error')
          }
        }
      } catch (e) {
        addToast(e instanceof Error ? e.message : 'Upload failed.', 'error')
      } finally {
        setUploadBusy(false)
      }
    },
    [
      vaultLoading,
      uploadBusy,
      syncVaultFromServer,
      reloadUploadedAssets,
      dispatchWithUploadClear,
      addToast,
    ],
  )

  const requestNoteTitleEdit = useCallback(
    (fileId, name) => {
      if (vaultLoading) return
      if (state.activeFileId === fileId) {
        vaultNavbarRef.current?.beginTitleEdit(name)
        return
      }
      pendingNoteTitleEditRef.current = { fileId, name }
      dispatchWithUploadClear({ type: 'OPEN_FILE', id: fileId })
    },
    [vaultLoading, state.activeFileId, dispatchWithUploadClear],
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

  const mainTreeNodes = displayTree

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
              dispatchWithUploadClear({
                type: 'OPEN_FILE',
                id: `n-${created.id}`,
              })
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
              if (kind === 'file') {
                downloadNoteAsMarkdownFile(node.name, node.content)
              } else if (kind === 'folder') {
                const fullNode = findFolderNode(vaultRef.current, node.id) ?? node
                if (!folderHasFiles(fullNode)) {
                  addToast(`"${node.name}" has no notes inside — move notes into it first, then download.`, 'error')
                  break
                }
                await downloadFolderAsZip(fullNode)
              }
              break
            }
            case 'rename': {
              if (kind === 'folder') onStartFolderRename(node.id, node.name)
              else requestNoteTitleEdit(node.id, node.name)
              break
            }
            case 'pin': {
              const isPinned = Boolean(pinnedIdsRef.current[node.id])
              // Optimistic local update
              dispatch({ type: 'TOGGLE_PIN', id: node.id })
              // Sync to backend
              const pk = kind === 'folder'
                ? folderPkFromClientId(node.id)
                : notePkFromClientId(node.id)
              const itemType = kind === 'folder' ? 'folder' : 'note'
              if (pk != null) {
                if (isPinned) await removePin(itemType, pk)
                else await addPin(itemType, pk)
              }
              break
            }
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
      dispatchWithUploadClear,
      onStartFolderRename,
      requestNoteTitleEdit,
      handleDeleteRequest,
    ],
  )

  const openVaultFile = useCallback((id) => {
    dispatchWithUploadClear({ type: 'OPEN_FILE', id })
  }, [dispatchWithUploadClear])

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
          dispatch={dispatchWithUploadClear}
          pinnedFolderNodes={pinnedFolderNodes}
          pinnedFileNodes={pinnedFileNodes}
          mainTreeNodes={mainTreeNodes}
          pinnedSectionOpen={pinnedSectionOpen}
          setPinnedSectionOpen={setPinnedSectionOpen}
          uploadedAssets={uploadedAssets}
          uploadedSectionOpen={uploadedSectionOpen}
          setUploadedSectionOpen={setUploadedSectionOpen}
          onUploadVaultFiles={handleVaultFileUpload}
          uploadBusy={uploadBusy}
          activeUploadedAssetId={activeUploadAssetId}
          onOpenUploadedAsset={(a) => setActiveUploadAssetId(a?.id ?? null)}
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
          onUploadContextAction={onUploadContextAction}
        />

        <section className="editor-pane" aria-label="Editor">
          <VaultNavbar
            ref={vaultNavbarRef}
            vault={state.vault}
            openTabs={state.openTabs}
            activeFileId={state.activeFileId}
            nav={state.nav}
            dispatch={dispatchWithUploadClear}
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

          {activeUploadAsset ? (
            <UploadedAssetViewer asset={activeUploadAsset} />
          ) : activeFile ? (
            <MarkdownEditor
              file={activeFile}
              dispatch={dispatchWithUploadClear}
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

      <ToastStack toasts={toasts} onDismiss={removeToast} />

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
