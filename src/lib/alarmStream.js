const normalizeBaseUrl = (baseUrl) => {
  const raw = String(baseUrl || '').trim()
  if (!raw) return 'https://ev12-backend-dev.mangoisland-fc3c6273.australiaeast.azurecontainerapps.io'
  return raw.replace(/\/+$/, '')
}

const buildStreamUrl = (baseUrl) => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  if (!normalizedBaseUrl) return '/api/alarms/stream'
  return `${normalizedBaseUrl}/api/alarms/stream`
}

const parseUpdatePayload = (rawValue) => {
  if (!rawValue) return null

  try {
    const parsed = JSON.parse(rawValue)
    if (!parsed || typeof parsed !== 'object') return null

    if (parsed.type === 'connected') return null
    if (parsed.type === 'alarm-update' && parsed.payload && typeof parsed.payload === 'object') {
      return parsed.payload
    }

    if (parsed.payload && typeof parsed.payload === 'object') return parsed.payload
    return parsed
  } catch {
    return null
  }
}

export function startAlarmStream(onAlarmUpdate, options = {}) {
  const streamUrl = buildStreamUrl(options.baseUrl ?? import.meta.env.VITE_API_URL)
  const source = new EventSource(streamUrl)

  source.addEventListener('alarm-update', (event) => {
    const payload = parseUpdatePayload(event.data)
    if (payload) onAlarmUpdate(payload)
  })

  source.addEventListener('connected', () => {
    options.onConnected?.()
  })

  source.onmessage = (event) => {
    const payload = parseUpdatePayload(event.data)
    if (!payload) return
    onAlarmUpdate(payload)
  }

  source.onerror = () => {
    options.onError?.(new Error('Alarm stream disconnected. Retrying...'))
  }

  return () => source.close()
}
