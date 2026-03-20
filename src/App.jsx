import { useEffect, useMemo, useReducer, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

const SKIP_DELETE_CONFIRM_KEY = 'notes_skip_delete_confirm'

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const initialVault = [
  {
    id: 'folder-jange',
    type: 'folder',
    name: 'jange esfand',
    expanded: true,
    children: [
      {
        id: 'file-movies',
        type: 'file',
        name: 'movies',
        meta: null,
        content: '# Movies\n\n- [ ] Pick a film\n- [ ] Watch\n',
      },
      {
        id: 'file-image',
        type: 'file',
        name: 'image',
        meta: 'PNG',
        content: '',
      },
    ],
  },
  {
    id: 'folder-lpic',
    type: 'folder',
    name: 'LPIC TASKs',
    expanded: true,
    children: [
      {
        id: 'file-base',
        type: 'file',
        name: 'BASE',
        meta: 'BASE',
        content: '```bash\necho hello\n```\n',
      },
    ],
  },
]

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

function collectFileIdsUnderNodes(list) {
  let ids = []
  for (const n of list) {
    if (n.type === 'file') ids.push(n.id)
    else ids = ids.concat(collectFileIdsUnderNodes(n.children))
  }
  return ids
}

function findFolderById(nodes, folderId) {
  for (const n of nodes) {
    if (n.type === 'folder' && n.id === folderId) return n
    if (n.type === 'folder') {
      const f = findFolderById(n.children, folderId)
      if (f) return f
    }
  }
  return null
}

function removeNodeById(nodes, targetId) {
  return nodes
    .filter((n) => n.id !== targetId)
    .map((n) =>
      n.type === 'folder'
        ? { ...n, children: removeNodeById(n.children, targetId) }
        : n,
    )
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

function collapseAll(nodes) {
  return nodes.map((n) => {
    if (n.type === 'folder') {
      return { ...n, expanded: false, children: collapseAll(n.children) }
    }
    return n
  })
}

function addNodeToRoot(nodes, node) {
  return [node, ...nodes]
}

const initialState = {
  vault: initialVault,
  openTabs: ['file-movies'],
  activeFileId: 'file-movies',
  nav: { ids: ['file-movies'], i: 0 },
  searchQuery: '',
  sortAZ: false,
  pinnedIds: {},
}

function reducer(state, action) {
  switch (action.type) {
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
    case 'COLLAPSE_ALL':
      return { ...state, vault: collapseAll(state.vault) }
    case 'TOGGLE_SORT':
      return { ...state, sortAZ: !state.sortAZ }
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.value }
    case 'NEW_NOTE': {
      const nid = createId()
      const file = {
        id: nid,
        type: 'file',
        name: 'Untitled',
        meta: null,
        content: '',
      }
      const vault = addNodeToRoot(state.vault, file)
      const openTabs = state.openTabs.includes(nid)
        ? state.openTabs
        : [...state.openTabs, nid]
      const base = state.nav.ids.slice(0, state.nav.i + 1)
      const nav = { ids: [...base, nid], i: base.length }
      return {
        ...state,
        vault,
        openTabs,
        activeFileId: nid,
        nav,
      }
    }
    case 'NEW_FOLDER': {
      const fid = createId()
      const folder = {
        id: fid,
        type: 'folder',
        name: 'New folder',
        expanded: true,
        children: [],
      }
      return { ...state, vault: addNodeToRoot(state.vault, folder) }
    }
    case 'TOGGLE_PIN': {
      const { id } = action
      const next = { ...state.pinnedIds }
      if (next[id]) delete next[id]
      else next[id] = true
      return { ...state, pinnedIds: next }
    }
    case 'DELETE_FILE': {
      const { id } = action
      const vault = removeNodeById(state.vault, id)
      const openTabs = state.openTabs.filter((t) => t !== id)
      let activeFileId = state.activeFileId
      if (activeFileId === id) {
        const idx = state.openTabs.indexOf(id)
        activeFileId =
          openTabs[idx - 1] ?? openTabs[idx] ?? openTabs[0] ?? null
      }
      const pinnedIds = { ...state.pinnedIds }
      delete pinnedIds[id]
      const navIds = state.nav.ids.filter((x) => x !== id)
      let navI = state.nav.i
      if (!navIds.length) {
        return {
          ...state,
          vault,
          openTabs,
          activeFileId,
          pinnedIds,
          nav: { ids: [], i: 0 },
        }
      }
      if (navI >= navIds.length) navI = navIds.length - 1
      return {
        ...state,
        vault,
        openTabs,
        activeFileId,
        pinnedIds,
        nav: { ids: navIds, i: navI },
      }
    }
    case 'DELETE_FOLDER': {
      const { id } = action
      const folder = findFolderById(state.vault, id)
      const removedFileIds = folder
        ? collectFileIdsUnderNodes(folder.children)
        : []
      const vault = removeNodeById(state.vault, id)
      const removeSet = new Set([id, ...removedFileIds])
      const openTabs = state.openTabs.filter((t) => !removeSet.has(t))
      let activeFileId = state.activeFileId
      if (activeFileId && removeSet.has(activeFileId)) {
        const idx = state.openTabs.indexOf(activeFileId)
        activeFileId =
          openTabs[idx - 1] ?? openTabs[idx] ?? openTabs[0] ?? null
      }
      const pinnedIds = { ...state.pinnedIds }
      for (const pid of removeSet) delete pinnedIds[pid]
      const navIds = state.nav.ids.filter((x) => !removeSet.has(x))
      let navI = state.nav.i
      if (!navIds.length) {
        return {
          ...state,
          vault,
          openTabs,
          activeFileId,
          pinnedIds,
          nav: { ids: [], i: 0 },
        }
      }
      if (navI >= navIds.length) navI = navIds.length - 1
      return {
        ...state,
        vault,
        openTabs,
        activeFileId,
        pinnedIds,
        nav: { ids: navIds, i: navI },
      }
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
          onClick={() => dispatch({ type: 'OPEN_FILE', id: node.id })}
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
}) {
  const rows = []
  for (const node of nodes) {
    if (node.type === 'folder') {
      const expanded = expandedOverrides ? true : node.expanded
      const folderSegs = findFolderBreadcrumb(vault, node.id)
      const pinned = Boolean(pinnedIds[node.id])
      const usePath = Boolean(pinned && folderSegs?.length)
      rows.push(
        <div key={node.id} style={{ paddingLeft: depth * 0.65 + 'rem' }}>
          <div className="tree-row-wrap">
            <button
              type="button"
              className="tree-row tree-row-main"
              onClick={() =>
                dispatch({ type: 'TOGGLE_FOLDER', folderId: node.id })
              }
            >
              <span className="tree-chevron" aria-hidden>
                <i
                  className={`bi bi-chevron-${expanded ? 'down' : 'right'}`}
                />
              </span>
              <TreePathLabel
                segments={usePath ? folderSegs : null}
                fallbackName={node.name}
              />
            </button>
            <div className="tree-row-actions">
              <button
                type="button"
                className={`tree-row-action-btn ${pinned ? 'is-active' : ''}`}
                title={pinned ? 'Unpin' : 'Pin path'}
                aria-label={pinned ? 'Unpin folder' : 'Pin folder path'}
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
        />,
      )
    }
  }
  return rows
}

function App({ onLogout = () => {}, username = '' }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleteModalDontAskAgain, setDeleteModalDontAskAgain] = useState(false)
  const [pinnedSectionOpen, setPinnedSectionOpen] = useState(true)

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

  function confirmDelete() {
    if (!deleteModal) return
    if (deleteModalDontAskAgain) {
      try {
        localStorage.setItem(SKIP_DELETE_CONFIRM_KEY, '1')
      } catch {
        /* ignore quota / private mode. */
      }
    }
    if (deleteModal.kind === 'folder') {
      dispatch({ type: 'DELETE_FOLDER', id: deleteModal.id })
    } else {
      dispatch({ type: 'DELETE_FILE', id: deleteModal.id })
    }
    closeDeleteModal()
  }

  function handleDeleteRequest(target) {
    try {
      if (localStorage.getItem(SKIP_DELETE_CONFIRM_KEY) === '1') {
        if (target.kind === 'folder') {
          dispatch({ type: 'DELETE_FOLDER', id: target.id })
        } else {
          dispatch({ type: 'DELETE_FILE', id: target.id })
        }
        return
      }
    } catch {
      /* fall through to modal. */
    }
    openDeleteModal(target)
  }

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

  const activeFile = state.activeFileId
    ? findFile(state.vault, state.activeFileId)
    : null

  const breadcrumb = useMemo(() => {
    if (!state.activeFileId) return null
    return findBreadcrumb(state.vault, state.activeFileId)
  }, [state.vault, state.activeFileId])

  const canBack = state.nav.i > 0
  const canForward = state.nav.i < state.nav.ids.length - 1

  return (
    <div className="app-obsidian">
      <div className="app-body">
        <aside className="sidebar" aria-label="Vault explorer">
          <div className="sidebar-toolbar">
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
          <div className="sidebar-toolbar">
            <button
              type="button"
              className="btn-icon"
              title="New note"
              aria-label="New note"
              onClick={() => dispatch({ type: 'NEW_NOTE' })}
            >
              <i className="bi bi-file-earmark-plus" aria-hidden />
            </button>
            <button
              type="button"
              className="btn-icon"
              title="New folder"
              aria-label="New folder"
              onClick={() => dispatch({ type: 'NEW_FOLDER' })}
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
              onClick={() => dispatch({ type: 'COLLAPSE_ALL' })}
            >
              <i className="bi bi-arrows-collapse" aria-hidden />
            </button>
          </div>
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
            {pinnedFileNodes.length > 0 ? (
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
                      />
                    ))
                  : null}
              </div>
            ) : null}
            <TreeRows
              nodes={mainTreeNodes}
              depth={0}
              activeFileId={state.activeFileId}
              dispatch={dispatch}
              expandedOverrides={Boolean(state.searchQuery.trim())}
              vault={state.vault}
              pinnedIds={state.pinnedIds}
              onRequestDelete={handleDeleteRequest}
            />
          </div>
          <div className="sidebar-footer">
            <div className="sidebar-footer-user text-truncate" title={username}>
              {username}
            </div>
            <button
              type="button"
              className="sidebar-footer-logout"
              onClick={onLogout}
            >
              Sign out
            </button>
          </div>
        </aside>

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
              onClick={() => dispatch({ type: 'NEW_NOTE' })}
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
              <h1 className="note-title">{activeFile.name}</h1>
              <div className="editor-split">
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
            <div className="editor-empty">
              Open a note from the sidebar or create one with +.
            </div>
          )}
        </section>
      </div>

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
                    It will be moved to your system trash.
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
