const DEVICE_ID_STORAGE_KEY = 'ev12:web-device-id'

const buildUserAgentDescriptor = () => {
  if (typeof navigator === 'undefined') return { osType: 'Web', osVersion: 'Unknown' }

  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''

  if (/windows/i.test(ua) || /win/i.test(platform)) return { osType: 'Windows', osVersion: platform || 'Windows' }
  if (/mac os x/i.test(ua) || /mac/i.test(platform)) return { osType: 'macOS', osVersion: platform || 'macOS' }
  if (/linux/i.test(ua)) return { osType: 'Linux', osVersion: platform || 'Linux' }
  return { osType: 'Web', osVersion: platform || 'Unknown' }
}

const generateDeviceId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `WEB_PC_${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`
  }

  return `WEB_PC_${Math.random().toString(36).slice(2).toUpperCase()}${Date.now()}`
}

export const getOrCreateWebDeviceId = () => {
  if (typeof window === 'undefined') return 'WEB_PC_SERVER_RENDER'
  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  if (existing) return existing
  const generated = generateDeviceId()
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated)
  return generated
}

export const getWebDeviceMetadata = () => {
  const descriptor = buildUserAgentDescriptor()
  return {
    grant_type: 'password',
    scope: 'type:1',
    os_type: descriptor.osType,
    os_version: descriptor.osVersion,
    api_version: 'Web Browser',
    device_id: getOrCreateWebDeviceId()
  }
}
