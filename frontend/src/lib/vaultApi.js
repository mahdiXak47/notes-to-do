import { authorizedFetch } from './auth.js'
import {
  findParentFolderUidForFile,
  findParentFolderUidForFolder,
} from './vaultTreePaths.js'

function pickUniqueName(base, used) {
  const set = new Set(used.map((s) => s.toLowerCase()))
  if (!set.has(base.toLowerCase())) return base
  let i = 2
  while (set.has(`${base} (${i})`.toLowerCase())) i += 1
  return `${base} (${i})`
}

function collectSiblingNamesAtRoot(nodes) {
  const folders = []
  const notes = []
  for (const n of nodes) {
    if (n.type === 'folder') folders.push(n.name)
    else notes.push(n.name)
  }
  return { folders, notes }
}

export function normalizeTreeFromApi(apiNodes, expandedByFolderId) {
  return apiNodes.map((n) => {
    if (n.type === 'folder') {
      const uid = `f-${n.id}`
      return {
        id: uid,
        type: 'folder',
        name: n.name,
        expanded: expandedByFolderId[uid] ?? true,
        children: normalizeTreeFromApi(n.children || [], expandedByFolderId),
      }
    }
    return {
      id: `n-${n.id}`,
      type: 'file',
      name: n.name,
      meta: n.meta ?? null,
      content: n.content ?? '',
    }
  })
}

export function collectExpandedByFolderId(nodes, acc = {}) {
  for (const n of nodes) {
    if (n.type === 'folder') {
      acc[n.id] = n.expanded
      collectExpandedByFolderId(n.children, acc)
    }
  }
  return acc
}

/** Fetch all pins and return them as a pinnedIds map: { 'f-5': true, 'n-3': true } */
export async function fetchPins() {
  const res = await authorizedFetch('/api/vault/pins/', { method: 'GET' })
  if (!res.ok) throw new Error(`Failed to load pins (${res.status}).`)
  const data = await res.json()
  const pinnedIds = {}
  for (const { item_type, item_id } of data) {
    const clientId = item_type === 'folder' ? `f-${item_id}` : `n-${item_id}`
    pinnedIds[clientId] = true
  }
  return pinnedIds
}

export async function addPin(itemType, itemId) {
  const res = await authorizedFetch('/api/vault/pins/', {
    method: 'POST',
    body: JSON.stringify({ item_type: itemType, item_id: itemId }),
  })
  if (!res.ok) throw new Error(`Failed to pin item (${res.status}).`)
}

export async function removePin(itemType, itemId) {
  const res = await authorizedFetch(`/api/vault/pins/${itemType}/${itemId}/`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 404) throw new Error(`Failed to unpin item (${res.status}).`)
}

export async function fetchVaultTree() {
  const res = await authorizedFetch('/api/vault/tree/', { method: 'GET' })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(err || `Failed to load vault (${res.status}).`)
  }
  return res.json()
}

