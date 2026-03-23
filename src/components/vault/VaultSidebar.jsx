import { useCallback, useEffect, useRef, useState } from 'react'
import { apiUrl } from '../../lib/auth.js'
import { VaultContextMenu } from './VaultContextMenu.jsx'
import './VaultSidebar.css'
import {
  findBreadcrumb,
  findFolderBreadcrumb,
  pathJoined,
  splitDirAndFileName,
} from '../../lib/vaultTreePaths.js'

const SIDEBAR_COLLAPSED_KEY = 'notes_sidebar_collapsed'

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function TreePathLabel({ segments, fallbackName }) {
  const { dir, name } = splitDirAndFileName(segments, fallbackName)
  const title = dir ? `${dir}/${name}` : name
  return (
    <span
      className="tree-label text-truncate tree-path-label"
      title={title}
      dir="auto"
    >
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

function PinnedFolderPathLabel({ vault, folderId, name }) {
  const segs = findFolderBreadcrumb(vault, folderId)
  if (!segs?.length || segs.length === 1) {
    return (
      <span className="tree-label text-truncate" dir="auto">
        {name}
      </span>
    )
  }
  const full = `/${pathJoined(segs)}`
  return (
    <span
      className="tree-label text-truncate tree-path-label"
      title={full}
      dir="auto"
    >
      {full}
    </span>
  )
}

function PinnedFolderBlock({
  node,
  vault,
  pinnedIds,
  dispatch,
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
  onOpenFileContextMenu,
  onOpenFolderContextMenu,
  activeFileId,
  expandedOverrides,
}) {
  const expanded = expandedOverrides ? true : node.expanded
  const pinned = Boolean(pinnedIds[node.id])
  const isRenaming = folderRenameId === node.id
  return (
    <div
      className="tree-folder-block"
      style={{ paddingLeft: `${1 * 0.65}rem` }}
    >
      <div
        className={`tree-row-wrap ${focusedFolderId === node.id ? 'is-folder-focused' : ''}`}
        onContextMenu={(e) => {
          if (vaultLoading || isRenaming) return
          e.preventDefault()
          onOpenFolderContextMenu(e, node)
        }}
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
            <PinnedFolderPathLabel
              vault={vault}
              folderId={node.id}
              name={node.name}
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
                folderNonEmpty: Boolean(
                  node.children && node.children.length > 0,
                ),
              })
            }}
          >
            <i className="bi bi-trash3" aria-hidden />
          </button>
        </div>
      </div>
      {expanded && node.children && node.children.length > 0 ? (
        <div className="tree-folder-children">
          <TreeRows
            nodes={node.children}
            depth={2}
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
            onOpenFileContextMenu={onOpenFileContextMenu}
            onOpenFolderContextMenu={onOpenFolderContextMenu}
          />
        </div>
      ) : null}
    </div>
  )
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
  onOpenFileContextMenu,
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
        onContextMenu={(e) => {
          if (vaultLoading) return
          e.preventDefault()
          onOpenFileContextMenu(e, node)
        }}
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
  onOpenFileContextMenu,
  onOpenFolderContextMenu,
}) {
  const rows = []
  for (const node of nodes) {
    if (node.type === 'folder') {
      const expanded = expandedOverrides ? true : node.expanded
      const pinned = Boolean(pinnedIds[node.id])
      const isRenaming = folderRenameId === node.id
      rows.push(
        <div
          key={node.id}
          className="tree-folder-block"
          style={{ paddingLeft: `${depth * 0.65}rem` }}
        >
          <div
            className={`tree-row-wrap ${focusedFolderId === node.id ? 'is-folder-focused' : ''}`}
            onContextMenu={(e) => {
              if (vaultLoading || isRenaming) return
              e.preventDefault()
              onOpenFolderContextMenu(e, node)
            }}
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
                {pinned ? (
                  <PinnedFolderPathLabel
                    vault={vault}
                    folderId={node.id}
                    name={node.name}
                  />
                ) : (
                  <TreePathLabel
                    segments={null}
                    fallbackName={node.name}
                  />
                )}
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
                    folderNonEmpty: Boolean(
                      node.children && node.children.length > 0,
                    ),
                  })
                }}
              >
                <i className="bi bi-trash3" aria-hidden />
              </button>
            </div>
          </div>
          {expanded && node.children && node.children.length > 0 ? (
            <div className="tree-folder-children">
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
                onOpenFileContextMenu={onOpenFileContextMenu}
                onOpenFolderContextMenu={onOpenFolderContextMenu}
              />
            </div>
          ) : null}
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
          onOpenFileContextMenu={onOpenFileContextMenu}
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

