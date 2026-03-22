const normalizeBaseUrl = (baseUrl) => {
  const raw = String(baseUrl || '').trim()
  if (!raw) return 'https://ev12-backend-dev.mangoisland-fc3c6273.australiaeast.azurecontainerapps.io'
  return raw.replace(/\/+$/, '')
}

export function startAlarmStream(onAlarmUpdate, options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? import.meta.env.VITE_API_URL)
  const source = new EventSource(`${baseUrl}/api/alarms/stream`)

  source.addEventListener('alarm-update', (event) => {
    try {
      const payload = JSON.parse(event.data)
      onAlarmUpdate(payload)
    } catch (error) {
      options.onError?.(error)
    }
  })

  source.addEventListener('connected', () => {
    options.onConnected?.()
  })

  source.onerror = () => {
    options.onError?.(new Error('Alarm stream disconnected. Retrying...'))
  }

  return () => source.close()
}
