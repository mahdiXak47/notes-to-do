import { useEffect, useMemo, useRef } from 'react'
import './VaultContextMenu.css'

function menuGroups(variant, isPinned) {
  if (variant === 'upload') {
    return [
      [{ id: 'copyLink', label: 'Copy link' }],
      [{ id: 'rename', label: 'Rename…' }],
      [{ id: 'delete', label: 'Delete', danger: true }],
    ]
  }
  const pinRow = [{ id: 'pin', label: isPinned ? 'Unpin' : 'Pin' }]
  if (variant === 'folder') {
    return [
      pinRow,
      [
        { id: 'newNote', label: 'New note' },
        { id: 'newFolder', label: 'New folder' },
      ],
      [
        { id: 'duplicate', label: 'Duplicate' },
        { id: 'move', label: 'Move folder to…' },
        { id: 'download', label: 'Download as .zip' },
      ],
      [
        { id: 'rename', label: 'Rename…' },
        { id: 'delete', label: 'Delete', danger: true },
      ],
    ]
  }
  return [
    pinRow,
    [
      { id: 'duplicate', label: 'Duplicate' },
      { id: 'move', label: 'Move file to…' },
      { id: 'download', label: 'Download' },
    ],
    [
      { id: 'rename', label: 'Rename…' },
      { id: 'delete', label: 'Delete', danger: true },
    ],
  ]
}

export function VaultContextMenu({
  open,
  x,
  y,
  variant,
  isPinned,
  disabled,
  onClose,
  onAction,
}) {
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open || !menuRef.current) return
    const el = menuRef.current
    const rect = el.getBoundingClientRect()
    const pad = 8
    let left = x
    let top = y
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad)
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad)
    }
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }, [open, x, y])

  const groups = useMemo(
    () => menuGroups(variant, Boolean(isPinned)),
    [variant, isPinned],
  )

  if (!open) return null

  return (
    <>
      <div
        className="vault-ctx-menu-backdrop"
        role="presentation"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        ref={menuRef}
        className="vault-ctx-menu"
        role="menu"
        aria-label={variant === 'folder' ? 'Folder actions' : variant === 'upload' ? 'Uploaded file actions' : 'File actions'}
        style={{ left: x, top: y }}
      >
        {groups.map((items, gi) => (
          <div key={gi}>
            {gi > 0 ? <div className="vault-ctx-menu-sep" role="separator" /> : null}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={disabled}
                className={`vault-ctx-menu-item${item.danger ? ' vault-ctx-menu-item--danger' : ''}`}
                onClick={() => {
                  if (disabled) return
                  onAction(item.id)
                  onClose()
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
