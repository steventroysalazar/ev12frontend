import { buildEviewSmsAccessSetup } from './smsAccessSetup'

export const initialConfigForm = {
  deviceId: '',
  imei: '',
  contactSlot: 1,
  contactNumber: '',
  contactName: '',
  contactSmsEnabled: true,
  contactCallEnabled: true,
  contacts: [
    { slot: 1, name: '', phone: '', smsEnabled: true, callEnabled: true }
  ],
  applyGatewayToAllDevices: false,
  smsPassword: '',
  smsWhitelistEnabled: false,
  requestLocation: true,
  requestGpsLocation: false,
  requestLbsLocation: false,
  sosMode: 1,
  sosActionTime: 20,
  fallDownEnabled: '1',
  fallDownSensitivity: '6',
  fallDownCall: true,
  motionAlarmType: 'motion',
  motionEnabled: '1',
  motionStaticTime: '05m',
  motionDurationTime: '03s',
  motionCall: true,
  overSpeedEnabled: '1',
  overSpeedLimit: '100km/h',
  geoFenceEnabled: '1',
  geoFenceMode: '0',
  geoFenceRadius: '100m',
  wifiEnabled: '1',
  speakerVolume: '100',
  prefixName: 'Emma',
  continuousLocateInterval: '10s',
  continuousLocateDuration: '600s',
  timeZone: '+08:00',
  checkStatus: true
}

export const SUPPORTED_DEVICE_DEFAULTS = {
  smsWhitelistEnabled: false,
  sosMode: '1',
  sosActionTime: '20',
  fallDownEnabled: '1',
  fallDownSensitivity: '6',
  speakerVolume: '100'
}

export const applySupportedDeviceDefaults = (form = {}) => ({
  ...form,
  ...SUPPORTED_DEVICE_DEFAULTS
})

const boolToFlag = (value) => (value ? 1 : 0)
const normalizeMotionAlarmType = (value) => (value === 'no-motion' ? 'no-motion' : 'motion')
const normalizeTimeToken = (value, fallback) => {
  const raw = String(value || '').trim()
  if (!raw) return fallback

  const match = raw.match(/^(\d+)\s*([smhSMH]?)$/)
  if (!match) return fallback

  const [, amount, unit] = match
  const normalizedAmount = String(Number(amount))
  const normalizedUnit = (unit || 's').toLowerCase()
  return `${normalizedAmount}${normalizedUnit}`
}

const normalizedContacts = (form) => {
  if (Array.isArray(form.contacts) && form.contacts.length) {
    return form.contacts
      .slice(0, 10)
      .map((contact, index) => ({
        slot: index + 1,
        name: String(contact?.name || '').trim(),
        phone: String(contact?.phone || '').trim(),
        smsEnabled: contact?.smsEnabled !== false,
        callEnabled: contact?.callEnabled !== false
      }))
      .filter((contact) => contact.phone)
  }

  if (!form.contactNumber) return []

  return [{
    slot: Number(form.contactSlot) || 1,
    name: String(form.contactName || '').trim(),
    phone: String(form.contactNumber || '').trim(),
    smsEnabled: Boolean(form.contactSmsEnabled),
    callEnabled: Boolean(form.contactCallEnabled)
  }]
}

const buildCommandEntries = (form) => {
  const entries = []
  const smsAccessSetup = buildEviewSmsAccessSetup({
    authorizedNumbers: normalizedContacts(form).map((contact) => contact.phone),
    restrictedAccess: Boolean(form.smsWhitelistEnabled)
  })

  smsAccessSetup.config.authorizedNumbers.forEach((contact) => {
    entries.push({ key: `contact-${contact.slot}`, command: contact.sms })
  })
  entries.push({ key: 'smsWhitelistEnabled', command: smsAccessSetup.config.accessModeSms })

  if (form.smsPassword) entries.push({ key: 'smsPassword', command: `P${form.smsPassword}` })
  if (form.requestLocation) entries.push({ key: 'requestLocation', command: 'Loc' })
  if (form.requestGpsLocation) entries.push({ key: 'requestGpsLocation', command: 'loc,gps' })
  if (form.requestLbsLocation) entries.push({ key: 'requestLbsLocation', command: 'LBS1' })
  if (form.sosMode && form.sosActionTime) entries.push({ key: 'sos', command: `SOS${form.sosMode},${form.sosActionTime}` })
  if (form.fallDownEnabled !== '') entries.push({ key: 'fallDown', command: `fl${form.fallDownEnabled},${form.fallDownSensitivity || 5},${boolToFlag(form.fallDownCall)}` })
  if (form.motionEnabled !== '') {
    const motionAlarmType = normalizeMotionAlarmType(form.motionAlarmType)
    const staticTime = normalizeTimeToken(form.motionStaticTime, '5m')
    const durationTime = normalizeTimeToken(form.motionDurationTime, '3s')
    if (motionAlarmType === 'no-motion') {
      entries.push({
        key: 'motion',
        command: `nm0${form.motionEnabled},${staticTime},${boolToFlag(form.motionCall)}`
      })
    } else {
      entries.push({
        key: 'motion',
        command: `mo${form.motionEnabled},${staticTime},${durationTime},${boolToFlag(form.motionCall)}`
      })
    }
  }
  if (form.overSpeedEnabled !== '' && form.overSpeedLimit) entries.push({ key: 'overSpeed', command: `Speed${form.overSpeedEnabled},${form.overSpeedLimit}` })
  if (form.geoFenceEnabled !== '' && form.geoFenceRadius) entries.push({ key: 'geoFence', command: `Geo1,${form.geoFenceEnabled},${form.geoFenceMode || 0},${form.geoFenceRadius}` })
  if (form.wifiEnabled !== '') entries.push({ key: 'wifiEnabled', command: `Wifi${form.wifiEnabled}` })
  if (form.speakerVolume) entries.push({ key: 'speakerVolume', command: `Speakervolume${form.speakerVolume}` })
  if (form.prefixName) entries.push({ key: 'prefixName', command: `prefix1,${form.prefixName}` })
  if (form.continuousLocateInterval && form.continuousLocateDuration) entries.push({ key: 'continuousLocate', command: `CL${form.continuousLocateInterval},${form.continuousLocateDuration}` })
  if (form.timeZone) entries.push({ key: 'timeZone', command: `tz${form.timeZone}` })
  if (form.checkStatus) entries.push({ key: 'checkStatus', command: 'status' })

  return entries
}

export const buildEv12Preview = (form, baselineForm = null) => {
  const currentEntries = buildCommandEntries(form)

  if (!baselineForm) {
    return currentEntries.map((entry) => entry.command).join(',')
  }

  const baselineEntries = buildCommandEntries(baselineForm)
  const baselineMap = new Map(baselineEntries.map((entry) => [entry.key, entry.command]))

  const updatedOnlyCommands = currentEntries
    .filter((entry) => baselineMap.get(entry.key) !== entry.command)
    .map((entry) => entry.command)

  return updatedOnlyCommands.join(',')
}

export const formatReply = (reply) => {
  const date = Number(reply.date || 0)
  const dateLabel = date ? new Date(date).toLocaleString() : 'Unknown time'
  return `[${dateLabel}] ${reply.from}: ${reply.message}`
}
