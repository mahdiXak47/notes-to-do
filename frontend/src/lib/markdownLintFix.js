import { applyFixes } from 'markdownlint'
import { lint } from 'markdownlint/promise'

const DOC_KEY = 'doc'

/**
 * @param {unknown} detail
 * @returns {number}
 */
function expectedLengthFromDetail(detail) {
  const m = String(detail ?? '').match(/Expected:\s*(\d+)/)
  return m ? Number(m[1]) : 80
}

/**
 * MD013 relaxed treats a line as too long only if there is whitespace after the
 * Nth character (0-based: at index N or later). Break search must include index
 * N, not only 0..N-1, or we miss the only valid split (e.g. 80 chars + space).
 *
 * @param {string} rem
 * @param {number} budget Max length of the segment before the break (trimmed).
 * @returns {number}
 */
function lastBreakableSpaceWithinBudget(rem, budget) {
  const maxIdx = Math.min(rem.length - 1, budget)
  for (let i = maxIdx; i > 0; i--) {
    if (/\s/.test(rem[i])) {
      const left = rem.slice(0, i).trimEnd()
      if (left.length > 0 && left.length <= budget) return i
    }
  }
  return -1
}

/**
 * @param {string} line
 * @returns {{ prefix: string, continuation: string, content: string }}
 */
function parseLineStructure(line) {
  const re = /^(\s*)((?:>\s*)*)((?:\d+\.\s|[-*+]\s)?)/
  const m = line.match(re)
  const g1 = m?.[1] ?? ''
  const g2 = m?.[2] ?? ''
  const g3 = m?.[3] ?? ''
  const prefix = g1 + g2 + g3
  const content = line.slice(prefix.length)
  const continuation = g1 + g2 + (g3 ? ' '.repeat(g3.length) : '')
  return { prefix, continuation, content }
}

/**
 * @param {string} text
 * @param {number} firstBudget
 * @param {number} nextBudget
 * @returns {string[] | null}
 */
function wrapPlainContent(text, firstBudget, nextBudget) {
  const out = []
  let rem = text
  let budget = firstBudget
  while (rem.length > budget) {
    const sp = lastBreakableSpaceWithinBudget(rem, budget)
    if (sp < 0) return null
    out.push(rem.slice(0, sp).trimEnd())
    rem = rem.slice(sp + 1).trimStart()
    budget = nextBudget
  }
  if (rem.length > 0) out.push(rem)
  return out
}

/**
 * @param {string} line
 * @param {number} maxLen
 * @returns {string[]}
 */
function wrapStructuredLine(line, maxLen) {
  if (line.length <= maxLen) return [line]
  const { prefix, continuation, content } = parseLineStructure(line)
  if (!content.trim()) return [line]
  const firstBudget = maxLen - prefix.length
  const nextBudget = maxLen - continuation.length
  if (firstBudget < 1 || nextBudget < 1) return [line]
  const parts = wrapPlainContent(content.trimStart(), firstBudget, nextBudget)
  if (parts == null || parts.length <= 1) return [line]
  return parts.map((p, i) => (i === 0 ? prefix : continuation) + p)
}

/**
 * @param {string[]} lines
 * @param {number} idx
 * @returns {boolean}
 */
function inCodeFenceAt(lines, idx) {
  let open = false
  for (let i = 0; i < idx; i++) {
    const t = lines[i].trimStart()
    if (/^(`{3,}|~{3,})/.test(t)) open = !open
  }
  return open
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isAtxHeadingLine(line) {
  return /^\s{0,3}#{1,6}(?:\s|$)/.test(line)
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isReferenceDefinitionLine(line) {
  return /^\s*\[[^\]]+\]:/.test(line)
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function looksLikeTableRow(line) {
  const t = line.trim()
  return t.includes('|') && /^\|.*\|\s*$/.test(t)
}

/**
 * @param {string[]} lines
 * @param {number} idx
 * @returns {boolean}
 */
function shouldAutoWrapMd013Line(lines, idx) {
  const line = lines[idx]
  if (isAtxHeadingLine(line)) return false
  if (isReferenceDefinitionLine(line)) return false
  if (looksLikeTableRow(line)) return false
  if (inCodeFenceAt(lines, idx)) return false
  return true
}

/**
 * @param {{ ruleNames?: string[] }} e
 * @returns {boolean}
 */
function isMd013(e) {
  const names = e.ruleNames
  return names?.[0] === 'MD013' || names?.includes('line-length')
}

/**
 * @param {string} text
 * @param {Record<string, unknown>} [lintConfig]
 * @returns {Promise<{ text: string, wrapPasses: number }>}
 */
async function applyMd013Wrap(text, lintConfig = {}) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  let lines = text.split(/\r?\n/)
  let wrapPasses = 0
  const config = { default: true, ...lintConfig }

  for (let pass = 0; pass < 200; pass++) {
    const res = await lint({ strings: { [DOC_KEY]: lines.join('\n') }, config })
    const batch = (res[DOC_KEY] ?? []).filter(isMd013)
    if (batch.length === 0) break

    const byLine = [...batch].sort((a, b) => b.lineNumber - a.lineNumber)
    let progressed = false
    for (const err of byLine) {
      const idx = err.lineNumber - 1
      if (idx < 0 || idx >= lines.length) continue
      if (!shouldAutoWrapMd013Line(lines, idx)) continue
      const maxLen = expectedLengthFromDetail(err.errorDetail)
      const wrapped = wrapStructuredLine(lines[idx], maxLen)
      if (wrapped.length <= 1) continue
      lines.splice(idx, 1, ...wrapped)
      progressed = true
      break
    }
    if (!progressed) break
    wrapPasses++
    text = lines.join(eol)
    lines = text.split(/\r?\n/)
  }

  return { text: lines.join(eol), wrapPasses }
}

function normalizeRemainingIssues(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((r) => ({
    lineNumber: r.lineNumber,
    ruleName: r.ruleNames?.[0] ?? r.ruleName ?? '',
    description: r.ruleDescription ?? '',
    detail: r.errorDetail,
  }))
}

/**
 * Lints markdown, applies markdownlint auto-fixes, then wraps MD013 lines where safe.
 *
 * @param {string} content Raw markdown.
 * @param {object} [options]
 * @param {Record<string, unknown>} [options.config] markdownlint config (merged with default: true).
 * @returns {Promise<{
 *   text: string,
 *   initialIssueCount: number,
 *   remainingIssueCount: number,
 *   remainingIssues: Array<{ lineNumber: number, ruleName: string, description: string, detail?: string }>,
 *   md013WrapPasses: number,
 * }>}
 */
export async function lintAndFixMarkdown(content, options = {}) {
  const lintConfig = options.config ?? {}
  const firstPass = await lint({
    strings: { [DOC_KEY]: content },
    config: { default: true, ...lintConfig },
  })
  const errors = firstPass[DOC_KEY] ?? []
  let text = applyFixes(content, errors)
  const { text: wrapped, wrapPasses } = await applyMd013Wrap(text, lintConfig)
  text = wrapped
  const secondPass = await lint({
    strings: { [DOC_KEY]: text },
    config: { default: true, ...lintConfig },
  })
  const remaining = secondPass[DOC_KEY] ?? []
  return {
    text,
    initialIssueCount: errors.length,
    remainingIssueCount: remaining.length,
    remainingIssues: normalizeRemainingIssues(remaining),
    md013WrapPasses: wrapPasses,
  }
}
