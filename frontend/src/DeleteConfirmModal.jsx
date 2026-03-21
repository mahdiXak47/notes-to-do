import { useEffect } from 'react'
import './components/modals/VaultModal.css'

export function DeleteConfirmModal({
  target,
  dontAskAgain,
  onDontAskAgainChange,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!target) return undefined
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
  }, [target, onClose])

  if (!target) return null

  return (
    <>
      <div
        className="modal fade show d-block obs-delete-modal"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content obs-delete-modal-content text-dark">
            <div className="modal-header obs-delete-modal-header">
              <h5 className="modal-title" id="delete-modal-title">
                {target.kind === 'folder' ? 'Delete folder' : 'Delete file'}
              </h5>
              <button
                type="button"
                className="btn-close obs-delete-modal-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body obs-delete-modal-body">
              <p className="obs-delete-modal-lead">
                {target.kind === 'folder'
                  ? `Are you sure you want to delete the folder “${target.name}” and everything inside?`
                  : `Are you sure you want to delete “${target.name}”?`}
              </p>
              <p className="obs-delete-modal-sub">
                This removes it from the server and disk. This cannot be undone.
              </p>
            </div>
            <div className="modal-footer obs-delete-modal-footer">
              <div className="form-check obs-delete-modal-check m-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="delete-modal-dont-ask"
                  checked={dontAskAgain}
                  onChange={(e) => onDontAskAgainChange(e.target.checked)}
                />
                <label
                  className="form-check-label"
                  htmlFor="delete-modal-dont-ask"
                >
                  Don&apos;t ask again
                </label>
              </div>
              <div className="obs-delete-modal-actions d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-danger obs-delete-modal-btn-danger"
                  onClick={() => void onConfirm()}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="btn obs-delete-modal-btn-cancel"
                  onClick={onClose}
                >
                  Cancel
                </button>
              </div>
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
