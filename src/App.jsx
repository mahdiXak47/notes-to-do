import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'
import { apiUrl } from './auth.js'
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
  pruneStateForVaultTree,
} from './vaultApi.js'

const SKIP_DELETE_CONFIRM_KEY = 'notes_skip_delete_confirm'
const SIDEBAR_COLLAPSED_KEY = 'notes_sidebar_collapsed'
const EDITOR_SPLIT_STORAGE_KEY = 'notes_editor_split_pct'
const EDITOR_SPLIT_MIN = 18
const EDITOR_SPLIT_MAX = 82

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function readStoredEditorSplitPct() {
  try {
    const v = localStorage.getItem(EDITOR_SPLIT_STORAGE_KEY)
    const n = v != null ? Number(v) : NaN
    if (Number.isFinite(n) && n >= EDITOR_SPLIT_MIN && n <= EDITOR_SPLIT_MAX) {
      return n
    }
  } catch {
    /* ignore quota / private mode. */
  }
  return 50
}

function sortTree(nodes, enabled) {
  if (!enabled) return nodes
  return [...nodes]
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map((n) =>
      n.type === 'folder'
        ? { ...n, children: sortTree(n.children, true) }
        : n,
    )
}

function filterTree(nodes, query) {
  const q = query.trim().toLowerCase()
  if (!q) return nodes
  const walk = (list) => {
    const out = []
    for (const n of list) {
      if (n.type === 'folder') {
        const children = walk(n.children)
        if (n.name.toLowerCase().includes(q) || children.length > 0) {
          out.push({ ...n, children })
        }
      } else if (n.name.toLowerCase().includes(q)) {
        out.push(n)
      }
    }
    return out
  }
  return walk(nodes)
}

function findFile(nodes, fileId) {
  for (const n of nodes) {
    if (n.type === 'file' && n.id === fileId) return n
    if (n.type === 'folder') {
      const f = findFile(n.children, fileId)
      if (f) return f
    }
  }
  return null
}

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

function modKeyLabel() {
  if (typeof navigator === 'undefined') return 'Ctrl'
  return /Mac|iPhone|iPod/i.test(navigator.platform || '') ? '⌘' : 'Ctrl'
}

function findBreadcrumb(nodes, fileId, acc = []) {
  for (const n of nodes) {
    if (n.type === 'file' && n.id === fileId) return [...acc, n.name]
    if (n.type === 'folder') {
      const p = findBreadcrumb(n.children, fileId, [...acc, n.name])
      if (p) return p
    }
  }
  return null
}

function findFolderBreadcrumb(nodes, folderId, acc = []) {
  for (const n of nodes) {
    if (n.type === 'folder' && n.id === folderId) return [...acc, n.name]
    if (n.type === 'folder') {
      const p = findFolderBreadcrumb(n.children, folderId, [...acc, n.name])
      if (p) return p
    }
  }
  return null
}

function pathJoined(segments) {
  if (!segments?.length) return ''
  return segments.join('/')
}

function splitDirAndFileName(segments, fallbackName) {
  if (!segments?.length) return { dir: '', name: fallbackName }
  if (segments.length === 1) return { dir: '', name: segments[0] }
  return {
    dir: segments.slice(0, -1).join('/'),
    name: segments[segments.length - 1],
  }
}

function TreePathLabel({ segments, fallbackName }) {
  const { dir, name } = splitDirAndFileName(segments, fallbackName)
  const title = dir ? `${dir}/${name}` : name
  return (
    <span className="tree-label text-truncate tree-path-label" title={title}>
      {dir ? (
        <>
          <span className="tree-path-dir">{dir}</span>
          <span className="tree-path-sep">/</span>
        </>
      ) : null}
      <span className="tree-path-file">{name}</span>
    </span>
  )
}

function collectPinnedFileNodes(vault, pinnedIds) {
  const out = []
  function walk(list) {
    for (const n of list) {
      if (n.type === 'file' && pinnedIds[n.id]) out.push(n)
      else if (n.type === 'folder') walk(n.children)
    }
  }
  walk(vault)
  out.sort((a, b) => {
    const pa = pathJoined(findBreadcrumb(vault, a.id) || [])
    const pb = pathJoined(findBreadcrumb(vault, b.id) || [])
    return pa.localeCompare(pb, undefined, { sensitivity: 'base' })
  })
  return out
}

function stripPinnedFilesFromNodes(nodes, pinnedIds) {
  const out = []
  for (const n of nodes) {
    if (n.type === 'file') {
      if (!pinnedIds[n.id]) out.push(n)
    } else {
      out.push({
        ...n,
        children: stripPinnedFilesFromNodes(n.children, pinnedIds),
      })
    }
  }
  return out
}

function toggleFolder(nodes, folderId) {
  return nodes.map((n) => {
    if (n.type === 'folder') {
      if (n.id === folderId) return { ...n, expanded: !n.expanded }
      return { ...n, children: toggleFolder(n.children, folderId) }
    }
    return n
  })
}