export async function createFolder(parentId, name, rootNodes) {
  const { folders } = collectSiblingNamesAtRoot(
    parentId == null ? rootNodes : findFolderByUid(rootNodes, parentId)?.children ?? [],
  )
  const finalName = pickUniqueName(name, folders)
  const res = await authorizedFetch('/api/vault/folders/', {
    method: 'POST',
    body: JSON.stringify({
      parent: parentId == null ? null : pkFromFolderUid(parentId),
      name: finalName,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(JSON.stringify(data) || 'Failed to create folder.')
  }
  return res.json()
}

export async function createNote(folderUid, name, rootNodes) {
  const siblings =
    folderUid == null
      ? collectSiblingNamesAtRoot(rootNodes).notes
      : collectSiblingNamesInFolder(rootNodes, folderUid).notes
  const finalName = pickUniqueName(name, siblings)
  const res = await authorizedFetch('/api/vault/notes/', {
    method: 'POST',
    body: JSON.stringify({
      folder: folderUid == null ? null : pkFromFolderUid(folderUid),
      name: finalName,
      body: '',
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(JSON.stringify(data) || 'Failed to create note.')
  }
  return res.json()
}

function pkFromFolderUid(uid) {
  return Number(String(uid).replace(/^f-/, ''), 10)
}

function findFolderByUid(nodes, folderUid) {
  for (const n of nodes) {
    if (n.type === 'folder') {
      if (n.id === folderUid) return n
      const inner = findFolderByUid(n.children, folderUid)
      if (inner) return inner
    }
  }
  return null
}

function collectSiblingNamesInFolder(nodes, folderUid) {
  const folder = findFolderByUid(nodes, folderUid)
  if (!folder) return { folders: [], notes: [] }
  return collectSiblingNamesAtRoot(folder.children || [])
}

export async function patchNote(notePk, payload) {
  const res = await authorizedFetch(`/api/vault/notes/${notePk}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const nameErr = data.name?.[0]
    const msg =
      typeof nameErr === 'string'
        ? nameErr
        : typeof data.detail === 'string'
          ? data.detail
          : JSON.stringify(data) || `Failed to update note (${res.status}).`
    throw new Error(msg)
  }
  return res.json()
}

export async function patchNoteBody(notePk, body) {
  return patchNote(notePk, { body })
}

export async function patchNoteName(notePk, name) {
  return patchNote(notePk, { name })
}

export async function moveNoteToFolder(notePk, folderPkOrNull) {
  return patchNote(notePk, { folder: folderPkOrNull })
}

export async function moveFolderToParent(folderPk, parentFolderPkOrNull) {
  return patchFolder(folderPk, { parent: parentFolderPkOrNull })
}

export async function patchFolder(folderPk, payload) {
  const res = await authorizedFetch(`/api/vault/folders/${folderPk}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const nameErr = data.name?.[0]
    const msg =
      typeof nameErr === 'string'
        ? nameErr
        : typeof data.detail === 'string'
          ? data.detail
          : JSON.stringify(data) || `Failed to update folder (${res.status}).`
    throw new Error(msg)
  }
  return res.json()
}

export async function patchFolderName(folderPk, name) {
  return patchFolder(folderPk, { name })
}

export async function deleteFolder(folderPk) {
  const res = await authorizedFetch(`/api/vault/folders/${folderPk}/`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    throw new Error(`Failed to delete folder (${res.status}).`)
  }
}

export async function deleteNote(notePk) {
  const res = await authorizedFetch(`/api/vault/notes/${notePk}/`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    throw new Error(`Failed to delete note (${res.status}).`)
  }
}

export function notePkFromClientId(clientId) {
  if (!clientId || !String(clientId).startsWith('n-')) return null
  const n = Number(String(clientId).slice(2), 10)
  return Number.isFinite(n) ? n : null
}

export function folderPkFromClientId(clientId) {
  if (!clientId || !String(clientId).startsWith('f-')) return null
  const n = Number(String(clientId).slice(2), 10)
  return Number.isFinite(n) ? n : null
}

function collectAllVaultIds(nodes, acc = new Set()) {
  for (const n of nodes) {
    acc.add(n.id)
    if (n.type === 'folder') collectAllVaultIds(n.children, acc)
  }
  return acc
}

export async function duplicateNoteAsCopy(noteNode, rootNodes) {
  const parentUid = findParentFolderUidForFile(rootNodes, noteNode.id)
  if (parentUid === undefined) {
    throw new Error('Note not found.')
  }
  const created = await createNote(
    parentUid,
    `${noteNode.name} (copy)`,
    rootNodes,
  )
  await patchNoteBody(created.id, noteNode.content ?? '')
  return created
}

export async function duplicateFolderSubtree(
  folderNode,
  parentFolderUid,
  getRootNodes,
  onAfterStep,
) {
  const created = await createFolder(
    parentFolderUid,
    `${folderNode.name} (copy)`,
    getRootNodes(),
  )
  await onAfterStep()
  const newUid = `f-${created.id}`
  for (const child of folderNode.children || []) {
    if (child.type === 'folder') {
      await duplicateFolderSubtree(child, newUid, getRootNodes, onAfterStep)
    } else {
      const createdNote = await createNote(
        newUid,
        `${child.name} (copy)`,
        getRootNodes(),
      )
      await patchNoteBody(createdNote.id, child.content ?? '')
      await onAfterStep()
    }
  }
}

export async function duplicateFolderRoot(folderNode, getRootNodes, onAfterStep) {
  const parentUid = findParentFolderUidForFolder(getRootNodes(), folderNode.id)
  if (parentUid === undefined) {
    throw new Error('Folder not found.')
  }
  await duplicateFolderSubtree(
    folderNode,
    parentUid,
    getRootNodes,
    onAfterStep,
  )
}

export function folderHasFiles(folderNode) {
  for (const child of folderNode.children || []) {
    if (child.type === 'file') return true
    if (child.type === 'folder' && folderHasFiles(child)) return true
  }
  return false
}

function safeName(name) {
  return String(name || 'untitled').replace(/[/\\?%*:|"<>]/g, '-')
}

function addFolderToZip(zip, folderNode, path) {
  for (const child of folderNode.children || []) {
    if (child.type === 'folder') {
      addFolderToZip(zip, child, `${path}${safeName(child.name)}/`)
    } else {
      zip.file(`${path}${safeName(child.name)}.md`, child.content ?? '')
    }
  }
}

export async function downloadFolderAsZip(folderNode) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const rootName = safeName(folderNode.name)
  addFolderToZip(zip, folderNode, `${rootName}/`)
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${rootName}.zip`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function downloadNoteAsMarkdownFile(name, content) {
  const safe = String(name || 'note').replace(/[/\\?%*:|"<>]/g, '-')
  const blob = new Blob([content ?? ''], {
    type: 'text/markdown;charset=utf-8',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${safe || 'note'}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function pruneStateForVaultTree(prevState, newVault) {
  const ids = collectAllVaultIds(newVault)
  const openTabs = prevState.openTabs.filter((id) => ids.has(id))
  let activeFileId = prevState.activeFileId
  if (activeFileId && !ids.has(activeFileId)) {
    const idx = prevState.openTabs.indexOf(activeFileId)
    activeFileId =
      openTabs[idx - 1] ?? openTabs[idx] ?? openTabs[0] ?? null
  }
  const navIds = prevState.nav.ids.filter((id) => ids.has(id))
  let navI = prevState.nav.i
  const uploadedFileIds = (prevState.uploadedFileIds ?? []).filter((id) =>
    ids.has(id),
  )
  if (!navIds.length) {
    return {
      openTabs,
      activeFileId,
      pinnedIds: Object.fromEntries(
        Object.entries(prevState.pinnedIds).filter(([k]) => ids.has(k)),
      ),
      uploadedFileIds,
      nav: { ids: [], i: 0 },
    }
  }
  if (navI >= navIds.length) navI = navIds.length - 1
  return {
    openTabs,
    activeFileId,
    pinnedIds: Object.fromEntries(
      Object.entries(prevState.pinnedIds).filter(([k]) => ids.has(k)),
    ),
    uploadedFileIds,
    nav: { ids: navIds, i: navI },
  }
}
