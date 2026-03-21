import { useCallback, useEffect, useRef, useState } from 'react'
import { folderPkFromClientId, patchFolderName } from '../lib/vaultApi.js'
import { findFolderNode } from '../lib/vaultTreeOps.js'

export function useFolderRename({
  vaultRef,
  vaultLoading,
  dispatch,
  activeFileId,
  setVaultError,
}) {
  const [focusedFolderId, setFocusedFolderId] = useState(null)
  const [folderRenameId, setFolderRenameId] = useState(null)
  const [folderRenameDraft, setFolderRenameDraft] = useState('')
  const folderRenameInputRef = useRef(null)

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
  }, [folderRenameId, folderRenameDraft, dispatch, cancelFolderRename, vaultRef, setVaultError])

  const onStartFolderRename = useCallback(
    (folderId, name) => {
      if (vaultLoading) return
      setFolderRenameId(folderId)
      setFolderRenameDraft(name)
    },
    [vaultLoading],
  )

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
    if (!activeFileId) return
    setFocusedFolderId(null)
    setFolderRenameId(null)
    setFolderRenameDraft('')
  }, [activeFileId])

  return {
    focusedFolderId,
    onFolderRowFocus,
    folderRenameId,
    folderRenameDraft,
    setFolderRenameDraft,
    folderRenameInputRef,
    onStartFolderRename,
    commitFolderRename,
    cancelFolderRename,
  }
}