function setFileContent(nodes, fileId, content) {
  return nodes.map((n) => {
    if (n.type === 'folder') {
      return { ...n, children: setFileContent(n.children, fileId, content) }
    }
    if (n.id === fileId) return { ...n, content }
    return n
  })
}

function renameFileInTree(nodes, fileId, name) {
  return nodes.map((n) => {
    if (n.type === 'folder') {
      return { ...n, children: renameFileInTree(n.children, fileId, name) }
    }
    if (n.id === fileId) return { ...n, name }
    return n
  })
}

function findFolderNode(nodes, folderId) {
  for (const n of nodes) {
    if (n.type === 'folder') {
      if (n.id === folderId) return n
      const inner = findFolderNode(n.children, folderId)
      if (inner) return inner
    }
  }
  return null
}

function renameFolderInTree(nodes, folderId, name) {
  return nodes.map((n) => {
    if (n.type === 'folder') {
      if (n.id === folderId) {
        return { ...n, name }
      }
      return { ...n, children: renameFolderInTree(n.children, folderId, name) }
    }
    return n
  })
}

function collapseAll(nodes) {
  return nodes.map((n) => {
    if (n.type === 'folder') {
      return { ...n, expanded: false, children: collapseAll(n.children) }
    }
    return n
  })
}

const initialState = {
  vault: [],
  openTabs: [],
  activeFileId: null,
  nav: { ids: [], i: 0 },
  searchQuery: '',
  sortAZ: false,
  pinnedIds: {},
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_VAULT': {
      const pruned = pruneStateForVaultTree(state, action.vault)
      return {
        ...state,
        vault: action.vault,
        ...pruned,
      }
    }
    case 'OPEN_FILE': {
      const { id } = action
      const openTabs = state.openTabs.includes(id)
        ? state.openTabs
        : [...state.openTabs, id]
      const base = state.nav.ids.slice(0, state.nav.i + 1)
      const nav =
        base[base.length - 1] === id
          ? state.nav
          : { ids: [...base, id], i: base.length }
      return { ...state, openTabs, activeFileId: id, nav }
    }
    case 'GO_BACK': {
      if (state.nav.i <= 0) return state
      const ni = state.nav.i - 1
      return {
        ...state,
        activeFileId: state.nav.ids[ni],
        nav: { ...state.nav, i: ni },
      }
    }
    case 'GO_FORWARD': {
      if (state.nav.i >= state.nav.ids.length - 1) return state
      const ni = state.nav.i + 1
      return {
        ...state,
        activeFileId: state.nav.ids[ni],
        nav: { ...state.nav, i: ni },
      }
    }
    case 'CLOSE_TAB': {
      const { id } = action
      const openTabs = state.openTabs.filter((t) => t !== id)
      let activeFileId = state.activeFileId
      if (activeFileId === id) {
        const idx = state.openTabs.indexOf(id)
        activeFileId =
          openTabs[idx - 1] ?? openTabs[idx] ?? openTabs[0] ?? null
      }
      return { ...state, openTabs, activeFileId }
    }
    case 'TOGGLE_FOLDER':
      return {
        ...state,
        vault: toggleFolder(state.vault, action.folderId),
      }
    case 'SET_CONTENT':
      return {
        ...state,
        vault: setFileContent(state.vault, action.fileId, action.content),
      }
    case 'RENAME_NOTE':
      return {
        ...state,
        vault: renameFileInTree(state.vault, action.fileId, action.name),
      }
    case 'RENAME_FOLDER':
      return {
        ...state,
        vault: renameFolderInTree(state.vault, action.folderId, action.name),
      }
    case 'COLLAPSE_ALL':
      return { ...state, vault: collapseAll(state.vault) }
    case 'TOGGLE_SORT':
      return { ...state, sortAZ: !state.sortAZ }
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.value }
    case 'TOGGLE_PIN': {
      const { id } = action
      const next = { ...state.pinnedIds }
      if (next[id]) delete next[id]
      else next[id] = true
      return { ...state, pinnedIds: next }
    }
    default:
      return state
  }
}

