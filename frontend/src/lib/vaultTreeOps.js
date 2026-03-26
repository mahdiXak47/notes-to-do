import {
  findBreadcrumb,
  findFile,
  findFolderBreadcrumb,
  pathJoined,
} from './vaultTreePaths.js'

export function sortTree(nodes, enabled) {
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

export function filterTree(nodes, query) {
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

export function collectPinnedFileNodes(vault, pinnedIds) {
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

export function collectPinnedFolderNodes(vault, pinnedIds) {
  const out = []
  function walk(list) {
    for (const n of list) {
      if (n.type === 'folder') {
        if (pinnedIds[n.id]) out.push(n)
        walk(n.children)
      }
    }
  }
  walk(vault)
  out.sort((a, b) => {
    const pa = pathJoined(findFolderBreadcrumb(vault, a.id) || [])
    const pb = pathJoined(findFolderBreadcrumb(vault, b.id) || [])
    return pa.localeCompare(pb, undefined, { sensitivity: 'base' })
  })
  return out
}

export function stripPinnedFilesFromNodes(nodes, pinnedIds) {
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

export function stripUploadedFilesFromNodes(nodes, uploadedFileIds) {
  if (!uploadedFileIds?.length) return nodes
  const set = new Set(uploadedFileIds)
  const out = []
  for (const n of nodes) {
    if (n.type === 'file') {
      if (!set.has(n.id)) out.push(n)
    } else {
      out.push({
        ...n,
        children: stripUploadedFilesFromNodes(n.children, uploadedFileIds),
      })
    }
  }
  return out
}

/**
 * @param {unknown[]} vault
 * @param {string[]} uploadedFileIds Newest-first ids from upload registry.
 * @returns {unknown[]}
 */
export function collectUploadedFileNodes(vault, uploadedFileIds) {
  const out = []
  for (const id of uploadedFileIds) {
    const f = findFile(vault, id)
    if (f?.type === 'file') out.push(f)
  }
  return out
}

export function toggleFolder(nodes, folderId) {
  return nodes.map((n) => {
    if (n.type === 'folder') {
      if (n.id === folderId) return { ...n, expanded: !n.expanded }
      return { ...n, children: toggleFolder(n.children, folderId) }
    }
    return n
  })
}

export function setFileContent(nodes, fileId, content) {
  return nodes.map((n) => {
    if (n.type === 'folder') {
      return { ...n, children: setFileContent(n.children, fileId, content) }
    }
    if (n.id === fileId) return { ...n, content }
    return n
  })
}

export function renameFileInTree(nodes, fileId, name) {
  return nodes.map((n) => {
    if (n.type === 'folder') {
      return { ...n, children: renameFileInTree(n.children, fileId, name) }
    }
    if (n.id === fileId) return { ...n, name }
    return n
  })
}

export function findFolderNode(nodes, folderId) {
  for (const n of nodes) {
    if (n.type === 'folder') {
      if (n.id === folderId) return n
      const inner = findFolderNode(n.children, folderId)
      if (inner) return inner
    }
  }
  return null
}

export function renameFolderInTree(nodes, folderId, name) {
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

export function collapseAll(nodes) {
  return nodes.map((n) => {
    if (n.type === 'folder') {
      return { ...n, expanded: false, children: collapseAll(n.children) }
    }
    return n
  })
}

export function collectDescendantFolderIdsIncludingSelf(folderNode) {
  const ids = new Set()
  function walk(n) {
    ids.add(n.id)
    for (const c of n.children || []) {
      if (c.type === 'folder') walk(c)
    }
  }
  walk(folderNode)
  return ids
}
