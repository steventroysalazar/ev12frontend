const PRIMARY_BACKEND = 'https://ev12-backend-dev.mangoisland-fc3c6273.australiaeast.azurecontainerapps.io'
const LOCAL_BACKEND = 'http://localhost:8090'

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(value)

const normalizeUrl = (base, path) => `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`

const candidateUrls = (url) => {
  if (isAbsoluteUrl(url)) return [url]

  const primary = normalizeUrl(PRIMARY_BACKEND, url)
  const local = normalizeUrl(LOCAL_BACKEND, url)
  return [primary, local, url]
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
