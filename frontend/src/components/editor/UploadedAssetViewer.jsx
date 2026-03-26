import { apiUrl, getAccessToken } from '../../lib/auth.js'

export function UploadedAssetViewer({ asset }) {
  if (!asset) return null
  const imgBaseUrl = apiUrl(`/api/vault/uploads/${asset.id}/`)
  const token = getAccessToken()
  const src = token
    ? `${imgBaseUrl}?access_token=${encodeURIComponent(token)}`
    : imgBaseUrl

  const isImage =
    typeof asset.mime_type === 'string' && asset.mime_type.startsWith('image/')

  return (
    <div className="editor-main">
      <div className="editor-split editor-split--single">
        <div className="md-preview">
          <div className="mb-2 small text-muted">
            {asset.original_name || asset.id}
          </div>
          {isImage ? (
            // Token is injected into URL for auth; it is not persisted in storage.
            <img
              src={src}
              alt={asset.original_name || asset.id}
              style={{ maxWidth: '100%' }}
            />
          ) : (
            <a href={src} target="_blank" rel="noreferrer">
              Open uploaded file
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

