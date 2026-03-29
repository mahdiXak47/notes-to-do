import { pruneStateForVaultTree } from './vaultApi.js'
import {
  collapseAll,
  renameFileInTree,
  renameFolderInTree,
  setFileContent,
  toggleFolder,
} from './vaultTreeOps.js'

export const initialVaultState = {
  vault: [],
  openTabs: [],
  activeFileId: null,
  nav: { ids: [], i: 0 },
  searchQuery: '',
  sortOrder: 'none', // 'none' | 'az' | 'newest'
  pinnedIds: {},
  /** Newest-first note client ids (`n-…`) shown under Uploaded. */
  uploadedFileIds: [],
}

export function vaultReducer(state, action) {
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
    case 'SET_SORT_ORDER':
      return { ...state, sortOrder: action.order }
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.value }
    case 'SET_PINNED_IDS':
      return { ...state, pinnedIds: action.pinnedIds }
    case 'TOGGLE_PIN': {
      const { id } = action
      const next = { ...state.pinnedIds }
      if (next[id]) delete next[id]
      else next[id] = true
      return { ...state, pinnedIds: next }
    }
    case 'SET_UPLOADED_FILE_IDS': {
      const ids = Array.isArray(action.ids)
        ? action.ids.filter((x) => typeof x === 'string')
        : []
      const seen = new Set()
      const deduped = []
      for (const id of ids) {
        if (seen.has(id)) continue
        seen.add(id)
        deduped.push(id)
      }
      return { ...state, uploadedFileIds: deduped }
    }
    case 'REGISTER_UPLOADED_FILE': {
      const { id } = action
      if (typeof id !== 'string' || state.uploadedFileIds.includes(id)) {
        return state
      }
      return { ...state, uploadedFileIds: [id, ...state.uploadedFileIds] }
    }
    default:
      return state
  }
}
