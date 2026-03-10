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
  smsPassword: '',
  smsWhitelistEnabled: false,
  requestLocation: true,
  requestGpsLocation: false,
  requestLbsLocation: false,
  sosMode: 1,
  sosActionTime: 20,
  fallDownEnabled: '1',
  fallDownSensitivity: 5,
  fallDownCall: true,
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
  speakerVolume: '90',
  prefixName: 'Emma',
  continuousLocateInterval: '10s',
  continuousLocateDuration: '600s',
  timeZone: '+08:00',
  checkStatus: true
}

const boolToFlag = (value) => (value ? 1 : 0)

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

export const buildEv12Preview = (form) => {
  const commands = []

  normalizedContacts(form).forEach((contact) => {
    commands.push(
      `A${contact.slot},${boolToFlag(contact.smsEnabled)},${boolToFlag(contact.callEnabled)},${contact.phone}${contact.name ? `,${contact.name}` : ''}`
    )
  })
  if (form.smsPassword) commands.push(`P${form.smsPassword}`)
  if (form.smsWhitelistEnabled) commands.push('sms1')
  if (form.requestLocation) commands.push('Loc')
  if (form.requestGpsLocation) commands.push('loc,gps')
  if (form.requestLbsLocation) commands.push('LBS1')
  if (form.sosMode && form.sosActionTime) commands.push(`SOS${form.sosMode},${form.sosActionTime}`)
  if (form.fallDownEnabled !== '') commands.push(`fl${form.fallDownEnabled},${form.fallDownSensitivity || 5},${boolToFlag(form.fallDownCall)}`)
  if (form.motionEnabled !== '') commands.push(`mo${form.motionEnabled},${form.motionStaticTime || '05m'},${form.motionDurationTime || '03s'},${boolToFlag(form.motionCall)}`)
  if (form.overSpeedEnabled !== '' && form.overSpeedLimit) commands.push(`Speed${form.overSpeedEnabled},${form.overSpeedLimit}`)
  if (form.geoFenceEnabled !== '' && form.geoFenceRadius) commands.push(`Geo1,${form.geoFenceEnabled},${form.geoFenceMode || 0},${form.geoFenceRadius}`)
  if (form.wifiEnabled !== '') commands.push(`Wifi${form.wifiEnabled}`)
  if (form.speakerVolume) commands.push(`Speakervolume${form.speakerVolume}`)
  if (form.prefixName) commands.push(`prefix1,${form.prefixName}`)
  if (form.continuousLocateInterval && form.continuousLocateDuration) commands.push(`CL${form.continuousLocateInterval},${form.continuousLocateDuration}`)
  if (form.timeZone) commands.push(`tz${form.timeZone}`)
  if (form.checkStatus) commands.push('status')

  return commands.join(',')
}

export const formatReply = (reply) => {
  const date = Number(reply.date || 0)
  const dateLabel = date ? new Date(date).toLocaleString() : 'Unknown time'
  return `[${dateLabel}] ${reply.from}: ${reply.message}`
}
