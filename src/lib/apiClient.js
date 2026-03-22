const PRIMARY_BACKEND = 'https://ev12-backend-dev.mangoisland-fc3c6273.australiaeast.azurecontainerapps.io'
const LOCAL_BACKEND = 'http://localhost:8090'

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(value)

const normalizeUrl = (base, path) => `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`

const isLocalDevHost = () => {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

const unique = (items) => [...new Set(items)]

const candidateUrls = (url) => {
  if (isAbsoluteUrl(url)) return [url]

  const local = normalizeUrl(LOCAL_BACKEND, url)
  const primary = normalizeUrl(PRIMARY_BACKEND, url)

  // In local development, prefer Vite's /api proxy first, then direct backends.
  if (isLocalDevHost()) return unique([url, local, primary])

  // In deployed environments, always prefer same-origin routes first.
  // This avoids browser CORS errors when /api is served via host-level rewrites.
  return unique([url, primary])
}

export async function fetchWithFallback(url, options = {}) {
  const candidates = candidateUrls(url)
  let lastError = null

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, options)
      return { response, url: candidate }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error(`Request failed for ${url}`)
}

export async function fetchJsonWithFallback(url, options = {}) {
  const { response, url: resolvedUrl } = await fetchWithFallback(url, options)
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(body.error || body.message || `Failed ${resolvedUrl}`)
  }

  return body
}
