import { useCallback, useEffect, useRef } from 'react'

const TOAST_DURATION_MS = 5000

function SingleToast({ toast, onDismiss }) {
  const fillRef = useRef(null)
  const rafRef = useRef(null)
  const deadlineRef = useRef(null)
  const pausedRef = useRef(false)
  const remainingRef = useRef(null)

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const dismiss = useCallback(() => {
    stopLoop()
    onDismiss(toast.id)
  }, [stopLoop, onDismiss, toast.id])

  const runLoop = useCallback(() => {
    stopLoop()
    const loop = (now) => {
      const fill = fillRef.current
      const deadline = deadlineRef.current
      if (!fill || deadline == null || pausedRef.current) return
      const remaining = Math.max(0, deadline - now)
      const progress = Math.min(1, (TOAST_DURATION_MS - remaining) / TOAST_DURATION_MS)
      fill.style.transform = `scaleX(${progress})`
      if (remaining <= 0) {
        dismiss()
        return
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [stopLoop, dismiss])

  useEffect(() => {
    deadlineRef.current = performance.now() + TOAST_DURATION_MS
    requestAnimationFrame(() => {
      if (fillRef.current) fillRef.current.style.transform = 'scaleX(0)'
    })
    runLoop()
    return stopLoop
  }, [runLoop, stopLoop])

  const onPointerEnter = useCallback(() => {
    const deadline = deadlineRef.current
    if (deadline == null) return
    remainingRef.current = Math.max(0, deadline - performance.now())
    pausedRef.current = true
    stopLoop()
  }, [stopLoop])

  const onPointerLeave = useCallback(() => {
    if (!pausedRef.current) return
    pausedRef.current = false
    deadlineRef.current = performance.now() + (remainingRef.current ?? 0)
    remainingRef.current = null
    runLoop()
  }, [runLoop])

  return (
    <div
      className={`app-toast app-toast--${toast.variant}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="app-toast-body">
        <i
          className={`app-toast-icon bi ${toast.variant === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`}
          aria-hidden
        />
        <span className="app-toast-text">{toast.message}</span>
        <button
          type="button"
          className="app-toast-dismiss"
          aria-label="Dismiss notification"
          onClick={dismiss}
        >
          <i className="bi bi-x-lg" aria-hidden />
        </button>
      </div>
      <div className="app-toast-progress-track" aria-hidden="true">
        <div ref={fillRef} className="app-toast-progress-fill" />
      </div>
    </div>
  )
}

export function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div className="app-toast-stack">
      {toasts.map((t) => (
        <SingleToast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