function FileTreeRow({
  node,
  vault,
  pinnedIds,
  activeFileId,
  dispatch,
  onRequestDelete,
  depth,
  alwaysShowPath,
  vaultLoading,
  onRequestNoteTitleEdit,
}) {
  const pathSegs = findBreadcrumb(vault, node.id)
  const pinned = Boolean(pinnedIds[node.id])
  const usePath = Boolean(
    alwaysShowPath || (pinned && pathSegs?.length),
  )
  return (
    <div style={{ paddingLeft: depth * 0.65 + 'rem' }}>
      <div
        className={`tree-row-wrap ${activeFileId === node.id ? 'is-active' : ''}`}
      >
        <button
          type="button"
          className="tree-row tree-row-main"
          draggable={false}
          title="Click to open · Double-click to rename"
          onClick={() => dispatch({ type: 'OPEN_FILE', id: node.id })}
          onDoubleClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (vaultLoading) return
            onRequestNoteTitleEdit(node.id, node.name)
          }}
        >
          <span className="tree-chevron spacer" aria-hidden>
            <i className="bi bi-chevron-right" />
          </span>
          <TreePathLabel
            segments={usePath ? pathSegs : null}
            fallbackName={node.name}
          />
        </button>
        <div className="tree-row-actions">
          <button
            type="button"
            className={`tree-row-action-btn ${pinned ? 'is-active' : ''}`}
            title={pinned ? 'Unpin' : 'Pin path'}
            aria-label={pinned ? 'Unpin file' : 'Pin file path'}
            draggable={false}
            onClick={(e) => {
              e.stopPropagation()
              dispatch({ type: 'TOGGLE_PIN', id: node.id })
            }}
          >
            <i
              className={pinned ? 'bi bi-pin-fill' : 'bi bi-pin-angle'}
              aria-hidden
            />
          </button>
          <button
            type="button"
            className="tree-row-action-btn tree-row-action-danger"
            title="Delete file"
            aria-label={`Delete file ${node.name}`}
            draggable={false}
            onClick={(e) => {
              e.stopPropagation()
              onRequestDelete({
                kind: 'file',
                id: node.id,
                name: node.name,
              })
            }}
          >
            <i className="bi bi-trash3" aria-hidden />
          </button>
        </div>
        {node.meta ? <span className="tree-meta">{node.meta}</span> : null}
      </div>
    </div>
  )
}

