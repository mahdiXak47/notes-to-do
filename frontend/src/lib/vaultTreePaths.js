export function pathJoined(segments) {
  if (!segments?.length) return ''
  return segments.join('/')
}

export function findFile(nodes, fileId) {
  for (const n of nodes) {
    if (n.type === 'file' && n.id === fileId) return n
    if (n.type === 'folder') {
      const f = findFile(n.children, fileId)
      if (f) return f
    }
  }
  return null
}

export function findBreadcrumb(nodes, fileId, acc = []) {
  for (const n of nodes) {
    if (n.type === 'file' && n.id === fileId) return [...acc, n.name]
    if (n.type === 'folder') {
      const p = findBreadcrumb(n.children, fileId, [...acc, n.name])
      if (p) return p
    }
  }
  return null
}

export function findFolderBreadcrumb(nodes, folderId, acc = []) {
  for (const n of nodes) {
    if (n.type === 'folder' && n.id === folderId) return [...acc, n.name]
    if (n.type === 'folder') {
      const p = findFolderBreadcrumb(n.children, folderId, [...acc, n.name])
      if (p) return p
    }
  }
  return null
}

export function splitDirAndFileName(segments, fallbackName) {
  if (!segments?.length) return { dir: '', name: fallbackName }
  if (segments.length === 1) return { dir: '', name: segments[0] }
  return {
    dir: segments.slice(0, -1).join('/'),
    name: segments[segments.length - 1],
  }
}

export function findParentFolderUidForFile(nodes, fileId) {
  for (const n of nodes) {
    if (n.type === 'file' && n.id === fileId) return null
  }
  for (const n of nodes) {
    if (n.type === 'folder') {
      const r = findParentFolderUidUnderFolder(n, fileId)
      if (r !== undefined) return r
    }
  }
  return undefined
}

function findParentFolderUidUnderFolder(folder, fileId) {
  for (const c of folder.children || []) {
    if (c.type === 'file' && c.id === fileId) return folder.id
    if (c.type === 'folder') {
      const r = findParentFolderUidUnderFolder(c, fileId)
      if (r !== undefined) return r
    }
  }
  return undefined
}

export function findParentFolderUidForFolder(nodes, folderId) {
  for (const n of nodes) {
    if (n.type === 'folder' && n.id === folderId) return null
  }
  for (const n of nodes) {
    if (n.type === 'folder') {
      const r = findParentUidForFolderUnder(n, folderId)
      if (r !== undefined) return r
    }
  }
  return undefined
}

function findParentUidForFolderUnder(parentFolder, targetFolderId) {
  for (const c of parentFolder.children || []) {
    if (c.type === 'folder' && c.id === targetFolderId) return parentFolder.id
    if (c.type === 'folder') {
      const r = findParentUidForFolderUnder(c, targetFolderId)
      if (r !== undefined) return r
    }
  }
  return undefined
}

export function listFolderMoveTargets(vault, excludeFolderIds) {
  const exclude = excludeFolderIds ?? new Set()
  const out = [{ folderUid: null, label: 'Vault root' }]
  function walk(nodes, prefix) {
    for (const n of nodes) {
      if (n.type !== 'folder') continue
      if (exclude.has(n.id)) continue
      const label = prefix ? `${prefix} / ${n.name}` : n.name
      out.push({ folderUid: n.id, label })
      walk(n.children || [], label)
    }
  }
  walk(vault, '')
  return out
}
