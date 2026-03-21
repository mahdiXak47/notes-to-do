import { useEffect } from 'react'

export function useVaultKeyboardShortcuts({
  deleteModal,
  quickOpenOpen,
  setQuickOpenOpen,
  handleNewNote,
  closeEditorTab,
}) {
  useEffect(() => {
    function onKeyDown(e) {
      if (deleteModal) return

      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === 'n') {
        e.preventDefault()
        if (quickOpenOpen) setQuickOpenOpen(false)
        void handleNewNote()
        return
      }
      if (k === 'o') {
        e.preventDefault()
        setQuickOpenOpen((open) => !open)
        return
      }
      if (k === 'w') {
        e.preventDefault()
        if (quickOpenOpen) {
          setQuickOpenOpen(false)
          return
        }
        closeEditorTab()
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    deleteModal,
    quickOpenOpen,
    handleNewNote,
    closeEditorTab,
    setQuickOpenOpen,
  ])
}
