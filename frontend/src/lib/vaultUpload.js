/** Allowed upload kinds keyed by lowercase extension including dot. */
const EXT_KIND = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.svg': 'image',
}

/**
 * @param {File} file
 * @returns {{ kind: 'markdown' | 'image', stem: string } | null}
 */
export function classifyVaultUploadFile(file) {
  console.log('[upload] classifyVaultUploadFile — name:', file.name, 'size:', file.size, 'type:', file.type)
  const lower = file.name.toLowerCase()
  const dot = lower.lastIndexOf('.')
  if (dot < 0) {
    console.warn('[upload] classifyVaultUploadFile — no extension found, rejecting')
    return null
  }
  const ext = lower.slice(dot)
  const kind = EXT_KIND[ext]
  if (!kind) {
    console.warn('[upload] classifyVaultUploadFile — unsupported extension:', ext)
    return null
  }
  const stem = file.name.slice(0, dot).trim() || 'upload'
  console.log('[upload] classifyVaultUploadFile — classified as:', kind, '| stem:', stem)
  return { kind, stem }
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsUtf8Text(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(r.error ?? new Error('Read failed.'))
    r.readAsText(file)
  })
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(r.error ?? new Error('Read failed.'))
    r.readAsDataURL(file)
  })
}

/**
 * @param {File} file
 * @param {'markdown' | 'image'} kind
 * @returns {Promise<string>}
 */
export async function readVaultUploadBody(file, kind) {
  console.log('[upload] readVaultUploadBody — reading file:', file.name, 'as kind:', kind)
  if (kind === 'markdown') {
    const text = await readFileAsUtf8Text(file)
    console.log('[upload] readVaultUploadBody — markdown read complete, length:', text.length)
    return text
  }
  const dataUrl = await readFileAsDataUrl(file)
  console.log('[upload] readVaultUploadBody — dataUrl prefix:', dataUrl.slice(0, 50))
  const alt = file.name.replace(/[[\]]/g, '')
  return `![${alt}](${dataUrl})\n`
}
