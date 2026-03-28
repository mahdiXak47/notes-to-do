import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './MarkdownEditor.css'
import { getAccessToken } from '../../lib/auth.js'

function withDirAuto(Tag) {
  const Component = Tag
  return function MarkdownDirAuto(props) {
    const { node: _node, children, ...rest } = props
    return (
      <Component dir="auto" {...rest}>
        {children}
      </Component>
    )
  }
}

function MarkdownPre(props) {
  const { node: _node, children, ...rest } = props
  return (
    <pre dir="auto" {...rest}>
      {children}
    </pre>
  )
}

function MarkdownCode(props) {
  const { inline, node: _node, children, ...rest } = props
  if (inline) {
    return (
      <code dir="auto" {...rest}>
        {children}
      </code>
    )
  }
  return <code {...rest}>{children}</code>
}


function MarkdownImg(props) {
  const { src, alt, ...rest } = props
  if (typeof src === 'string') {
    const needsToken =
      src.includes('/api/vault/uploads/') &&
      !src.includes('access_token=')
    if (needsToken) {
      const token = getAccessToken()
      if (token) {
        const join = src.includes('?') ? '&' : '?'
        return (
          <img
            src={`${src}${join}access_token=${encodeURIComponent(token)}`}
            alt={alt}
            {...rest}
          />
        )
      }
    }
  }
  return <img src={src} alt={alt} {...rest} />
}

const MARKDOWN_BIDI_COMPONENTS = {
  // Block elements: dir="auto" lets the browser detect RTL per-block
  p: withDirAuto('p'),
  h1: withDirAuto('h1'),
  h2: withDirAuto('h2'),
  h3: withDirAuto('h3'),
  h4: withDirAuto('h4'),
  h5: withDirAuto('h5'),
  h6: withDirAuto('h6'),
  ul: withDirAuto('ul'),
  ol: withDirAuto('ol'),
  blockquote: withDirAuto('blockquote'),
  table: withDirAuto('table'),
  thead: withDirAuto('thead'),
  tbody: withDirAuto('tbody'),
  tr: withDirAuto('tr'),
  td: withDirAuto('td'),
  th: withDirAuto('th'),
  dl: withDirAuto('dl'),
  dt: withDirAuto('dt'),
  dd: withDirAuto('dd'),
  section: withDirAuto('section'),
  // Inline elements: NO dir attribute — adding dir="auto" on inline elements
  // isolates their text from the parent block's direction detection, breaking RTL.
  img: MarkdownImg,
  pre: MarkdownPre,
  code: MarkdownCode,
}

const EDITOR_SPLIT_STORAGE_KEY = 'notes_editor_split_pct'
const EDITOR_SPLIT_MIN = 18
const EDITOR_SPLIT_MAX = 82
const TAB_CHAR = '\t'

function lineIndexAt(value, pos) {
  return value.slice(0, pos).split('\n').length - 1
}

function mapCaretAfterBlockReplace(startLine, oldBlock, newBlock, pos) {
  if (pos <= startLine) return pos
  const oldEnd = startLine + oldBlock.length
  if (pos >= oldEnd) return pos + (newBlock.length - oldBlock.length)
  const oLines = oldBlock.split('\n')
  const nLines = newBlock.split('\n')
  let accOld = 0
  let accNew = 0
  for (let i = 0; i < oLines.length; i++) {
    const oLine = oLines[i]
    const nLine = nLines[i] ?? ''
    const lineStartOld = startLine + accOld
    const lineEndOldExcl = lineStartOld + oLine.length
    if (pos <= lineEndOldExcl) {
      const col = pos - lineStartOld
      const removed = oLine.length - nLine.length
      return startLine + accNew + Math.max(0, col - removed)
    }
    const nl = i < oLines.length - 1 ? 1 : 0
    accOld += oLine.length + nl
    accNew += nLine.length + nl
  }
  return pos + (newBlock.length - oldBlock.length)
}

