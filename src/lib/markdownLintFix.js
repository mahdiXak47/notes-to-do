import { applyFixes } from 'markdownlint'
import { lint } from 'markdownlint/promise'

const DOC_KEY = 'doc'

/**
 * Lints markdown and applies markdownlint auto-fixes (where rules expose fixInfo).
 *
 * @param {string} content Raw markdown.
 * @returns {Promise<{ text: string, initialIssueCount: number, remainingIssueCount: number }>}
 */
export async function lintAndFixMarkdown(content) {
  const firstPass = await lint({ strings: { [DOC_KEY]: content } })
  const errors = firstPass[DOC_KEY] ?? []
  const text = applyFixes(content, errors)
  const secondPass = await lint({ strings: { [DOC_KEY]: text } })
  const remaining = secondPass[DOC_KEY] ?? []
  return {
    text,
    initialIssueCount: errors.length,
    remainingIssueCount: remaining.length,
  }
}