export function VaultSidebar({
  vault,
  vaultLoading,
  vaultError,
  searchQuery,
  sortAZ,
  pinnedIds,
  activeFileId,
  dispatch,
  pinnedFolderNodes,
  pinnedFileNodes,
  mainTreeNodes,
  pinnedSectionOpen,
  setPinnedSectionOpen,
  onNewNote,
  onNewFolder,
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
  onRequestNoteTitleEdit,
  username,
  onLogout,
  setSettingsModalOpen,
  onVaultContextAction,
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)
  const [footerMenuOpen, setFooterMenuOpen] = useState(false)
  const [ctxMenu, setCtxMenu] = useState(null)
  const sidebarFooterRef = useRef(null)
  const collapsedAccountMenuRef = useRef(null)

  const openFileContextMenu = useCallback((e, node) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'file', node })
  }, [])

  const openFolderContextMenu = useCallback((e, node) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'folder', node })
  }, [])

  const toggleSidebarCollapsed = useCallback((collapsed) => {
    setSidebarCollapsed(collapsed)
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore. */
    }
  }, [])

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

  return (
    <>
      <VaultContextMenu
        open={Boolean(ctxMenu)}
        x={ctxMenu?.x ?? 0}
        y={ctxMenu?.y ?? 0}
        variant={ctxMenu?.kind === 'folder' ? 'folder' : 'file'}
        isPinned={Boolean(ctxMenu?.node?.id && pinnedIds[ctxMenu.node.id])}
        disabled={vaultLoading}
        onClose={() => setCtxMenu(null)}
        onAction={(actionId) => {
          if (!ctxMenu) return
          const { kind, node } = ctxMenu
          setCtxMenu(null)
          onVaultContextAction(actionId, kind, node)
        }}
      />
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
                onClick={() => void onNewNote()}
              >
                <i className="bi bi-file-earmark-plus" aria-hidden />
              </button>
              <button
                type="button"
                className="btn-icon"
                title="New folder"
                aria-label="New folder"
                disabled={vaultLoading}
                onClick={() => void onNewFolder()}
              >
                <i className="bi bi-folder-plus" aria-hidden />
              </button>
              <button
                type="button"
                className="btn-icon"
                title={sortAZ ? 'Unsort' : 'Sort A–Z'}
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
                placeholder="search note…"
                value={searchQuery}
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
              {!vaultLoading &&
              (pinnedFolderNodes.length > 0 || pinnedFileNodes.length > 0) ? (
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
                          Pinned
                        </span>
                      </button>
                    </div>
                  </div>
                  {pinnedSectionOpen ? (
                    <div className="tree-folder-children">
                      {pinnedFolderNodes.map((node) => (
                        <PinnedFolderBlock
                          key={node.id}
                          node={node}
                          vault={vault}
                          pinnedIds={pinnedIds}
                          dispatch={dispatch}
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
                          onOpenFileContextMenu={openFileContextMenu}
                          onOpenFolderContextMenu={openFolderContextMenu}
                          activeFileId={activeFileId}
                          expandedOverrides={Boolean(searchQuery.trim())}
                        />
                      ))}
                      {pinnedFileNodes.map((node) => (
                        <FileTreeRow
                          key={node.id}
                          node={node}
                          vault={vault}
                          pinnedIds={pinnedIds}
                          activeFileId={activeFileId}
                          dispatch={dispatch}
                          onRequestDelete={onRequestDelete}
                          depth={1}
                          alwaysShowPath
                          vaultLoading={vaultLoading}
                          onRequestNoteTitleEdit={onRequestNoteTitleEdit}
                          onOpenFileContextMenu={openFileContextMenu}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {!vaultLoading ? (
                <TreeRows
                  nodes={mainTreeNodes}
                  depth={0}
                  activeFileId={activeFileId}
                  dispatch={dispatch}
                  expandedOverrides={Boolean(searchQuery.trim())}
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
                  onOpenFileContextMenu={openFileContextMenu}
                  onOpenFolderContextMenu={openFolderContextMenu}
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
    </>
  )
}
