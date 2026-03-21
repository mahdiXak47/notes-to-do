import { useEffect } from 'react'
import './VaultModal.css'

export function SettingsModal({ open, username, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div
        className="modal fade show d-block obs-delete-modal"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content obs-delete-modal-content text-dark">
            <div className="modal-header obs-delete-modal-header">
              <h5 className="modal-title" id="settings-modal-title">
                Settings
              </h5>
              <button
                type="button"
                className="btn-close obs-delete-modal-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body obs-delete-modal-body">
              <p className="obs-delete-modal-lead m-0">
                Signed in as <strong>{username}</strong>.
              </p>
            </div>
            <div className="modal-footer obs-delete-modal-footer justify-content-end">
              <button
                type="button"
                className="btn obs-delete-modal-btn-cancel"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className="modal-backdrop fade show obs-delete-modal-backdrop"
        role="presentation"
        onClick={onClose}
      />
    </>
  )
}
