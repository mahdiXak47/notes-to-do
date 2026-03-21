import { useEffect } from 'react'
import './MoveTargetModal.css'

export function MoveTargetModal({
  open,
  title,
  targets,
  currentFolderUid,
  onPick,
  onClose,
}) {
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
        className="modal fade show d-block obs-move-modal"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-target-title"
      >
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content obs-move-modal-content text-dark">
            <div className="modal-header obs-move-modal-header">
              <h5 className="modal-title" id="move-target-title">
                {title}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body obs-move-modal-body">
              {targets.map((t) => {
                const isCurrent =
                  (t.folderUid == null && currentFolderUid == null) ||
                  t.folderUid === currentFolderUid
                return (
                  <button
                    key={t.folderUid ?? '__root__'}
                    type="button"
                    className={`obs-move-target-btn${isCurrent ? ' is-current' : ''}`}
                    onClick={() => void onPick(t.folderUid)}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            <div className="modal-footer obs-move-modal-footer border-0">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className="modal-backdrop fade show obs-move-modal-backdrop"
        role="presentation"
        onClick={onClose}
      />
    </>
  )
}
