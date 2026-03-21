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