function applyTabToMarkdown(value, selStart, selEnd, shiftKey) {
  const s = Math.min(selStart, selEnd)
  const e = Math.max(selStart, selEnd)
  if (s === e) {
    if (shiftKey) {
      // Dedent current line
      const lineStart = value.lastIndexOf('\n', s - 1) + 1
      const line = value.slice(lineStart, value.indexOf('\n', lineStart) === -1 ? value.length : value.indexOf('\n', lineStart))
      let removed = 0
      if (line.startsWith(TAB_CHAR)) removed = 1
      else if (line.startsWith('  ')) removed = 2
      if (removed === 0) return { next: value, caretStart: s, caretEnd: s }
      const next = value.slice(0, lineStart) + line.slice(removed) + value.slice(lineStart + line.length)
      return { next, caretStart: Math.max(lineStart, s - removed), caretEnd: Math.max(lineStart, s - removed) }
    }
    const next = value.slice(0, s) + TAB_CHAR + value.slice(e)
    return { next, caretStart: s + 1, caretEnd: s + 1 }
  }
  const startLine = value.lastIndexOf('\n', s - 1) + 1
  let endLine = value.indexOf('\n', e - 1)
  if (endLine === -1) {
    endLine = value.length
  } else {
    endLine += 1
  }
  const block = value.slice(startLine, endLine)
  const lines = block.split('\n')
  const newLines = lines.map((line) => {
    if (shiftKey) {
      if (line.startsWith(TAB_CHAR)) return line.slice(1)
      if (line.startsWith('  ')) return line.slice(2)
      return line
    }
    return TAB_CHAR + line
  })
  const newBlock = newLines.join('\n')
  const next = value.slice(0, startLine) + newBlock + value.slice(endLine)
  const baseLine = lineIndexAt(value, startLine)
  const sLine = lineIndexAt(value, s)
  const eLine = lineIndexAt(value, Math.max(s, e - 1))
  if (shiftKey) {
    return {
      next,
      caretStart: mapCaretAfterBlockReplace(startLine, block, newBlock, s),
      caretEnd: mapCaretAfterBlockReplace(startLine, block, newBlock, e),
    }
  }
  return {
    next,
    caretStart: s + (sLine - baseLine + 1),
    caretEnd: e + (eLine - baseLine + 1),
  }
}

function readStoredEditorSplitPct() {
  try {
    const v = localStorage.getItem(EDITOR_SPLIT_STORAGE_KEY)
    const n = v != null ? Number(v) : NaN
    if (Number.isFinite(n) && n >= EDITOR_SPLIT_MIN && n <= EDITOR_SPLIT_MAX) {
      return n
    }
  } catch {
    /* ignore quota / private mode. */
  }
  return 50
}

