import { useEffect, useRef } from 'react'
import { notePkFromClientId, patchNoteBody } from '../vaultApi.js'
import { findFile } from '../vaultTreePaths.js'

export function useNoteAutosave({
  activeFileId,
  activeFileContent,
  vault,
  vaultRef,
  setVaultError,
}) {
  const lastSavedBodyRef = useRef({})
  const prevActiveFileIdRef = useRef(null)

  useEffect(() => {
    if (activeFileId === prevActiveFileIdRef.current) return
    prevActiveFileIdRef.current = activeFileId
    const fid = activeFileId
    if (!fid || !String(fid).startsWith('n-')) return
    const f = findFile(vaultRef.current, fid)
    if (f) lastSavedBodyRef.current[fid] = f.content
  }, [activeFileId, vault, vaultRef])

  useEffect(() => {
    const fileId = activeFileId
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
  }, [activeFileId, activeFileContent, vaultRef, setVaultError])
}
