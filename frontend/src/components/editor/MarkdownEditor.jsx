import { useCallback, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './MarkdownEditor.css'

function withDirAuto(Tag) {
  return function MarkdownDirAuto(props) {
    const { node: _node, children, ...rest } = props
    return (
      <Tag dir="auto" {...rest}>
        {children}
      </Tag>
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

function MarkdownLi(props) {
  const { node: _node, ...rest } = props
  return <li {...rest} />
}

const MARKDOWN_BIDI_COMPONENTS = {
  p: withDirAuto('p'),
  h1: withDirAuto('h1'),
  h2: withDirAuto('h2'),
  h3: withDirAuto('h3'),
  h4: withDirAuto('h4'),
  h5: withDirAuto('h5'),
  h6: withDirAuto('h6'),
  ul: withDirAuto('ul'),
  ol: withDirAuto('ol'),
  li: MarkdownLi,
  blockquote: withDirAuto('blockquote'),
  table: withDirAuto('table'),
  thead: withDirAuto('thead'),
  tbody: withDirAuto('tbody'),
  tr: withDirAuto('tr'),
  td: withDirAuto('td'),
  th: withDirAuto('th'),
  strong: withDirAuto('strong'),
  em: withDirAuto('em'),
  del: withDirAuto('del'),
  a: withDirAuto('a'),
  dl: withDirAuto('dl'),
  dt: withDirAuto('dt'),
  dd: withDirAuto('dd'),
  section: withDirAuto('section'),
  sup: withDirAuto('sup'),
  sub: withDirAuto('sub'),
  pre: MarkdownPre,
  code: MarkdownCode,
}

const EDITOR_SPLIT_STORAGE_KEY = 'notes_editor_split_pct'
const EDITOR_SPLIT_MIN = 18
const EDITOR_SPLIT_MAX = 82

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

export function MarkdownEditor({ file, dispatch }) {
  const editorSplitRef = useRef(null)
  const splitDragRef = useRef({ active: false, lastPct: 50 })
  const [editorSplitLeftPct, setEditorSplitLeftPct] = useState(
    readStoredEditorSplitPct,
  )
  const [editorSplitDragging, setEditorSplitDragging] = useState(false)

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

  return (
    <div className="editor-main">
      <div
        ref={editorSplitRef}
        className="editor-split"
        style={{
          gridTemplateColumns: `minmax(0, ${editorSplitLeftPct}fr) 10px minmax(0, ${100 - editorSplitLeftPct}fr)`,
        }}
      >
        <div className="editor-split-pane editor-split-source">
          <textarea
            className="md-editor md-editor--split"
            spellCheck={false}
            value={file.content}
            onChange={(e) =>
              dispatch({
                type: 'SET_CONTENT',
                fileId: file.id,
                content: e.target.value,
              })
            }
            placeholder="Write Markdown here (raw)…"
            aria-label="Raw Markdown source"
          />
        </div>
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
      </div>
    </div>
  )
}
