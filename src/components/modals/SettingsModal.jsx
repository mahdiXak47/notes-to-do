import { useEffect, useState } from 'react'
import './VaultModal.css'
import './SettingsModal.css'

const NAV_ITEMS = [{ id: 'general', label: 'General' }]

export function SettingsModal({
  open,
  username,
  onClose,
  skipFileDeleteConfirm,
  onSkipFileDeleteConfirmChange,
  skipFolderDeleteConfirm,
  onSkipFolderDeleteConfirmChange,
}) {
  const [activeSection, setActiveSection] = useState('general')

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
        className="modal fade show d-block settings-modal"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className="modal-dialog settings-modal-dialog" role="document">
          <div className="modal-content settings-modal-content">
            <div className="settings-layout">
              {/* Left nav */}
              <aside className="settings-nav">
                <div className="settings-nav-title">Options</div>
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`settings-nav-item${activeSection === item.id ? ' settings-nav-item--active' : ''}`}
                    onClick={() => setActiveSection(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </aside>

              {/* Right content */}
              <div className="settings-content">
                <div className="settings-content-header">
                  <h5 className="settings-content-title" id="settings-modal-title">
                    {NAV_ITEMS.find((i) => i.id === activeSection)?.label}
                  </h5>
                  <button
                    type="button"
                    className="btn-close settings-close"
                    aria-label="Close"
                    onClick={onClose}
                  />
                </div>

                {activeSection === 'general' && (
                  <div className="settings-section">
                    <p className="settings-account-line">
                      Signed in as <strong>{username}</strong>
                    </p>

                    <div className="settings-group-label">Confirmations</div>

                    <div className="settings-row">
                      <div className="settings-row-text">
                        <div className="settings-row-title">Skip delete confirmation for files</div>
                        <div className="settings-row-desc">Delete notes without showing a confirmation dialog.</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={skipFileDeleteConfirm}
                        className={`settings-toggle${skipFileDeleteConfirm ? ' settings-toggle--on' : ''}`}
                        onClick={() => onSkipFileDeleteConfirmChange(!skipFileDeleteConfirm)}
                      >
                        <span className="settings-toggle-thumb" />
                      </button>
                    </div>

                    <div className="settings-row">
                      <div className="settings-row-text">
                        <div className="settings-row-title">Skip delete confirmation for folders</div>
                        <div className="settings-row-desc">Delete folders without showing a confirmation dialog.</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={skipFolderDeleteConfirm}
                        className={`settings-toggle${skipFolderDeleteConfirm ? ' settings-toggle--on' : ''}`}
                        onClick={() => onSkipFolderDeleteConfirmChange(!skipFolderDeleteConfirm)}
                      >
                        <span className="settings-toggle-thumb" />
                      </button>
                    </div>
                  </div>
                )}
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