function TreeRows({
  nodes,
  depth,
  activeFileId,
  dispatch,
  expandedOverrides,
  vault,
  pinnedIds,
  onRequestDelete,
  focusedFolderId,
  onFolderRowFocus,
  folderRenameId,
  folderRenameDraft,
  onFolderRenameDraftChange,
  onStartFolderRename,
  onCommitFolderRename,
  onCancelFolderRename,
  folderRenameInputRef,
  vaultLoading,
  onRequestNoteTitleEdit,
}) {
  const rows = []
  for (const node of nodes) {
    if (node.type === 'folder') {
      const expanded = expandedOverrides ? true : node.expanded
      const folderSegs = findFolderBreadcrumb(vault, node.id)
      const pinned = Boolean(pinnedIds[node.id])
      const usePath = Boolean(pinned && folderSegs?.length)
      const isRenaming = folderRenameId === node.id
      rows.push(
        <div key={node.id} style={{ paddingLeft: depth * 0.65 + 'rem' }}>
          <div
            className={`tree-row-wrap ${focusedFolderId === node.id ? 'is-folder-focused' : ''}`}
          >
            <button
              type="button"
              className="tree-row tree-row-chevron-btn"
              draggable={false}
              title={expanded ? 'Collapse folder' : 'Expand folder'}
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} folder ${node.name}`}
              onClick={(e) => {
                e.stopPropagation()
                onFolderRowFocus(node.id)
                dispatch({ type: 'TOGGLE_FOLDER', folderId: node.id })
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || vaultLoading || isRenaming) return
                e.preventDefault()
                onStartFolderRename(node.id, node.name)
              }}
            >
              <span className="tree-chevron" aria-hidden>
                <i
                  className={`bi bi-chevron-${expanded ? 'down' : 'right'}`}
                />
              </span>
            </button>
            {isRenaming ? (
              <input
                ref={folderRenameInputRef}
                type="text"
                className="tree-folder-rename-input"
                draggable={false}
                value={folderRenameDraft}
                onChange={(e) => onFolderRenameDraftChange(e.target.value)}
                onBlur={() => void onCommitFolderRename()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void onCommitFolderRename()
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    onCancelFolderRename()
                  }
                }}
                aria-label="Folder name"
                maxLength={255}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <button
                type="button"
                className="tree-row tree-row-main tree-row-folder-label"
                draggable={false}
                title="Double-click or press Enter to rename"
                onClick={() => onFolderRowFocus(node.id)}
                onDoubleClick={(e) => {
                  e.preventDefault()
                  if (!vaultLoading) onStartFolderRename(node.id, node.name)
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || vaultLoading) return
                  e.preventDefault()
                  onStartFolderRename(node.id, node.name)
                }}
              >
                <TreePathLabel
                  segments={usePath ? folderSegs : null}
                  fallbackName={node.name}
                />
              </button>
            )}
            <div className="tree-row-actions">
              <button
                type="button"
                className={`tree-row-action-btn ${pinned ? 'is-active' : ''}`}
                title={pinned ? 'Unpin' : 'Pin path'}
                aria-label={pinned ? 'Unpin folder' : 'Pin folder path'}
                draggable={false}
                onClick={(e) => {
                  e.stopPropagation()
                  dispatch({ type: 'TOGGLE_PIN', id: node.id })
                }}
              >
                <i
                  className={pinned ? 'bi bi-pin-fill' : 'bi bi-pin-angle'}
                  aria-hidden
                />
              </button>
              <button
                type="button"
                className="tree-row-action-btn tree-row-action-danger"
                title="Delete folder"
                aria-label={`Delete folder ${node.name}`}
                draggable={false}
                onClick={(e) => {
                  e.stopPropagation()
                  onRequestDelete({
                    kind: 'folder',
                    id: node.id,
                    name: node.name,
                  })
                }}
              >
                <i className="bi bi-trash3" aria-hidden />
              </button>
            </div>
          </div>
          {expanded && (
            <TreeRows
              nodes={node.children}
              depth={depth + 1}
              activeFileId={activeFileId}
              dispatch={dispatch}
              expandedOverrides={expandedOverrides}
              vault={vault}
              pinnedIds={pinnedIds}
              onRequestDelete={onRequestDelete}
              focusedFolderId={focusedFolderId}
              onFolderRowFocus={onFolderRowFocus}
              folderRenameId={folderRenameId}
              folderRenameDraft={folderRenameDraft}
              onFolderRenameDraftChange={onFolderRenameDraftChange}
              onStartFolderRename={onStartFolderRename}
              onCommitFolderRename={onCommitFolderRename}
              onCancelFolderRename={onCancelFolderRename}
              folderRenameInputRef={folderRenameInputRef}
              vaultLoading={vaultLoading}
              onRequestNoteTitleEdit={onRequestNoteTitleEdit}
            />
          )}
        </div>,
      )
    } else {
      rows.push(
        <FileTreeRow
          key={node.id}
          node={node}
          vault={vault}
          pinnedIds={pinnedIds}
          activeFileId={activeFileId}
          dispatch={dispatch}
          onRequestDelete={onRequestDelete}
          depth={depth}
          alwaysShowPath={false}
          vaultLoading={vaultLoading}
          onRequestNoteTitleEdit={onRequestNoteTitleEdit}
        />,
      )
    }
  }
  return rows
}

function SidebarAccountMenu({
  menuWrapRef,
  railPopover,
  footerMenuOpen,
  setFooterMenuOpen,
  setSettingsModalOpen,
  onLogout,
}) {
  return (
    <div className="sidebar-footer-menu-wrap" ref={menuWrapRef}>
      <button
        type="button"
        className="sidebar-footer-gear"
        aria-expanded={footerMenuOpen}
        aria-haspopup="menu"
        aria-controls="sidebar-footer-settings-menu"
        aria-label="Account menu"
        onClick={() => setFooterMenuOpen((v) => !v)}
      >
        <i className="bi bi-gear" aria-hidden />
      </button>
      {footerMenuOpen ? (
        <div
          id="sidebar-footer-settings-menu"
          className={`sidebar-footer-popover${railPopover ? ' sidebar-footer-popover--rail' : ''}`}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="sidebar-footer-popover-item"
            onClick={() => {
              setFooterMenuOpen(false)
              setSettingsModalOpen(true)
            }}
          >
            Settings
          </button>
          <button
            type="button"
            role="menuitem"
            className="sidebar-footer-popover-item"
            onClick={() => {
              setFooterMenuOpen(false)
              onLogout()
            }}
          >
            Sign out
          </button>
          <div className="sidebar-footer-popover-sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="sidebar-footer-popover-item"
            onClick={() => {
              setFooterMenuOpen(false)
              window.open(apiUrl('/admin/'), '_blank', 'noopener,noreferrer')
            }}
          >
            Manage vaults
          </button>
        </div>
      ) : null}
    </div>
  )
}

function App({ onLogout = () => {}, username = '' }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleteModalDontAskAgain, setDeleteModalDontAskAgain] = useState(false)
  const [pinnedSectionOpen, setPinnedSectionOpen] = useState(true)
  const [vaultLoading, setVaultLoading] = useState(true)
  const [vaultError, setVaultError] = useState(null)
  const [quickOpenOpen, setQuickOpenOpen] = useState(false)
  const [quickOpenQuery, setQuickOpenQuery] = useState('')
  const [quickOpenIndex, setQuickOpenIndex] = useState(0)
  const quickOpenInputRef = useRef(null)
  const [titleEditing, setTitleEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const titleInputRef = useRef(null)
  const titleBlurIgnoredUntilRef = useRef(0)
  const prevTitleResetFileIdRef = useRef(null)
  const pendingNoteTitleEditRef = useRef(null)
  const [focusedFolderId, setFocusedFolderId] = useState(null)
  const [folderRenameId, setFolderRenameId] = useState(null)
  const [folderRenameDraft, setFolderRenameDraft] = useState('')
  const folderRenameInputRef = useRef(null)
  const vaultRef = useRef([])
  vaultRef.current = state.vault
  const lastSavedBodyRef = useRef({})
  const prevActiveFileIdRef = useRef(null)
  const editorSplitRef = useRef(null)
  const splitDragRef = useRef({ active: false, lastPct: 50 })
  const [editorSplitLeftPct, setEditorSplitLeftPct] = useState(
    readStoredEditorSplitPct,
  )
  const [editorSplitDragging, setEditorSplitDragging] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)
  const [footerMenuOpen, setFooterMenuOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const sidebarFooterRef = useRef(null)
  const collapsedAccountMenuRef = useRef(null)
  const modLabel = useMemo(() => modKeyLabel(), [])

  const toggleSidebarCollapsed = useCallback((collapsed) => {
    setSidebarCollapsed(collapsed)
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore. */
    }
  }, [])

  const onEditorSplitPointerDown = useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    splitDragRef.current = {
      active: true,
      lastPct: editorSplitLeftPct,
    }
    setEditorSplitDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev) => {
      if (!splitDragRef.current.active || !editorSplitRef.current) return
      const rect = editorSplitRef.current.getBoundingClientRect()
      const x = ev.clientX - rect.left
      let pct = (x / rect.width) * 100
      pct = Math.min(EDITOR_SPLIT_MAX, Math.max(EDITOR_SPLIT_MIN, pct))
      splitDragRef.current.lastPct = pct
      setEditorSplitLeftPct(pct)
    }

    const onUp = () => {
      if (!splitDragRef.current.active) return
      splitDragRef.current.active = false
      setEditorSplitDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      try {
        localStorage.setItem(
          EDITOR_SPLIT_STORAGE_KEY,
          String(splitDragRef.current.lastPct),
        )
      } catch {
        /* ignore. */
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [editorSplitLeftPct])

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

  function openDeleteModal(target) {
    setDeleteModalDontAskAgain(false)
    setDeleteModal(target)
  }

  function closeDeleteModal() {
    setDeleteModalDontAskAgain(false)
    setDeleteModal(null)
  }

  useEffect(() => {
    if (!deleteModal) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape') closeDeleteModal()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [deleteModal])

  useEffect(() => {
    if (!footerMenuOpen) return undefined
    function onPointerDown(e) {
      if (sidebarFooterRef.current?.contains(e.target)) return
      if (collapsedAccountMenuRef.current?.contains(e.target)) return
      setFooterMenuOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setFooterMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [footerMenuOpen])

  useEffect(() => {
    if (!settingsModalOpen) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape') setSettingsModalOpen(false)
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [settingsModalOpen])

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
        setTitleDraft(name)
        setTitleEditing(true)
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

  const flatVaultFiles = useMemo(
    () => flattenVaultFiles(state.vault),
    [state.vault],
  )

  const quickOpenMatches = useMemo(() => {
    const q = quickOpenQuery.trim().toLowerCase()
    if (!q) return flatVaultFiles
    return flatVaultFiles.filter((row) =>
      row.pathLabel.toLowerCase().includes(q),
    )
  }, [flatVaultFiles, quickOpenQuery])

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
    setQuickOpenIndex((i) =>
      quickOpenMatches.length === 0
        ? 0
        : Math.min(i, quickOpenMatches.length - 1),
    )
  }, [quickOpenMatches])

  useEffect(() => {
    if (!quickOpenOpen) return undefined
    setQuickOpenQuery('')
    setQuickOpenIndex(0)
    const raf = window.requestAnimationFrame(() => {
      quickOpenInputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(raf)
  }, [quickOpenOpen])

  useEffect(() => {
    function onKeyDown(e) {
      if (deleteModal) return

      if (quickOpenOpen) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setQuickOpenOpen(false)
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setQuickOpenIndex((i) =>
            Math.min(i + 1, Math.max(0, quickOpenMatches.length - 1)),
          )
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setQuickOpenIndex((i) => Math.max(i - 1, 0))
          return
        }
        if (e.key === 'Enter' && quickOpenMatches.length > 0) {
          e.preventDefault()
          const row = quickOpenMatches[quickOpenIndex]
          if (row) {
            dispatch({ type: 'OPEN_FILE', id: row.id })
            setQuickOpenOpen(false)
          }
          return
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
          e.preventDefault()
          setQuickOpenOpen(false)
          return
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'w') {
          e.preventDefault()
          setQuickOpenOpen(false)
          return
        }
      }

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
  }, [
    deleteModal,
    quickOpenOpen,
    quickOpenMatches,
    quickOpenIndex,
    handleNewNote,
    closeEditorTab,
  ])

  const activeFile = state.activeFileId
    ? findFile(state.vault, state.activeFileId)
    : null

  useEffect(() => {
    if (prevTitleResetFileIdRef.current === state.activeFileId) return
    prevTitleResetFileIdRef.current = state.activeFileId
    const pending = pendingNoteTitleEditRef.current
    pendingNoteTitleEditRef.current = null
    if (pending && state.activeFileId && pending.fileId === state.activeFileId) {
      setTitleDraft(pending.name)
      setTitleEditing(true)
      return
    }
    setTitleEditing(false)
    setTitleDraft('')
  }, [state.activeFileId])

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
    const pk = notePkFromClientId(activeFile.id)
    if (pk == null) {
      setTitleEditing(false)
      return
    }
    try {
      setVaultError(null)
      await patchNoteName(pk, trimmed)
      dispatch({ type: 'RENAME_NOTE', fileId: activeFile.id, name: trimmed })
      setTitleEditing(false)
    } catch (e) {
      setVaultError(e instanceof Error ? e.message : 'Could not rename note.')
      setTitleDraft(activeFile.name)
      setTitleEditing(false)
    }
  }, [activeFile, titleDraft, dispatch])

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

  const breadcrumb = useMemo(() => {
    if (!state.activeFileId) return null
    return findBreadcrumb(state.vault, state.activeFileId)
  }, [state.vault, state.activeFileId])

  const canBack = state.nav.i > 0
  const canForward = state.nav.i < state.nav.ids.length - 1

  return (
    <div className="app-obsidian">
      <div className="app-body">
        <aside
          className={`sidebar${sidebarCollapsed ? ' sidebar--collapsed' : ''}`}
          aria-label="Vault explorer"
          aria-hidden={sidebarCollapsed}
        >
          {!sidebarCollapsed ? (
            <>
          <div className="sidebar-toolbar sidebar-toolbar--top">
            <div className="sidebar-toolbar-cluster">
              <button
                type="button"
                className="btn-icon"
                title="Files"
                aria-label="Files"
              >
                <i className="bi bi-folder2" aria-hidden />
              </button>
              <button
                type="button"
                className="btn-icon"
                title="Search"
                aria-label="Search"
              >
                <i className="bi bi-search" aria-hidden />
              </button>
              <button
                type="button"
                className="btn-icon"
                title="Bookmarks"
                aria-label="Bookmarks"
              >
                <i className="bi bi-star" aria-hidden />
              </button>
            </div>
            <button
              type="button"
              className="btn-icon sidebar-collapse-btn"
              title="Collapse sidebar"
              aria-label="Collapse vault sidebar"
              onClick={() => toggleSidebarCollapsed(true)}
            >
              <i className="bi bi-layout-sidebar-inset" aria-hidden />
            </button>
          </div>
          <div className="sidebar-toolbar">
            <button
              type="button"
              className="btn-icon"
              title="New note"
              aria-label="New note"
              disabled={vaultLoading}
              onClick={() => void handleNewNote()}
            >
              <i className="bi bi-file-earmark-plus" aria-hidden />
            </button>
            <button
              type="button"
              className="btn-icon"
              title="New folder"
              aria-label="New folder"
              disabled={vaultLoading}
              onClick={() => void handleNewFolder()}
            >
              <i className="bi bi-folder-plus" aria-hidden />
            </button>
            <button
              type="button"
              className="btn-icon"
              title={state.sortAZ ? 'Unsort' : 'Sort A–Z'}
              aria-label="Toggle sort order"
              onClick={() => dispatch({ type: 'TOGGLE_SORT' })}
            >
              <i className="bi bi-sort-down-alt" aria-hidden />
            </button>
            <button
              type="button"
              className="btn-icon"
              title="Collapse all"
              aria-label="Collapse all folders"
              disabled={vaultLoading}
              onClick={() => dispatch({ type: 'COLLAPSE_ALL' })}
            >
              <i className="bi bi-arrows-collapse" aria-hidden />
            </button>
          </div>
          {vaultError ? (
            <div
              className="px-2 pb-2 small text-danger text-break"
              role="alert"
            >
              {vaultError}
            </div>
          ) : null}
          <div className="sidebar-search">
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder="Filter…"
              value={state.searchQuery}
              onChange={(e) =>
                dispatch({ type: 'SET_SEARCH', value: e.target.value })
              }
              aria-label="Filter files"
            />
          </div>
          <div className="sidebar-tree">
            {vaultLoading ? (
              <div className="p-3 text-muted small">Loading vault…</div>
            ) : null}
            {!vaultLoading && pinnedFileNodes.length > 0 ? (
              <div className="sidebar-pinned-block">
                <div className="sidebar-pinned-header-row">
                  <div className="tree-row-wrap sidebar-pinned-folder-wrap">
                    <button
                      type="button"
                      className="tree-row tree-row-main sidebar-pinned-folder"
                      onClick={() => setPinnedSectionOpen((o) => !o)}
                      aria-expanded={pinnedSectionOpen}
                    >
                      <span className="tree-chevron" aria-hidden>
                        <i
                          className={`bi bi-chevron-${pinnedSectionOpen ? 'down' : 'right'}`}
                        />
                      </span>
                      <span className="tree-label text-truncate">
                        Pinned files
                      </span>
                    </button>
                  </div>
                </div>
                {pinnedSectionOpen
                  ? pinnedFileNodes.map((node) => (
                      <FileTreeRow
                        key={node.id}
                        node={node}
                        vault={state.vault}
                        pinnedIds={state.pinnedIds}
                        activeFileId={state.activeFileId}
                        dispatch={dispatch}
                        onRequestDelete={handleDeleteRequest}
                        depth={1}
                        alwaysShowPath
                        vaultLoading={vaultLoading}
                        onRequestNoteTitleEdit={requestNoteTitleEdit}
                      />
                    ))
                  : null}
              </div>
            ) : null}
            {!vaultLoading ? (
              <TreeRows
                nodes={mainTreeNodes}
                depth={0}
                activeFileId={state.activeFileId}
                dispatch={dispatch}
                expandedOverrides={Boolean(state.searchQuery.trim())}
                vault={state.vault}
                pinnedIds={state.pinnedIds}
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
                vaultLoading={vaultLoading}
                onRequestNoteTitleEdit={requestNoteTitleEdit}
              />
            ) : null}
          </div>
          <div className="sidebar-footer" ref={sidebarFooterRef}>
            <div className="sidebar-footer-user text-truncate" title={username}>
              {username}
            </div>
            <SidebarAccountMenu
              footerMenuOpen={footerMenuOpen}
              setFooterMenuOpen={setFooterMenuOpen}
              setSettingsModalOpen={setSettingsModalOpen}
              onLogout={onLogout}
            />
          </div>
            </>
          ) : null}
        </aside>

        {sidebarCollapsed ? (
          <div className="sidebar-expand-rail">
            <button
              type="button"
              className="sidebar-expand-rail-btn"
              title="Show sidebar"
              aria-label="Show vault sidebar"
              onClick={() => toggleSidebarCollapsed(false)}
            >
              <i className="bi bi-layout-sidebar-inset-reverse" aria-hidden />
            </button>
            <div className="sidebar-expand-rail-account">
              <SidebarAccountMenu
                menuWrapRef={collapsedAccountMenuRef}
                railPopover
                footerMenuOpen={footerMenuOpen}
                setFooterMenuOpen={setFooterMenuOpen}
                setSettingsModalOpen={setSettingsModalOpen}
                onLogout={onLogout}
              />
            </div>
          </div>
        ) : null}

        <section className="editor-pane" aria-label="Editor">
          <div className="tab-bar" role="tablist">
            {state.openTabs.map((id) => {
              const f = findFile(state.vault, id)
              const label = f?.name ?? id
              const isActive = id === state.activeFileId
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
              onClick={() => void handleNewNote()}
            >
              +
            </button>
          </div>

          <div className="sub-bar">
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
            <div className="breadcrumb-obs" aria-live="polite">
              {breadcrumb && breadcrumb.length > 0 ? (
                breadcrumb.map((part, i) => (
                  <span key={`${part}-${i}`}>
                    {i > 0 ? <span className="sep">/</span> : null}
                    {part}
                  </span>
                ))
              ) : (
                <span className="text-muted">No file open</span>
              )}
            </div>
          </div>

          {activeFile ? (
            <div className="editor-main">
              {titleEditing ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  className="note-title-input"
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
                  className="note-title note-title--clickable"
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
              )}
              <div
                ref={editorSplitRef}
                className="editor-split"
                style={{
                  gridTemplateColumns: `minmax(0, ${editorSplitLeftPct}fr) 10px minmax(0, ${100 - editorSplitLeftPct}fr)`,
                }}
              >
                <div className="editor-split-pane editor-split-source">
                  <textarea
                    className="md-editor md-editor--split"
                    spellCheck={false}
                    value={activeFile.content}
                    onChange={(e) =>
                      dispatch({
                        type: 'SET_CONTENT',
                        fileId: activeFile.id,
                        content: e.target.value,
                      })
                    }
                    placeholder="Write Markdown here (raw)…"
                    aria-label="Raw Markdown source"
                  />
                </div>
                <div
                  className={`editor-split-resizer ${editorSplitDragging ? 'is-dragging' : ''}`}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Drag to resize source and preview"
                  aria-valuenow={Math.round(editorSplitLeftPct)}
                  aria-valuemin={EDITOR_SPLIT_MIN}
                  aria-valuemax={EDITOR_SPLIT_MAX}
                  tabIndex={0}
                  onMouseDown={onEditorSplitPointerDown}
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                    e.preventDefault()
                    const step = e.key === 'ArrowLeft' ? -3 : 3
                    setEditorSplitLeftPct((p) => {
                      const n = Math.min(
                        EDITOR_SPLIT_MAX,
                        Math.max(EDITOR_SPLIT_MIN, p + step),
                      )
                      try {
                        localStorage.setItem(EDITOR_SPLIT_STORAGE_KEY, String(n))
                      } catch {
                        /* ignore. */
                      }
                      return n
                    })
                  }}
                >
                  <span className="editor-split-resizer-grip" aria-hidden />
                </div>
                <div
                  className="editor-split-pane editor-split-preview"
                  aria-label="Markdown preview"
                >
                  <div className="md-preview">
                    {activeFile.content.trim() ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {activeFile.content}
                      </ReactMarkdown>
                    ) : (
                      <p className="md-preview-empty text-muted mb-0">
                        Preview appears here as you type.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="editor-empty" role="region" aria-label="No file open">
              <div className="editor-empty-inner">
                <button
                  type="button"
                  className="editor-empty-line"
                  disabled={vaultLoading}
                  onClick={() => void handleNewNote()}
                >
                  Create new note{' '}
                  <span className="editor-empty-shortcut">
                    ({modLabel} N)
                  </span>
                </button>
                <button
                  type="button"
                  className="editor-empty-line"
                  disabled={vaultLoading}
                  onClick={() => setQuickOpenOpen(true)}
                >
                  Go to file{' '}
                  <span className="editor-empty-shortcut">
                    ({modLabel} O)
                  </span>
                </button>
                <button
                  type="button"
                  className="editor-empty-line"
                  disabled={!canCloseEditorTab}
                  onClick={() => closeEditorTab()}
                >
                  Close{' '}
                  <span className="editor-empty-shortcut">
                    ({modLabel} W)
                  </span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {quickOpenOpen ? (
        <>
          <div
            className="quick-open-backdrop"
            role="presentation"
            onClick={() => setQuickOpenOpen(false)}
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
                ref={quickOpenInputRef}
                type="search"
                className="form-control form-control-sm quick-open-input"
                placeholder="Filter by name or path…"
                value={quickOpenQuery}
                onChange={(e) => {
                  setQuickOpenQuery(e.target.value)
                  setQuickOpenIndex(0)
                }}
                aria-label="Filter files"
              />
              <ul className="quick-open-list" role="listbox">
                {quickOpenMatches.length === 0 ? (
                  <li className="quick-open-empty text-muted small px-2 py-3">
                    No matching notes.
                  </li>
                ) : (
                  quickOpenMatches.map((row, i) => (
                    <li key={row.id} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === quickOpenIndex}
                        className={`quick-open-row ${i === quickOpenIndex ? 'is-active' : ''}`}
                        onClick={() => {
                          dispatch({ type: 'OPEN_FILE', id: row.id })
                          setQuickOpenOpen(false)
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
      ) : null}

      {settingsModalOpen ? (
        <>
          <div
            className="modal fade show d-block obs-delete-modal"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
          >
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content obs-delete-modal-content text-dark">
                <div className="modal-header obs-delete-modal-header">
                  <h5 className="modal-title" id="settings-modal-title">
                    Settings
                  </h5>
                  <button
                    type="button"
                    className="btn-close obs-delete-modal-close"
                    aria-label="Close"
                    onClick={() => setSettingsModalOpen(false)}
                  />
                </div>
                <div className="modal-body obs-delete-modal-body">
                  <p className="obs-delete-modal-lead m-0">
                    Signed in as <strong>{username}</strong>.
                  </p>
                </div>
                <div className="modal-footer obs-delete-modal-footer justify-content-end">
                  <button
                    type="button"
                    className="btn obs-delete-modal-btn-cancel"
                    onClick={() => setSettingsModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div
            className="modal-backdrop fade show obs-delete-modal-backdrop"
            role="presentation"
            onClick={() => setSettingsModalOpen(false)}
          />
        </>
      ) : null}

      {deleteModal ? (
        <>
          <div
            className="modal fade show d-block obs-delete-modal"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content obs-delete-modal-content text-dark">
                <div className="modal-header obs-delete-modal-header">
                  <h5 className="modal-title" id="delete-modal-title">
                    {deleteModal.kind === 'folder'
                      ? 'Delete folder'
                      : 'Delete file'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close obs-delete-modal-close"
                    aria-label="Close"
                    onClick={closeDeleteModal}
                  />
                </div>
                <div className="modal-body obs-delete-modal-body">
                  <p className="obs-delete-modal-lead">
                    {deleteModal.kind === 'folder'
                      ? `Are you sure you want to delete the folder “${deleteModal.name}” and everything inside?`
                      : `Are you sure you want to delete “${deleteModal.name}”?`}
                  </p>
                  <p className="obs-delete-modal-sub">
                    This removes it from the server and disk. This cannot be
                    undone.
                  </p>
                </div>
                <div className="modal-footer obs-delete-modal-footer">
                  <div className="form-check obs-delete-modal-check m-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="delete-modal-dont-ask"
                      checked={deleteModalDontAskAgain}
                      onChange={(e) =>
                        setDeleteModalDontAskAgain(e.target.checked)
                      }
                    />
                    <label
                      className="form-check-label"
                      htmlFor="delete-modal-dont-ask"
                    >
                      Don&apos;t ask again
                    </label>
                  </div>
                  <div className="obs-delete-modal-actions d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-danger obs-delete-modal-btn-danger"
                      onClick={confirmDelete}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="btn obs-delete-modal-btn-cancel"
                      onClick={closeDeleteModal}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            className="modal-backdrop fade show obs-delete-modal-backdrop"
            role="presentation"
            onClick={closeDeleteModal}
          />
        </>
      ) : null}
    </div>
  )
}

export default App