export function MarkdownEditor({
  file,
  dispatch,
  paneMode = 'split',
  showLineNumbers = true,
}) {
  const editorSplitRef = useRef(null)
  const sourceTextareaRef = useRef(null)
  const gutterRef = useRef(null)
  const pendingSourceSelectionRef = useRef(null)
  const splitDragRef = useRef({ active: false, lastPct: 50 })
  const [editorSplitLeftPct, setEditorSplitLeftPct] = useState(
    readStoredEditorSplitPct,
  )
  const [editorSplitDragging, setEditorSplitDragging] = useState(false)

  const lineCount = useMemo(() => {
    if (file.content.length === 0) return 1
    return file.content.split('\n').length
  }, [file.content])

  const gutterText = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => String(i + 1)).join('\n'),
    [lineCount],
  )

  const gutterStyle = useMemo(
    () => ({ minWidth: `${Math.max(2, String(lineCount).length) + 1}ch` }),
    [lineCount],
  )

  useLayoutEffect(() => {
    if (!showLineNumbers) return
    const ta = sourceTextareaRef.current
    const g = gutterRef.current
    if (ta && g) g.scrollTop = ta.scrollTop
  }, [showLineNumbers, lineCount])

  useLayoutEffect(() => {
    const p = pendingSourceSelectionRef.current
    if (!p) return
    if (p.fileId !== file.id) {
      pendingSourceSelectionRef.current = null
      return
    }
    pendingSourceSelectionRef.current = null
    const el = sourceTextareaRef.current
    if (!el) return
    el.setSelectionRange(p.start, p.end)
  }, [file.content, file.id])

  const onSourceKeyDown = useCallback(
    (e) => {
      if (e.key !== 'Tab') return
      e.preventDefault()
      const el = e.currentTarget
      const { selectionStart, selectionEnd } = el
      const { next, caretStart, caretEnd } = applyTabToMarkdown(
        file.content,
        selectionStart,
        selectionEnd,
        e.shiftKey,
      )
      pendingSourceSelectionRef.current = {
        fileId: file.id,
        start: caretStart,
        end: caretEnd,
      }
      dispatch({
        type: 'SET_CONTENT',
        fileId: file.id,
        content: next,
      })
    },
    [dispatch, file.content, file.id],
  )

  const onSourceScroll = useCallback((e) => {
    const g = gutterRef.current
    if (g) g.scrollTop = e.currentTarget.scrollTop
  }, [])

  const onEditorSplitPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return
      e.preventDefault()
      splitDragRef.current = {
        active: true,
        lastPct: editorSplitLeftPct,
      }
      setEditorSplitDragging(true)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMove = (ev) => {
        if (!splitDragRef.current.active || !editorSplitRef.current) return
        const rect = editorSplitRef.current.getBoundingClientRect()
        const x = ev.clientX - rect.left
        let pct = (x / rect.width) * 100
        pct = Math.min(EDITOR_SPLIT_MAX, Math.max(EDITOR_SPLIT_MIN, pct))
        splitDragRef.current.lastPct = pct
        setEditorSplitLeftPct(pct)
      }

      const onUp = () => {
        if (!splitDragRef.current.active) return
        splitDragRef.current.active = false
        setEditorSplitDragging(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        try {
          localStorage.setItem(
            EDITOR_SPLIT_STORAGE_KEY,
            String(splitDragRef.current.lastPct),
          )
        } catch {
          /* ignore. */
        }
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [editorSplitLeftPct],
  )

  const sourcePane = (
    <div className="editor-split-pane editor-split-source">
      <div
        className={
          showLineNumbers
            ? 'editor-source-shell editor-source-shell--with-gutter'
            : 'editor-source-shell'
        }
      >
        {showLineNumbers ? (
          <pre
            ref={gutterRef}
            className="editor-line-gutter"
            dir="ltr"
            style={gutterStyle}
            aria-hidden="true"
          >
            {gutterText}
          </pre>
        ) : null}
        <textarea
          ref={sourceTextareaRef}
          className="md-editor md-editor--split"
          dir="auto"
          spellCheck={false}
          value={file.content}
          onChange={(e) =>
            dispatch({
              type: 'SET_CONTENT',
              fileId: file.id,
              content: e.target.value,
            })
          }
          onKeyDown={onSourceKeyDown}
          onScroll={onSourceScroll}
          placeholder="Write Markdown here (raw)…"
          aria-label="Raw Markdown source"
        />
      </div>
    </div>
  )

  const previewPane = (
    <div
      className="editor-split-pane editor-split-preview"
      aria-label="Markdown preview"
    >
      <div className="md-preview">
        {file.content.trim() ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={MARKDOWN_BIDI_COMPONENTS}
          >
            {file.content}
          </ReactMarkdown>
        ) : (
          <p className="md-preview-empty text-muted mb-0">
            Preview appears here as you type.
          </p>
        )}
      </div>
    </div>
  )

  if (paneMode === 'preview-only') {
    return (
      <div className="editor-main">
        <div className="editor-split editor-split--single">{previewPane}</div>
      </div>
    )
  }

  if (paneMode === 'source-only') {
    return (
      <div className="editor-main">
        <div className="editor-split editor-split--single">{sourcePane}</div>
      </div>
    )
  }

  return (
    <div className="editor-main">
      <div
        ref={editorSplitRef}
        className="editor-split"
        style={{
          gridTemplateColumns: `minmax(0, ${editorSplitLeftPct}fr) 10px minmax(0, ${100 - editorSplitLeftPct}fr)`,
        }}
      >
        {sourcePane}
        <div
          className={`editor-split-resizer ${editorSplitDragging ? 'is-dragging' : ''}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize source and preview"
          aria-valuenow={Math.round(editorSplitLeftPct)}
          aria-valuemin={EDITOR_SPLIT_MIN}
          aria-valuemax={EDITOR_SPLIT_MAX}
          tabIndex={0}
          onMouseDown={onEditorSplitPointerDown}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
            e.preventDefault()
            const step = e.key === 'ArrowLeft' ? -3 : 3
            setEditorSplitLeftPct((p) => {
              const n = Math.min(
                EDITOR_SPLIT_MAX,
                Math.max(EDITOR_SPLIT_MIN, p + step),
              )
              try {
                localStorage.setItem(EDITOR_SPLIT_STORAGE_KEY, String(n))
              } catch {
                /* ignore. */
              }
              return n
            })
          }}
        >
          <span className="editor-split-resizer-grip" aria-hidden />
        </div>
        {previewPane}
      </div>
    </div>
  )
}
