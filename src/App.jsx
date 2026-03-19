import { useMemo, useReducer } from 'react'
import './App.css'

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
    default:
      return state
  }
}

function TreeRows({ nodes, depth, activeFileId, dispatch, expandedOverrides }) {
  const rows = []
  for (const node of nodes) {
    if (node.type === 'folder') {
      const expanded = expandedOverrides ? true : node.expanded
      rows.push(
        <div key={node.id} style={{ paddingLeft: depth * 0.65 + 'rem' }}>
          <button
            type="button"
            className="tree-row"
            onClick={() =>
              dispatch({ type: 'TOGGLE_FOLDER', folderId: node.id })
            }
          >
            <span className="tree-chevron" aria-hidden>
              <i
                className={`bi bi-chevron-${expanded ? 'down' : 'right'}`}
              />
            </span>
            <span className="tree-label">{node.name}</span>
          </button>
          {expanded && (
            <TreeRows
              nodes={node.children}
              depth={depth + 1}
              activeFileId={activeFileId}
              dispatch={dispatch}
              expandedOverrides={expandedOverrides}
            />
          )}
        </div>,
      )
    } else {
      rows.push(
        <div key={node.id} style={{ paddingLeft: depth * 0.65 + 'rem' }}>
          <button
            type="button"
            className={`tree-row ${activeFileId === node.id ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'OPEN_FILE', id: node.id })}
          >
            <span className="tree-chevron spacer" aria-hidden>
              <i className="bi bi-chevron-right" />
            </span>
            <span className="tree-label">{node.name}</span>
            {node.meta ? (
              <span className="tree-meta">{node.meta}</span>
            ) : null}
          </button>
        </div>,
      )
    }
  }
  return rows
}

function App() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const displayTree = useMemo(() => {
    const sorted = sortTree(state.vault, state.sortAZ)
    return filterTree(sorted, state.searchQuery)
  }, [state.vault, state.sortAZ, state.searchQuery])

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
            <TreeRows
              nodes={displayTree}
              depth={0}
              activeFileId={state.activeFileId}
              dispatch={dispatch}
              expandedOverrides={Boolean(state.searchQuery.trim())}
            />
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
              <textarea
                className="md-editor"
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
                aria-label="Raw Markdown"
              />
            </div>
          ) : (
            <div className="editor-empty">
              Open a note from the sidebar or create one with +.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default App
