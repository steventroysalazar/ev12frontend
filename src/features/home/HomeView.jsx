import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../../components/sidebar/Sidebar'
import AppIcon from '../../components/icons/AppIcon'
import { fetchJsonWithFallback, fetchWithFallback } from '../../lib/apiClient'
import { applySupportedDeviceDefaults, initialConfigForm } from './ev12'
import './home.css'


const UsersPage = lazy(() => import('./pages/UsersPage'))
const LocationsPage = lazy(() => import('./pages/LocationsPage'))
const DevicesPage = lazy(() => import('./pages/DevicesPage'))
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'))
const DeviceSettingsPage = lazy(() => import('./pages/DeviceSettingsPage'))
const UserDetailPage = lazy(() => import('./pages/UserDetailPage'))
const LocationDetailPage = lazy(() => import('./pages/LocationDetailPage'))
const BulkSimPage = lazy(() => import('./pages/BulkSimPage'))

const initialLocationForm = {
  name: '',
  details: '',
  companyId: '',
  alarmReceiverAccountNumber: '',
  alarmReceiverEnabled: false,
  alarmReceiverUsers: '',
  toggleCompanyAlarmReceiver: false
}
const initialCompanyForm = {
  companyName: '',
  details: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  phone: '',
  isAlarmReceiverIncluded: false,
  alarmReceiverEnabled: false,
  dnsWhitelistText: '',
  ipWhitelistText: '',
  alarmReceiverConfigJson: ''
}
const initialUserForm = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  contactNumber: '',
  address: '',
  userRole: 3,
  companyId: '',
  locationId: '',
  allCompanyLocations: false
}
const initialDeviceForm = { name: '', phoneNumber: '', eviewVersion: '', ownerUserId: '', locationId: '', externalDeviceId: '', simIccid: '' }
const initialImeiLinkState = { open: false, deviceId: null, phoneNumber: '', externalDeviceId: '', status: '', polling: false, resendPending: false, waitStartedAt: null, lastRetryAt: null }
const initialDeviceRegistrationModal = { open: false, device: null, status: '', activatingSim: false }
const WEBHOOK_STORAGE_KEY = 'ev12:webhook-events'
const DEFAULT_HOME_SECTION = 'dashboard'
const DEFAULT_MOTION_ALERT_DURATION_MS = 3000
const DEFAULT_EVIEW_DEVICE_VERSIONS = ['EV-04', 'EV-07', 'EV-08', 'EV-10', 'EV-12']
const supportedSections = new Set([
  'dashboard',
  'companies',
  'users',
  'user-detail',
  'locations',
  'location-detail',
  'devices',
  'bulk-sim',
  'device-detail-overview',
  'device-detail-basic',
  'device-detail-advanced',
  'device-detail-location',
  'device-detail-commands',
  'settings-basic',
  'settings-advanced',
  'location',
  'alarm-logs',
  'auth-logs',
  'error-logs',
  'commands',
  'replies',
  'webhooks'
])

const parseHomeRoute = () => {
  if (typeof window === 'undefined') return { section: DEFAULT_HOME_SECTION, entityId: '' }
  const params = new URLSearchParams(window.location.search)
  const rawSection = (params.get('page') || DEFAULT_HOME_SECTION).trim()
  const section = supportedSections.has(rawSection) ? rawSection : DEFAULT_HOME_SECTION
  const entityId = (params.get('id') || '').trim()
  return { section, entityId }
}

const parseStoredWebhookEvents = () => {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(WEBHOOK_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const persistWebhookEvents = (events) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(WEBHOOK_STORAGE_KEY, JSON.stringify(events))
}

const parseDurationToMs = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value > 0 ? value : null

  const raw = String(value).trim()
  if (!raw) return null

  const normalized = raw.toLowerCase()
  const match = normalized.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/)
  if (!match) return null

  const amount = Number.parseFloat(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return null

  const unit = match[2] || 's'
  if (unit === 'ms') return Math.round(amount)
  if (unit === 's') return Math.round(amount * 1000)
  if (unit === 'm') return Math.round(amount * 60 * 1000)
  if (unit === 'h') return Math.round(amount * 60 * 60 * 1000)
  return null
}

const parseGeoFenceRadiusToMeters = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 100
  const match = raw.match(/^(\d+(?:\.\d+)?)(m|meter|meters|km|kilometer|kilometers)?$/)
  if (!match) return 100
  const amount = Number.parseFloat(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return 100
  const unit = match[2] || 'm'
  const meters = unit.startsWith('k') ? amount * 1000 : amount
  return Math.round(Math.min(65535, Math.max(100, meters)))
}

const normalizeGeoFenceSlot = (value, fallback = 1) => {
  const parsed = Number.parseInt(String(value || fallback), 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(4, Math.max(1, parsed))
}

const buildGeoFencesFromForm = (form) => {
  const configuredGeoFences = Array.isArray(form?.geoFences) && form.geoFences.length
    ? form.geoFences
    : (Array.isArray(form?.geo_fences) && form.geo_fences.length ? form.geo_fences : [])

  if (configuredGeoFences.length) {
    const usedSlots = new Set()
    return configuredGeoFences
      .slice(0, 4)
      .map((geoFence, index) => {
        const preferredSlot = normalizeGeoFenceSlot(geoFence?.slot, index + 1)
        const slot = usedSlots.has(preferredSlot)
          ? ([1, 2, 3, 4].find((value) => !usedSlots.has(value)) || preferredSlot)
          : preferredSlot
        usedSlots.add(slot)
        return {
          slot,
          enabled: String(geoFence?.enabled ?? form?.geoFenceEnabled ?? '1'),
          mode: String(geoFence?.mode ?? form?.geoFenceMode ?? '0'),
          radius: String(geoFence?.radius ?? form?.geoFenceRadius ?? '100m')
        }
      })
      .sort((a, b) => a.slot - b.slot)
  }

  const count = Math.min(4, Math.max(1, Number.parseInt(String(form?.geoFenceCount || '1'), 10) || 1))
  return Array.from({ length: count }, (_, index) => ({
    slot: index + 1,
    enabled: String(form?.geoFenceEnabled ?? '1'),
    mode: String(form?.geoFenceMode ?? '0'),
    radius: String(form?.geoFenceRadius ?? '100m')
  }))
}

const parseCsvLines = (value) => String(value || '')
  .split(/[,\n]/)
  .map((entry) => entry.trim())
  .filter(Boolean)

const parseJsonInput = (value, fallback = {}) => {
  const raw = String(value || '').trim()
  if (!raw) return fallback

  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

const resolveAuthorizedNumbers = (settings = {}, fallbackPhone = '') => {
  const candidates = [
    settings?.authorizedNumbers,
    settings?.authorized_numbers,
    settings?.whitelistedNumbers,
    settings?.whitelisted_numbers
  ]
  const matched = candidates.find((entry) => Array.isArray(entry) && entry.length)
  if (matched) return matched.slice(0, 10).map((value) => String(value || ''))
  return [fallbackPhone || '']
}

const resolveSettingValue = (settings = {}, keys = [], fallback = '') => {
  for (const key of keys) {
    if (settings?.[key] !== undefined && settings?.[key] !== null) return settings[key]
  }
  return fallback
}

const normalizeProtocolSettingsForForm = (settings = {}) => ({
  ...settings,
  contactSlot: resolveSettingValue(settings, ['contactSlot', 'contact_slot'], 1),
  contactNumber: resolveSettingValue(settings, ['contactNumber', 'contact_number'], ''),
  contactName: resolveSettingValue(settings, ['contactName', 'contact_name'], ''),
  smsPassword: resolveSettingValue(settings, ['smsPassword', 'sms_password'], ''),
  smsWhitelistEnabled: Boolean(resolveSettingValue(settings, ['smsWhitelistEnabled', 'sms_whitelist_enabled'], false)),
  requestLocation: Boolean(resolveSettingValue(settings, ['requestLocation', 'request_location'], false)),
  requestGpsLocation: Boolean(resolveSettingValue(settings, ['requestGpsLocation', 'request_gps_location'], false)),
  requestLbsLocation: Boolean(resolveSettingValue(settings, ['requestLbsLocation', 'request_lbs_location'], false)),
  sosMode: String(resolveSettingValue(settings, ['sosMode', 'sos_mode'], '1')),
  sosActionTime: String(resolveSettingValue(settings, ['sosActionTime', 'sos_action_time'], '20')),
  fallDownEnabled: String(resolveSettingValue(settings, ['fallDownEnabled', 'fall_down_enabled'], '1')),
  fallDownSensitivity: String(resolveSettingValue(settings, ['fallDownSensitivity', 'fall_down_sensitivity'], '6')),
  fallDownCall: Boolean(resolveSettingValue(settings, ['fallDownCall', 'fall_down_call'], true)),
  motionAlarmType: String(resolveSettingValue(settings, ['motionAlarmType', 'motion_alarm_type'], 'motion')),
  motionEnabled: String(resolveSettingValue(settings, ['motionEnabled', 'motion_enabled'], '1')),
  motionStaticTime: String(resolveSettingValue(settings, ['motionStaticTime', 'motion_static_time'], '05m')),
  motionDurationTime: String(resolveSettingValue(settings, ['motionDurationTime', 'motion_duration_time'], '03s')),
  motionCall: Boolean(resolveSettingValue(settings, ['motionCall', 'motion_call'], true)),
  overSpeedEnabled: String(resolveSettingValue(settings, ['overSpeedEnabled', 'over_speed_enabled'], '1')),
  overSpeedLimit: String(resolveSettingValue(settings, ['overSpeedLimit', 'over_speed_limit'], '100km/h')),
  speakerVolume: String(resolveSettingValue(settings, ['speakerVolume', 'speaker_volume'], '100')),
  prefixName: resolveSettingValue(settings, ['prefixName', 'prefix_name'], ''),
  continuousLocateInterval: String(resolveSettingValue(settings, ['continuousLocateInterval', 'continuous_locate_interval'], '')),
  continuousLocateDuration: String(resolveSettingValue(settings, ['continuousLocateDuration', 'continuous_locate_duration'], '')),
  timeZone: String(resolveSettingValue(settings, ['timeZone', 'time_zone'], '+08:00')),
  checkStatus: Boolean(resolveSettingValue(settings, ['checkStatus', 'check_status'], false))
})

const getRangeProgressStyle = (value, min, max) => {
  const numericValue = Number(value)
  const numericMin = Number(min)
  const numericMax = Number(max)
  const denominator = numericMax - numericMin

  if (!Number.isFinite(numericValue) || !Number.isFinite(numericMin) || !Number.isFinite(numericMax) || denominator <= 0) {
    return { '--range-progress': '0%' }
  }

  const progressRatio = (numericValue - numericMin) / denominator
  const progressPercent = Math.min(100, Math.max(0, progressRatio * 100))
  return { '--range-progress': `${progressPercent}%` }
}

const isDeviceDetailSection = (section) => String(section || '').startsWith('device-detail-')

const resolveConfigSectionForField = (fieldKey) => {
  const key = String(fieldKey || '')
  if (!key) return 'device-detail-overview'

  if (['prefixName', 'smsPassword', 'smsWhitelistEnabled', 'contacts', 'contactSlot', 'contactNumber', 'contactName'].includes(key)) {
    return 'device-detail-basic'
  }

  if (key.startsWith('geoFence') || key.startsWith('fallDown') || key.startsWith('motion') || ['wifiEnabled', 'speakerVolume', 'continuousLocateInterval', 'continuousLocateDuration', 'timeZone', 'checkStatus', 'sosMode', 'sosActionTime'].includes(key)) {
    return 'device-detail-advanced'
  }

  return 'device-detail-overview'
}

const workspaceSettingCatalog = [
  { key: 'device-name', label: 'Device Name', section: 'device-detail-overview', anchorId: 'setting-device-name' },
  { key: 'device-owner', label: 'Device Owner', section: 'device-detail-overview', anchorId: 'setting-device-owner' },
  { key: 'basic-identity', label: 'Basic: Device Name / Identity', section: 'device-detail-basic', anchorId: 'setting-prefix-name' },
  { key: 'basic-sms-password', label: 'Basic: SMS Password', section: 'device-detail-basic', anchorId: 'setting-sms-password' },
  { key: 'basic-contacts', label: 'Basic: Contact Information', section: 'device-detail-basic', anchorId: 'setting-contacts' },
  { key: 'advanced-general-wifi', label: 'Advanced: Wi-Fi Positioning', section: 'device-detail-advanced', anchorId: 'setting-wifi-enabled', advancedTab: 'general' },
  { key: 'advanced-general-volume', label: 'Advanced: Speaker Volume', section: 'device-detail-advanced', anchorId: 'setting-speaker-volume', advancedTab: 'general' },
  { key: 'advanced-general-timezone', label: 'Advanced: Timezone', section: 'device-detail-advanced', anchorId: 'setting-timezone', advancedTab: 'general' },
  { key: 'advanced-alarm-sos', label: 'Advanced: SOS Action', section: 'device-detail-advanced', anchorId: 'setting-sos', advancedTab: 'alarm' },
  { key: 'advanced-alarm-fall', label: 'Advanced: Fall Detection', section: 'device-detail-advanced', anchorId: 'setting-fall', advancedTab: 'alarm' },
  { key: 'advanced-alarm-motion', label: 'Advanced: Motion / No Motion', section: 'device-detail-advanced', anchorId: 'setting-motion', advancedTab: 'alarm' },
  { key: 'advanced-geofence', label: 'Advanced: Geo-fencing', section: 'device-detail-advanced', anchorId: 'setting-geofence', advancedTab: 'geofence' },
  { key: 'live-location-map', label: 'Live Location: Device Map', section: 'device-detail-location', anchorId: 'setting-live-location-map' },
  { key: 'commands-input', label: 'Send Commands: Command Input', section: 'device-detail-commands', anchorId: 'setting-command-input' },
  { key: 'commands-queue', label: 'Send Commands: Command Queue', section: 'device-detail-commands', anchorId: 'setting-command-queue' }
]

const defaultSettingTooltipByField = {
  prefixName: 'Default: use current device name',
  smsPassword: 'Default: 123456',
  smsWhitelistEnabled: 'Default: Off',
  wifiEnabled: 'Default: device firmware profile',
  speakerVolume: 'Default: 100',
  continuousLocateInterval: 'Default: 180 sec',
  continuousLocateDuration: 'Default: device firmware profile',
  timeZone: 'Default: device firmware profile',
  checkStatus: 'Default: enabled status check',
  sosMode: 'Default: Long Press',
  sosActionTime: 'Default: 2.0s',
  fallDownEnabled: 'Default: On',
  fallDownSensitivity: 'Default: 6',
  motionAlarmType: 'Default: device firmware profile',
  motionEnabled: 'Default: device firmware profile',
  motionStaticTime: 'Default: device firmware profile',
  motionDurationTime: 'Default: device firmware profile',
  geoFenceEnabled: 'Default: device firmware profile',
  geoFenceRadius: 'Default: device firmware profile',
  geoFenceMode: 'Default: Leave Area (0)',
  geoFenceCount: 'Default: 1 (supports up to 4)',
  contacts: 'Default: SMS gateway slot uses A1,1,0,<number> then callin(0/1)'
}

function SettingDefaultHint({ field }) {
  const hint = defaultSettingTooltipByField[field]
  if (!hint) return null

  return (
    <span className="setting-default-hint" title={hint} aria-label={hint}>
      ⓘ
    </span>
  )
}

export default function HomeView({
  user,
  onLogout,
  gatewayBaseUrl,
  gatewayToken,
  setGatewayBaseUrl,
  setGatewayToken,
  configForm,
  setConfigForm,
  configBaseline,
  setConfigBaseline,
  draftCommandPreview,
  configStatus,
  configResult,
  configQueue,
  sendConfig,
  refreshConfigQueueStatus,
  resendPendingConfig,
  loading,
  phone,
  message,
  setPhone,
  setMessage,
  sendMessage,
  fetchReplies,
  requestLocationUpdate,
  locationResult,
  status,
  formattedReplies,
  replies,
  repliesCount,
  authToken,
  alarmStateByDevice,
  alarmFeed,
  alarmStreamConnected,
  onSectionChange,
  onCancelDeviceAlarm,
  alarmCancelledAtByDevice
}) {
  const [activeSection, setActiveSection] = useState(() => parseHomeRoute().section)
  const [selectedUserId, setSelectedUserId] = useState(() => parseHomeRoute().section === 'user-detail' ? parseHomeRoute().entityId : '')
  const [selectedLocationId, setSelectedLocationId] = useState(() => parseHomeRoute().section === 'location-detail' ? parseHomeRoute().entityId : '')
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => (isDeviceDetailSection(parseHomeRoute().section) ? parseHomeRoute().entityId : ''))
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [dashboardMapDeviceId, setDashboardMapDeviceId] = useState('')
  const syncingFromPopStateRef = useRef(false)

  useEffect(() => {
    onSectionChange?.(activeSection)
  }, [activeSection, onSectionChange])

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    params.set('page', activeSection)
    if (activeSection === 'user-detail' && selectedUserId) {
      params.set('id', String(selectedUserId))
    } else if (activeSection === 'location-detail' && selectedLocationId) {
      params.set('id', String(selectedLocationId))
    } else if (isDeviceDetailSection(activeSection) && selectedDeviceId) {
      params.set('id', String(selectedDeviceId))
    } else {
      params.delete('id')
    }

    if (typeof window !== 'undefined') {
      const nextUrl = `${window.location.pathname}?${params.toString()}`
      const currentUrl = `${window.location.pathname}${window.location.search}`
      if (currentUrl === nextUrl) return

      if (syncingFromPopStateRef.current) {
        syncingFromPopStateRef.current = false
        window.history.replaceState({}, '', nextUrl)
      } else {
        window.history.pushState({}, '', nextUrl)
      }
    }
  }, [activeSection, selectedDeviceId, selectedLocationId, selectedUserId])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const syncSectionFromUrl = () => {
      const route = parseHomeRoute()
      syncingFromPopStateRef.current = true
      setActiveSection(route.section)
      if (route.section === 'user-detail') setSelectedUserId(route.entityId)
      if (route.section === 'location-detail') setSelectedLocationId(route.entityId)
      if (isDeviceDetailSection(route.section)) setSelectedDeviceId(route.entityId)
    }
    window.addEventListener('popstate', syncSectionFromUrl)
    return () => window.removeEventListener('popstate', syncSectionFromUrl)
  }, [])

  const [showUserModal, setShowUserModal] = useState(false)
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [showEditCompanyModal, setShowEditCompanyModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [showEditDeviceModal, setShowEditDeviceModal] = useState(false)
  const [showEditUserModal, setShowEditUserModal] = useState(false)
  const [showEditLocationModal, setShowEditLocationModal] = useState(false)
  const [showConfigReviewModal, setShowConfigReviewModal] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState({ open: false, message: '', onConfirm: null })
  const [deviceWorkspaceLoading, setDeviceWorkspaceLoading] = useState(false)
  const [advancedSettingsTab, setAdvancedSettingsTab] = useState('general')
  const [selectedGeoFenceSlot, setSelectedGeoFenceSlot] = useState(1)
  const [workspaceSettingQuery, setWorkspaceSettingQuery] = useState('')
  const [editingUserId, setEditingUserId] = useState(null)
  const [editingCompanyId, setEditingCompanyId] = useState(null)
  const [editingLocationId, setEditingLocationId] = useState(null)
  const [editingDeviceId, setEditingDeviceId] = useState(null)

  const [users, setUsers] = useState([])
  const [companies, setCompanies] = useState([])
  const [locations, setLocations] = useState([])
  const [devices, setDevices] = useState([])
  const [managerLookupUsers, setManagerLookupUsers] = useState([])
  const [roleUserLookupUsers, setRoleUserLookupUsers] = useState([])
  const [mobileUserLookupUsers, setMobileUserLookupUsers] = useState([])
  const [superAdminLookupUsers, setSuperAdminLookupUsers] = useState([])
  const [companyLookupRows, setCompanyLookupRows] = useState([])
  const [locationLookupRows, setLocationLookupRows] = useState([])
  const [alertLookupCodes, setAlertLookupCodes] = useState([])
  const [alertLogLookupFilters, setAlertLogLookupFilters] = useState({ alarmCodes: [], actions: [], sources: [] })
  const [dashboardDevicePage, setDashboardDevicePage] = useState(1)
  const [dashboardDeviceSearch, setDashboardDeviceSearch] = useState('')
  const [dashboardDeviceAlertFilter, setDashboardDeviceAlertFilter] = useState('all')
  const [activeAlertPage, setActiveAlertPage] = useState(1)
  const [usersPage, setUsersPage] = useState(1)
  const [companiesPage, setCompaniesPage] = useState(1)
  const [locationsPage, setLocationsPage] = useState(1)
  const [devicesPage, setDevicesPage] = useState(1)
  const [userSearch, setUserSearch] = useState('')
  const [companySearch, setCompanySearch] = useState('')
  const [locationSearch, setLocationSearch] = useState('')
  const [deviceFilters, setDeviceFilters] = useState({ device: '', owner: '', location: '', phone: '', version: '' })
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [userLocationFilter, setUserLocationFilter] = useState('all')
  const [locationDeviceFilter, setLocationDeviceFilter] = useState('all')
  const [deviceAlarmFilter, setDeviceAlarmFilter] = useState('all')
  const [userDetailDeviceSearch, setUserDetailDeviceSearch] = useState('')
  const [userDetailDevicePage, setUserDetailDevicePage] = useState(1)
  const [locationDetailUserSearch, setLocationDetailUserSearch] = useState('')
  const [locationDetailUserPage, setLocationDetailUserPage] = useState(1)
  const [locationDetailDeviceSearch, setLocationDetailDeviceSearch] = useState('')
  const [locationDetailDevicePage, setLocationDetailDevicePage] = useState(1)

  const [locationForm, setLocationForm] = useState(initialLocationForm)
  const [companyForm, setCompanyForm] = useState(initialCompanyForm)
  const [userForm, setUserForm] = useState(initialUserForm)
  const [deviceForm, setDeviceForm] = useState(initialDeviceForm)

  useEffect(() => {
    if (!showDeviceModal) return
    setEditingDeviceId(null)
    setDeviceForm(initialDeviceForm)
  }, [showDeviceModal])
  const [userLocationQuery, setUserLocationQuery] = useState('')

  const [dataStatus, setDataStatus] = useState('')
  const [actionStatus, setActionStatus] = useState({ type: '', message: '' })
  const [imeiLinkState, setImeiLinkState] = useState(initialImeiLinkState)
  const [deviceRegistrationModal, setDeviceRegistrationModal] = useState(initialDeviceRegistrationModal)
  const [simActionPendingByDevice, setSimActionPendingByDevice] = useState({})
  const [bulkSimSelectedDeviceIds, setBulkSimSelectedDeviceIds] = useState([])
  const [autoFetchReplies, setAutoFetchReplies] = useState(false)
  const [webhookRaw, setWebhookRaw] = useState(null)
  const [webhookStatus, setWebhookStatus] = useState('')
  const [clearingWebhookEvents, setClearingWebhookEvents] = useState(false)
  const [webhookLimit, setWebhookLimit] = useState('10')
  const [locationDeviceId, setLocationDeviceId] = useState('')
  const [alarmLogDeviceFilter, setAlarmLogDeviceFilter] = useState('all')
  const [alarmLogLocationFilter, setAlarmLogLocationFilter] = useState('all')
  const [alarmLogTypeFilter, setAlarmLogTypeFilter] = useState('all')
  const [alarmLogAlertFilter, setAlarmLogAlertFilter] = useState('all')
  const [alarmLogActionFilter, setAlarmLogActionFilter] = useState('all')
  const [alarmLogSourceFilter, setAlarmLogSourceFilter] = useState('all')
  const [alarmLogConnectionFilter, setAlarmLogConnectionFilter] = useState('all')
  const [alarmLogs, setAlarmLogs] = useState([])
  const [alarmLogsStatus, setAlarmLogsStatus] = useState('')
  const [errorLogs, setErrorLogs] = useState([])
  const [errorLogsStatus, setErrorLogsStatus] = useState('')
  const [authLogs, setAuthLogs] = useState([])
  const [authLogsStatus, setAuthLogsStatus] = useState('')
  const [errorLogRange, setErrorLogRange] = useState('24h')
  const [errorLogCompanyFilter, setErrorLogCompanyFilter] = useState('all')
  const [errorLogLocationFilter, setErrorLogLocationFilter] = useState('all')
  const [errorLogUserFilter, setErrorLogUserFilter] = useState('all')
  const [imeiElapsedSeconds, setImeiElapsedSeconds] = useState(0)
  const [imeiRetryCooldownSeconds, setImeiRetryCooldownSeconds] = useState(0)
  const [locationBreadcrumbs, setLocationBreadcrumbs] = useState([])
  const [locationBreadcrumbsStatus, setLocationBreadcrumbsStatus] = useState('')
  const [breadcrumbDateFrom, setBreadcrumbDateFrom] = useState('')
  const [breadcrumbDateTo, setBreadcrumbDateTo] = useState('')
  const [alarmNowMs, setAlarmNowMs] = useState(() => Date.now())
  const webhookFingerprintRef = useRef('')
  const dashboardLeafletRef = useRef(null)
  const dashboardLeafletMapRef = useRef(null)
  const dashboardMarkersLayerRef = useRef(null)
  const dashboardHasAutoFramedRef = useRef(false)
  const dashboardLastFocusedDeviceRef = useRef('')
  const locationLeafletRef = useRef(null)
  const locationLeafletMapRef = useRef(null)
  const locationLeafletLayerRef = useRef(null)
  const geofenceLeafletRef = useRef(null)
  const geofenceLeafletMapRef = useRef(null)
  const geofenceLeafletLayerRef = useRef(null)
  const [leafletReady, setLeafletReady] = useState(false)
  const isDeviceWorkspaceSection = ['device-detail-overview', 'device-detail-basic', 'device-detail-advanced', 'device-detail-location', 'device-detail-commands'].includes(activeSection)
  const isDeviceDetailAdvancedSection = activeSection === 'device-detail-advanced'
  const isDeviceDetailLocationSection = activeSection === 'device-detail-location'

  const roleLabel = useCallback((value) => {
    const normalized = String(value || '').trim().toUpperCase()
    if (normalized === 'SUPER_ADMIN' || normalized === 'SUPER ADMIN') return 'QView Admin'
    if (normalized === 'COMPANY_ADMIN' || normalized === 'COMPANY ADMIN') return 'Company Admin'
    if (normalized === 'PORTAL_USER' || normalized === 'PORTAL USER') return 'Portal User'
    if (normalized === 'MOBILE_APP_USER' || normalized === 'MOBILE APP USER') return 'Mobile App User'
    if (normalized === 'MANAGER') return 'Company Admin'
    if (normalized === 'USER') return 'Portal User'

    const role = Number(value)
    if (role === 1) return 'QView Admin'
    if (role === 2) return 'Company Admin'
    if (role === 3) return 'Portal User'
    if (role === 4) return 'Mobile App User'
    return value || '-'
  }, [])

  const getAlarmMeta = useCallback((alarmCode) => {
    const normalizedCode = String(alarmCode || '').trim()
    if (!normalizedCode) return { label: 'No active alarm', tone: 'idle' }

    const normalizedLower = normalizedCode.toLowerCase()
    if (normalizedLower.includes('sos')) return { label: 'SOS Alert', tone: 'critical' }
    if (normalizedLower.includes('fall')) return { label: 'Fall-Down Alert', tone: 'warning' }
    if (/\bno[-\s]?motion\b/i.test(normalizedCode)) return { label: 'No-Motion Alert', tone: 'warning' }
    if (/\bmotion\b/i.test(normalizedCode)) return { label: 'Motion Alert', tone: 'active' }

    const geoMatch = normalizedCode.match(/^GEO-([1-4])\s+Alert(?:\s*\((inbound|outbound)\))?$/i)
    if (geoMatch) {
      const slot = geoMatch[1]
      const direction = geoMatch[2] ? geoMatch[2].toLowerCase() : ''
      const label = direction ? `GEO-${slot} Alert (${direction})` : `GEO-${slot} Alert`
      return { label, tone: 'warning' }
    }

    return { label: normalizedCode, tone: 'active' }
  }, [])

  useEffect(() => {
    const intervalId = setInterval(() => {
      setAlarmNowMs(Date.now())
    }, 1000)
    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const shouldTrackWait = imeiLinkState.open && !imeiLinkState.externalDeviceId && Boolean(imeiLinkState.waitStartedAt)
    if (!shouldTrackWait) {
      setImeiElapsedSeconds(0)
      return undefined
    }

    const tick = () => {
      const elapsedMs = Date.now() - new Date(imeiLinkState.waitStartedAt).getTime()
      setImeiElapsedSeconds(Math.max(0, Math.floor(elapsedMs / 1000)))
    }

    tick()
    const intervalId = setInterval(tick, 1000)
    return () => clearInterval(intervalId)
  }, [imeiLinkState.externalDeviceId, imeiLinkState.open, imeiLinkState.waitStartedAt])

  useEffect(() => {
    if (!imeiLinkState.lastRetryAt) {
      setImeiRetryCooldownSeconds(0)
      return undefined
    }

    const tick = () => {
      const elapsedSeconds = Math.floor((Date.now() - new Date(imeiLinkState.lastRetryAt).getTime()) / 1000)
      const remaining = Math.max(0, 120 - elapsedSeconds)
      setImeiRetryCooldownSeconds(remaining)
    }

    tick()
    const intervalId = setInterval(tick, 1000)
    return () => clearInterval(intervalId)
  }, [imeiLinkState.lastRetryAt])

  const isMotionAlarmCode = useCallback((alarmCode) => {
    const normalized = String(alarmCode || '').trim()
    if (!normalized) return false
    return /\bno[-\s]?motion\b/i.test(normalized) || /\bmotion\b/i.test(normalized)
  }, [])

  const getDeviceMotionAlertDurationMs = useCallback((device) => {
    const candidates = [
      device?.motionDurationTime,
      device?.motion_duration_time,
      device?.motionAlertDuration,
      device?.motion_alert_duration,
      device?.settings?.motionDurationTime,
      device?.settings?.motion_duration_time,
      device?.config?.motionDurationTime,
      device?.config?.motion_duration_time,
      device?.advancedSettings?.motionDurationTime,
      device?.advancedSettings?.motion_duration_time
    ]

    for (const candidate of candidates) {
      const parsed = parseDurationToMs(candidate)
      if (parsed) return parsed
    }

    return DEFAULT_MOTION_ALERT_DURATION_MS
  }, [])

  const isConnectivityLog = useCallback((entry) => {
    const text = `${entry?.action || ''} ${entry?.alarmCode || ''} ${entry?.note || ''} ${entry?.source || ''}`.toLowerCase()
    return text.includes('connect') || text.includes('disconnect') || text.includes('online') || text.includes('offline')
  }, [])

  const matchesAlertFilter = useCallback((entry, filterValue) => {
    if (filterValue === 'all') return true

    const normalizedCode = String(entry?.alarmCode || '').trim().toLowerCase()
    if (filterValue.startsWith('code:')) return normalizedCode === filterValue.slice(5).toLowerCase()
    if (!normalizedCode) return filterValue === 'no-code'
    if (filterValue === 'sos') return normalizedCode.includes('sos')
    if (filterValue === 'fall') return normalizedCode.includes('fall')
    if (filterValue === 'other') return !normalizedCode.includes('sos') && !normalizedCode.includes('fall')
    return true
  }, [])

  const matchesConnectionFilter = useCallback((entry, filterValue) => {
    if (filterValue === 'all') return true

    const text = `${entry?.action || ''} ${entry?.alarmCode || ''} ${entry?.note || ''}`.toLowerCase()
    const source = String(entry?.source || '').toLowerCase()
    const isWebhookLog = source.includes('webhook')
    const isConnected = text.includes('connect') || text.includes('online')
    const isDisconnected = text.includes('disconnect') || text.includes('offline')

    if (filterValue === 'webhook-connected') return isWebhookLog && isConnected
    if (filterValue === 'webhook-disconnected') return isWebhookLog && isDisconnected
    if (filterValue === 'connected') return isConnected
    if (filterValue === 'disconnected') return isDisconnected
    return true
  }, [])

  const formatTimestamp = useCallback((value) => {
    if (!value) return '-'
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString()
  }, [])

  const formatAlertTimestamp = useCallback((value) => {
    if (!value) return 'Timestamp unavailable'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return 'Timestamp unavailable'
    return parsed.toLocaleString([], {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    })
  }, [])

  const normalizedRole = String(roleLabel(user?.userRole || user?.role || user?.user_role || 3)).toLowerCase()
  const isSuperAdmin = normalizedRole === 'qview admin'
  const isCompanyAdmin = normalizedRole === 'company admin'
  const isAdminDashboard = normalizedRole === 'qview admin' || normalizedRole === 'company admin'
  const currentUserId = useMemo(() => String(user?.id || user?.userId || user?.user_id || '').trim(), [user])
  const currentUserCompanyId = useMemo(() => String(user?.companyId || user?.company_id || '').trim(), [user])

  const resolveErrorLogField = useCallback((entry, keys = []) => {
    for (const key of keys) {
      const value = entry?.[key]
      if (value !== null && value !== undefined && String(value).trim()) return String(value).trim()
    }
    return ''
  }, [])
  useEffect(() => {
    if (activeSection !== 'bulk-sim') return
    if (isSuperAdmin) return
    setActiveSection('dashboard')
  }, [activeSection, isSuperAdmin])

  const locationDeviceOptions = useMemo(() => {
    if (isAdminDashboard) return devices

    const numericCurrentUserId = Number(user?.id || user?.userId || user?.user_id || 0)
    if (!numericCurrentUserId) return devices

    return devices.filter((device) => {
      const ownerId = Number(device.ownerUserId || device.userId || device.user_id || device.owner?.id || device.app_user?.id || 0)
      return ownerId === numericCurrentUserId
    })
  }, [devices, isAdminDashboard, user])

  const errorRangeOptions = useMemo(() => ([
    { value: '24h', label: 'Last 24 hours', windowMs: 24 * 60 * 60 * 1000 },
    { value: '7d', label: 'Last 7 days', windowMs: 7 * 24 * 60 * 60 * 1000 },
    { value: '30d', label: 'Last 30 days', windowMs: 30 * 24 * 60 * 60 * 1000 }
  ]), [])

  const roleScopedErrorLogs = useMemo(() => {
    if (isSuperAdmin) return errorLogs

    const resolveCompanyId = (entry) => resolveErrorLogField(entry, ['companyId', 'company_id', 'companyID'])
    const resolveLocationId = (entry) => resolveErrorLogField(entry, ['locationId', 'location_id', 'locationID'])
    const resolveUserId = (entry) => resolveErrorLogField(entry, ['userId', 'user_id', 'ownerUserId', 'owner_user_id', 'actorUserId', 'actor_user_id'])

    if (isCompanyAdmin) {
      const allowedLocationIds = new Set(
        locations
          .filter((location) => String(location.companyId || location.company_id || '') === currentUserCompanyId)
          .map((location) => String(location.id || location.locationId || location.location_id || '').trim())
          .filter(Boolean)
      )

      const allowedUserIds = new Set(
        users
          .filter((entry) => String(entry.companyId || entry.company_id || '') === currentUserCompanyId)
          .map((entry) => String(entry.id || entry.userId || entry.user_id || '').trim())
          .filter(Boolean)
      )

      return errorLogs.filter((entry) => {
        const companyId = resolveCompanyId(entry)
        const locationId = resolveLocationId(entry)
        const userId = resolveUserId(entry)
        if (companyId && companyId === currentUserCompanyId) return true
        if (locationId && allowedLocationIds.has(locationId)) return true
        if (userId && allowedUserIds.has(userId)) return true
        return false
      })
    }

    return errorLogs.filter((entry) => {
      const userId = resolveUserId(entry)
      if (!currentUserId) return false
      return userId === currentUserId
    })
  }, [currentUserCompanyId, currentUserId, errorLogs, isCompanyAdmin, isSuperAdmin, locations, resolveErrorLogField, users])

  const recentErrorLogs = useMemo(() => {
    const selectedOption = errorRangeOptions.find((entry) => entry.value === errorLogRange) || errorRangeOptions[0]
    const earliestTimestamp = Date.now() - selectedOption.windowMs
    return roleScopedErrorLogs.filter((entry) => {
      const occurredAt = new Date(entry?.occurredAt || 0).getTime()
      return Number.isFinite(occurredAt) && occurredAt >= earliestTimestamp
    })
  }, [errorLogRange, errorRangeOptions, roleScopedErrorLogs])

  const errorLogFilterOptions = useMemo(() => {
    const scopedCompanies = isSuperAdmin
      ? companies
      : companies.filter((entry) => String(entry.id || '') === currentUserCompanyId)
    const scopedLocations = isSuperAdmin
      ? locations
      : locations.filter((entry) => String(entry.companyId || entry.company_id || '') === currentUserCompanyId)
    const scopedUsers = isSuperAdmin
      ? users
      : (isCompanyAdmin
          ? users.filter((entry) => String(entry.companyId || entry.company_id || '') === currentUserCompanyId)
          : users.filter((entry) => String(entry.id || entry.userId || entry.user_id || '') === currentUserId))

    const companyScopedLocations = errorLogCompanyFilter === 'all'
      ? scopedLocations
      : scopedLocations.filter((entry) => String(entry.companyId || entry.company_id || '') === errorLogCompanyFilter)

    const locationScopedUsers = errorLogLocationFilter === 'all'
      ? scopedUsers
      : scopedUsers.filter((entry) => String(entry.locationId || entry.location_id || '') === errorLogLocationFilter)
    const companyAndLocationScopedUsers = errorLogCompanyFilter === 'all'
      ? locationScopedUsers
      : locationScopedUsers.filter((entry) => String(entry.companyId || entry.company_id || '') === errorLogCompanyFilter)

    return {
      companies: scopedCompanies.map((entry) => ({ id: String(entry.id || ''), label: entry.companyName || entry.company_name || entry.name || `Company ${entry.id}` })).filter((entry) => entry.id),
      locations: companyScopedLocations.map((entry) => ({ id: String(entry.id || entry.locationId || entry.location_id || ''), label: entry.name || `Location ${entry.id}` })).filter((entry) => entry.id),
      users: companyAndLocationScopedUsers.map((entry) => ({ id: String(entry.id || entry.userId || entry.user_id || ''), label: `${entry.firstName || ''} ${entry.lastName || ''}`.trim() || entry.email || `User ${entry.id}` })).filter((entry) => entry.id)
    }
  }, [companies, currentUserCompanyId, currentUserId, errorLogCompanyFilter, errorLogLocationFilter, isCompanyAdmin, isSuperAdmin, locations, users])

  const filteredErrorLogs = useMemo(() => {
    const resolveCompanyId = (entry) => resolveErrorLogField(entry, ['companyId', 'company_id', 'companyID'])
    const resolveLocationId = (entry) => resolveErrorLogField(entry, ['locationId', 'location_id', 'locationID'])
    const resolveUserId = (entry) => resolveErrorLogField(entry, ['userId', 'user_id', 'ownerUserId', 'owner_user_id', 'actorUserId', 'actor_user_id'])

    return recentErrorLogs.filter((entry) => {
      if (errorLogCompanyFilter !== 'all' && resolveCompanyId(entry) !== errorLogCompanyFilter) return false
      if (errorLogLocationFilter !== 'all' && resolveLocationId(entry) !== errorLogLocationFilter) return false
      if (errorLogUserFilter !== 'all' && resolveUserId(entry) !== errorLogUserFilter) return false
      return true
    })
  }, [errorLogCompanyFilter, errorLogLocationFilter, errorLogUserFilter, recentErrorLogs, resolveErrorLogField])

  useEffect(() => {
    if (errorLogCompanyFilter !== 'all' && !errorLogFilterOptions.companies.some((entry) => entry.id === errorLogCompanyFilter)) {
      setErrorLogCompanyFilter('all')
    }
    if (errorLogLocationFilter !== 'all' && !errorLogFilterOptions.locations.some((entry) => entry.id === errorLogLocationFilter)) {
      setErrorLogLocationFilter('all')
    }
    if (errorLogUserFilter !== 'all' && !errorLogFilterOptions.users.some((entry) => entry.id === errorLogUserFilter)) {
      setErrorLogUserFilter('all')
    }
  }, [errorLogCompanyFilter, errorLogFilterOptions, errorLogLocationFilter, errorLogUserFilter])

  useEffect(() => {
    if (isSuperAdmin || isCompanyAdmin) return
    if (!currentUserId) return
    setErrorLogUserFilter(currentUserId)
  }, [currentUserId, isCompanyAdmin, isSuperAdmin])

  const metrics = useMemo(
    () => [
      { label: 'TOTAL COMPANIES', value: companies.length, icon: 'company', section: 'companies' },
      { label: 'TOTAL USERS', value: users.length, icon: 'users', section: 'users' },
      { label: 'TOTAL DEVICES', value: devices.length, icon: 'devices', section: 'devices' },
      { label: 'TOTAL LOCATIONS', value: locations.length, icon: 'location', section: 'locations' },
      { label: 'ERROR LOGS', value: roleScopedErrorLogs.length, icon: 'warning', section: 'error-logs', hasRangeControl: true }
    ],
    [companies.length, users.length, devices.length, locations.length, roleScopedErrorLogs.length]
  )

  const toggle = (key) => setConfigForm((prev) => ({ ...prev, [key]: !prev[key] }))

  const getContacts = (form) => {
    if (Array.isArray(form.contacts) && form.contacts.length) return form.contacts.slice(0, 1)

    return [{
      slot: 1,
      name: form.contactName || '',
      phone: form.contactNumber || '',
      smsEnabled: form.contactSmsEnabled !== false,
      callEnabled: form.contactCallEnabled !== false
    }]
  }

  const updateContacts = (updater) => {
    setConfigForm((prev) => {
      const baseContacts = getContacts(prev)
      const updatedContacts = updater(baseContacts)
        .slice(0, 1)
        .map((contact, index) => ({
          slot: index + 1,
          name: contact.name || '',
          phone: contact.phone || '',
          smsEnabled: contact.smsEnabled !== false,
          callEnabled: contact.callEnabled !== false
        }))

      const primaryContact = updatedContacts.find((contact) => contact.phone.trim()) || updatedContacts[0] || {
        name: '',
        phone: '',
        smsEnabled: true,
        callEnabled: true
      }

      return {
        ...prev,
        contacts: updatedContacts,
        contactSlot: primaryContact.slot || 1,
        contactName: primaryContact.name,
        contactNumber: primaryContact.phone,
        contactSmsEnabled: primaryContact.smsEnabled,
        contactCallEnabled: primaryContact.callEnabled
      }
    })
  }

  const getAuthorizedNumbers = (form) => {
    if (Array.isArray(form.authorizedNumbers) && form.authorizedNumbers.length) {
      return form.authorizedNumbers.slice(0, 10).map((value) => String(value || ''))
    }

    const primaryPhone = getContacts(form)[0]?.phone || ''
    return [primaryPhone]
  }

  const updateAuthorizedNumbers = (updater) => {
    setConfigForm((prev) => {
      const nextAuthorizedNumbers = updater(getAuthorizedNumbers(prev))
        .slice(0, 10)
        .map((value) => String(value || ''))

      return {
        ...prev,
        authorizedNumbers: nextAuthorizedNumbers
      }
    })
  }



  const asCollection = useCallback((payload, keys = []) => {
    if (Array.isArray(payload)) return payload

    for (const key of keys) {
      if (Array.isArray(payload?.[key])) return payload[key]
    }

    if (Array.isArray(payload?.content)) return payload.content
    if (Array.isArray(payload?.data)) return payload.data
    if (Array.isArray(payload?.items)) return payload.items
    return []
  }, [])

  const fetchJson = useCallback(
    async (url, options = {}) => {
      return fetchJsonWithFallback(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: authToken } : {}),
          ...(options.headers || {})
        }
      })
    },
    [authToken]
  )

  const loadUsers = useCallback(async () => {
    const data = await fetchJson('/api/users', { headers: {} })
    setUsers(asCollection(data, ['users']))
  }, [asCollection, fetchJson])

  const loadCompanies = useCallback(async () => {
    const data = await fetchJson('/api/companies', { headers: {} })
    setCompanies(asCollection(data, ['companies']))
  }, [asCollection, fetchJson])

  const loadLocations = useCallback(async () => {
    const data = await fetchJson('/api/locations', { headers: {} })
    setLocations(asCollection(data, ['locations']))
  }, [asCollection, fetchJson])

  const loadDevices = useCallback(async () => {
    try {
      const data = await fetchJson('/api/devices', { headers: {} })
      const directDevices = asCollection(data, ['devices'])
      if (directDevices.length) {
        setDevices(directDevices)
        return
      }
    } catch {
      // Fallback below via users endpoint.
    }

    const data = await fetchJson('/api/users', { headers: {} })
    const usersList = asCollection(data, ['users'])
    const flattened = usersList.flatMap((user) =>
      Array.isArray(user.devices) ? user.devices.map((device) => ({ ...device, owner: user })) : []
    )
    setDevices(flattened)
  }, [asCollection, fetchJson])

  const loadLookups = useCallback(async () => {
    const [managersResult, roleUsersResult, mobileUsersResult, superAdminsResult, companiesResult, locationsResult, alertsResult, alertLogsResult] = await Promise.allSettled([
      fetchJson('/api/lookups/company-admins', { headers: {} }),
      fetchJson('/api/lookups/portal-users', { headers: {} }),
      fetchJson('/api/lookups/mobile-users', { headers: {} }),
      fetchJson('/api/lookups/super-admins', { headers: {} }),
      fetchJson('/api/lookups/companies', { headers: {} }),
      fetchJson('/api/lookups/locations', { headers: {} }),
      fetchJson('/api/lookups/alerts', { headers: {} }),
      fetchJson('/api/lookups/alert-logs', { headers: {} })
    ])

    setManagerLookupUsers(
      managersResult.status === 'fulfilled' ? asCollection(managersResult.value, ['users']) : []
    )
    setRoleUserLookupUsers(
      roleUsersResult.status === 'fulfilled' ? asCollection(roleUsersResult.value, ['users']) : []
    )
    setMobileUserLookupUsers(
      mobileUsersResult.status === 'fulfilled' ? asCollection(mobileUsersResult.value, ['users']) : []
    )
    setSuperAdminLookupUsers(
      superAdminsResult.status === 'fulfilled' ? asCollection(superAdminsResult.value, ['users']) : []
    )
    setCompanyLookupRows(
      companiesResult.status === 'fulfilled' ? asCollection(companiesResult.value, ['companies']) : []
    )
    setLocationLookupRows(
      locationsResult.status === 'fulfilled' ? asCollection(locationsResult.value, ['locations']) : []
    )
    setAlertLookupCodes(
      alertsResult.status === 'fulfilled' && Array.isArray(alertsResult.value)
        ? alertsResult.value
        : []
    )
    setAlertLogLookupFilters(
      alertLogsResult.status === 'fulfilled' && alertLogsResult.value && typeof alertLogsResult.value === 'object'
        ? {
            alarmCodes: Array.isArray(alertLogsResult.value.alarmCodes) ? alertLogsResult.value.alarmCodes : [],
            actions: Array.isArray(alertLogsResult.value.actions) ? alertLogsResult.value.actions : [],
            sources: Array.isArray(alertLogsResult.value.sources) ? alertLogsResult.value.sources : []
          }
        : { alarmCodes: [], actions: [], sources: [] }
    )
  }, [asCollection, fetchJson])

  const loadAlarmLogs = useCallback(async () => {
    if (!locationDeviceOptions.length) {
      setAlarmLogs([])
      setAlarmLogsStatus('No devices available to load alarm logs.')
      return
    }

    setAlarmLogsStatus('Loading alarm logs for all devices...')
    try {
      const responses = await Promise.all(
        locationDeviceOptions.map(async (device) => {
          const deviceId = String(device.id || device.deviceId || '').trim()
          if (!deviceId) return { rows: [], failed: false }

          try {
            const payload = await fetchJson(`/api/devices/${deviceId}/alarm-logs`, { headers: {} })
            const rows = asCollection(payload, ['alarmLogs', 'logs']).map((entry) => ({
              ...entry,
              deviceId,
              deviceName: device.name || device.deviceName || `Device ${deviceId}`,
              locationId: String(device.locationId || device.location_id || ''),
              locationName: device.locationName || ''
            }))
            return { rows, failed: false }
          } catch {
            return { rows: [], failed: true }
          }
        })
      )

      const rows = responses.flatMap((entry) => entry.rows)
      const failedCount = responses.filter((entry) => entry.failed).length
      const sortedRows = [...rows].sort((a, b) => new Date(b.eventAt || 0).getTime() - new Date(a.eventAt || 0).getTime())
      setAlarmLogs(sortedRows)

      const connectivityCount = rows.filter((entry) => isConnectivityLog(entry)).length
      const alarmEventCount = rows.length - connectivityCount

      if (!rows.length && !failedCount) {
        setAlarmLogsStatus('No alarm logs recorded for available devices.')
      } else if (failedCount) {
        setAlarmLogsStatus(`Showing ${alarmEventCount} alarm entr${alarmEventCount === 1 ? 'y' : 'ies'} and ${connectivityCount} connectivity entr${connectivityCount === 1 ? 'y' : 'ies'}. ${failedCount} device log source${failedCount === 1 ? '' : 's'} could not be loaded.`)
      } else {
        setAlarmLogsStatus(`Showing ${alarmEventCount} alarm entr${alarmEventCount === 1 ? 'y' : 'ies'} and ${connectivityCount} connectivity entr${connectivityCount === 1 ? 'y' : 'ies'} across all devices.`)
      }
    } catch (error) {
      setAlarmLogs([])
      setAlarmLogsStatus(`Failed to load alarm logs: ${error.message}`)
    }
  }, [asCollection, fetchJson, isConnectivityLog, locationDeviceOptions])

  const loadErrorLogs = useCallback(async () => {
    setErrorLogsStatus('Loading backend error logs...')
    try {
      const payload = await fetchJson('/api/error-logs?limit=150', { headers: {} })
      const rows = asCollection(payload, ['errorLogs', 'logs'])
      const sortedRows = [...rows].sort((a, b) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime())
      setErrorLogs(sortedRows)
      setErrorLogsStatus(sortedRows.length ? `${sortedRows.length} backend error log entr${sortedRows.length === 1 ? 'y' : 'ies'}.` : 'No backend errors recorded yet.')
    } catch (error) {
      setErrorLogs([])
      setErrorLogsStatus(`Failed to load backend error logs: ${error.message}`)
    }
  }, [asCollection, fetchJson])

  const loadAuthLogs = useCallback(async () => {
    setAuthLogsStatus('Loading auth audit trail...')
    try {
      const suffix = currentUserId ? `?userId=${encodeURIComponent(currentUserId)}` : ''
      const payload = await fetchJson(`/api/auth/logs${suffix}`, { headers: {} })
      const rows = asCollection(payload, ['logs', 'authLogs', 'loginLogs'])
      const sortedRows = [...rows].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      setAuthLogs(sortedRows)
      setAuthLogsStatus(sortedRows.length ? `${sortedRows.length} auth log entr${sortedRows.length === 1 ? 'y' : 'ies'} loaded.` : 'No auth audit events yet.')
    } catch (error) {
      setAuthLogs([])
      setAuthLogsStatus(`Failed to load auth audit trail: ${error.message}`)
    }
  }, [asCollection, currentUserId, fetchJson])

  const loadLocationBreadcrumbs = useCallback(async (deviceId) => {
    if (!deviceId) {
      setLocationBreadcrumbs([])
      setLocationBreadcrumbsStatus('Select a device to load breadcrumbs.')
      return
    }

    setLocationBreadcrumbsStatus('Loading breadcrumbs...')
    try {
      const payload = await fetchJson(`/api/devices/${deviceId}/location-breadcrumbs`, { headers: {} })
      const rows = asCollection(payload, ['breadcrumbs', 'locationBreadcrumbs'])
      setLocationBreadcrumbs(rows)
      setLocationBreadcrumbsStatus(rows.length ? `Showing ${rows.length} breadcrumb point${rows.length === 1 ? '' : 's'}.` : 'No breadcrumb history for this device yet.')
    } catch (error) {
      setLocationBreadcrumbs([])
      setLocationBreadcrumbsStatus(`Failed to load breadcrumbs: ${error.message}`)
    }
  }, [asCollection, fetchJson])

  useEffect(() => {
    const load = async () => {
      try {
        const needsLookups =
          activeSection === 'companies' ||
          activeSection === 'users' ||
          activeSection === 'user-detail' ||
          activeSection === 'locations' ||
          activeSection === 'location-detail' ||
          activeSection === 'devices' ||
          activeSection === 'alarm-logs' ||
          activeSection === 'auth-logs' ||
          activeSection === 'error-logs' ||
          isDeviceDetailSection(activeSection)

        if (needsLookups) await loadLookups()

        if (activeSection === 'companies') await loadCompanies()
        if (activeSection === 'users' || activeSection === 'user-detail') await loadUsers()
        if (activeSection === 'locations' || activeSection === 'location-detail') await loadLocations()
        if (activeSection === 'devices' || activeSection === 'bulk-sim' || isDeviceDetailSection(activeSection)) await loadDevices()
        if (activeSection === 'dashboard') {
          await Promise.all([loadCompanies(), loadUsers(), loadLocations(), loadDevices(), loadErrorLogs()])
        }
        if (activeSection === 'error-logs') await loadErrorLogs()
        if (activeSection === 'auth-logs') await loadAuthLogs()
        if (activeSection === 'user-detail' || activeSection === 'location-detail') {
          await loadDevices()
        }
        setDataStatus('')
      } catch (error) {
        setDataStatus(`Data fetch failed: ${error.message}`)
      }
    }

    load()
  }, [activeSection, loadCompanies, loadUsers, loadLocations, loadDevices, loadLookups, loadErrorLogs, loadAuthLogs])

  useEffect(() => {
    if (activeSection !== 'replies' || !autoFetchReplies) return undefined

    fetchReplies()
    const intervalId = setInterval(() => {
      fetchReplies()
    }, 5000)

    return () => clearInterval(intervalId)
  }, [activeSection, autoFetchReplies, fetchReplies])

  const webhookHeaders = useMemo(
    () => ({
      ...(authToken ? { Authorization: authToken } : {}),
      ...(gatewayToken ? { 'X-Gateway-Token': gatewayToken, 'X-Webhook-Token': gatewayToken } : {})
    }),
    [authToken, gatewayToken]
  )

  const loadWebhookEvents = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setWebhookStatus('Loading webhook events...')

    const suffix = webhookLimit === 'all' ? '' : `?limit=${webhookLimit}`
    const endpoints = [`/api/webhooks/ev12/events${suffix}`, `https://ev12-backend-dev.mangoisland-fc3c6273.australiaeast.azurecontainerapps.io/api/webhooks/ev12/events${suffix}`]
    let payload = null
    let lastError = null

    for (const endpoint of endpoints) {
      try {
        const { response } = await fetchWithFallback(endpoint, {
          headers: webhookHeaders
        })

        const body = await response.json().catch(() => ([]))
        if (!response.ok) throw new Error(body.error || body.message || `Failed ${endpoint}`)
        payload = body
        break
      } catch (error) {
        lastError = error
      }
    }

    if (!payload) {
      setWebhookStatus(`Webhook fetch failed: ${lastError?.message || 'Unknown error'}`)
      setWebhookRaw(null)
      webhookFingerprintRef.current = ''
      return
    }

    const getEventTime = (event) => new Date(event?.receivedAt || event?.timestamp || event?.createdAt || event?.date || 0).getTime()
    const incomingEvents = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload?.events) ? payload.events : [payload])
    const previousEvents = parseStoredWebhookEvents()
    const mergedEvents = [...incomingEvents, ...previousEvents]
      .sort((a, b) => getEventTime(b) - getEventTime(a))
      .filter((event, index, all) => {
        const key = JSON.stringify(event)
        return all.findIndex((candidate) => JSON.stringify(candidate) === key) === index
      })

    persistWebhookEvents(mergedEvents)

    const nextFingerprint = JSON.stringify(mergedEvents)
    const hadPrevious = webhookFingerprintRef.current !== ''
    const hasNewEvent = hadPrevious && webhookFingerprintRef.current !== nextFingerprint

    webhookFingerprintRef.current = nextFingerprint
    setWebhookRaw(mergedEvents)
    setWebhookStatus(hasNewEvent
      ? `New webhook event received. Showing ${mergedEvents.length} saved webhook event(s).`
      : (mergedEvents.length
        ? `Showing ${mergedEvents.length} saved webhook event(s).`
        : 'No webhook events fetched yet.'))
  }, [webhookHeaders, webhookLimit])

  useEffect(() => {
    const storedEvents = parseStoredWebhookEvents()
    if (!storedEvents.length) return

    webhookFingerprintRef.current = JSON.stringify(storedEvents)
    setWebhookRaw(storedEvents)
    setWebhookStatus(`Loaded ${storedEvents.length} webhook event(s) from local storage.`)
  }, [])

  useEffect(() => {
    if (activeSection === 'webhooks') {
      loadWebhookEvents()
    }
  }, [activeSection, loadWebhookEvents])

  useEffect(() => {
    if (activeSection !== 'webhooks') return undefined

    const intervalId = setInterval(() => {
      loadWebhookEvents({ silent: true })
    }, 2000)

    return () => clearInterval(intervalId)
  }, [activeSection, loadWebhookEvents])

  useEffect(() => {
    if (activeSection !== 'alarm-logs') return
    if (!devices.length) {
      loadDevices()
      return
    }
    loadAlarmLogs()
  }, [activeSection, devices.length, loadAlarmLogs, loadDevices])



  const clearWebhookEvents = useCallback(async () => {
    if (clearingWebhookEvents) return

    setClearingWebhookEvents(true)
    setWebhookStatus('Clearing webhook events...')

    const endpoints = ['/api/webhooks/ev12/events', 'https://ev12-backend-dev.mangoisland-fc3c6273.australiaeast.azurecontainerapps.io/api/webhooks/ev12/events']
    let deletedCount = 0
    let lastError = null

    try {
      for (const endpoint of endpoints) {
        try {
          const { response } = await fetchWithFallback(endpoint, {
            method: 'DELETE',
            headers: webhookHeaders
          })

          const body = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(body.error || body.message || `Failed ${endpoint}`)

          deletedCount = Number(body.deleted) || 0
          webhookFingerprintRef.current = ''
          persistWebhookEvents([])
          setWebhookRaw([])
          setWebhookStatus(`Webhook events cleared. Deleted ${deletedCount} event(s).`)
          return
        } catch (error) {
          lastError = error
        }
      }

      setWebhookStatus(`Unable to clear webhook events: ${lastError?.message || 'Unknown error'}`)
    } finally {
      setClearingWebhookEvents(false)
    }
  }, [webhookHeaders, clearingWebhookEvents])

  const formatWebhookLabel = useCallback((value) => {
    if (!value) return 'Unknown event'
    return String(value)
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }, [])

  const webhookSummary = useCallback((event, index) => {
    const parts = splitWebhookParts(event)
    const eventType =
      event?.event ||
      event?.eventType ||
      event?.type ||
      event?.payload?.event ||
      event?.payload?.type ||
      event?.rawEvent?.event ||
      event?.rawEvent?.type

    const source =
      event?.source ||
      event?.provider ||
      event?.payload?.source ||
      event?.rawEvent?.source ||
      event?.headers?.['x-forwarded-host'] ||
      event?.headers?.host

    const phoneValue =
      event?.phone ||
      event?.msisdn ||
      event?.payload?.phone ||
      event?.payload?.msisdn ||
      event?.rawEvent?.phone ||
      event?.rawEvent?.msisdn ||
      event?.payload?.contact?.phone

    return {
      parts,
      title: formatWebhookLabel(eventType),
      source: source || 'EV12 Webhook',
      phone: phoneValue || null,
      id: event?.id || event?._id || event?.messageId || event?.payload?.messageId || `event-${index + 1}`
    }
  }, [formatWebhookLabel])

  const hydrateDeviceWorkspace = useCallback((device, { announceLoaded = false } = {}) => {
    if (!device || typeof device !== 'object') return

    const protocolSettingsCandidate =
      (device?.protocolSettings && typeof device.protocolSettings === 'object' ? device.protocolSettings : null) ||
      (device?.protocol_settings && typeof device.protocol_settings === 'object' ? device.protocol_settings : null) ||
      (device?.settings && typeof device.settings === 'object' ? device.settings : null) ||
      (device?.config && typeof device.config === 'object' ? device.config : null)

    const protocolSettings = normalizeProtocolSettingsForForm(protocolSettingsCandidate || {})
    const baseConfigForm = { ...initialConfigForm }

    setSelectedDevice(device)
    const seededContacts = Array.isArray(protocolSettings.contacts) && protocolSettings.contacts.length
      ? protocolSettings.contacts.slice(0, 1)
      : [...getContacts(baseConfigForm)]

    const primaryName = device.ownerName || device.owner?.firstName || protocolSettings.contactName || seededContacts[0]?.name || baseConfigForm.contactName
    const primaryPhone = device.phoneNumber || protocolSettings.contactNumber || seededContacts[0]?.phone || baseConfigForm.contactNumber

    seededContacts[0] = {
      slot: 1,
      name: primaryName || '',
      phone: primaryPhone || '',
      smsEnabled: seededContacts[0]?.smsEnabled !== false,
      callEnabled: seededContacts[0]?.callEnabled !== false
    }

    const normalizedGeoFences = buildGeoFencesFromForm({
      ...baseConfigForm,
      ...protocolSettings
    })

    const nextConfigForm = {
      ...baseConfigForm,
      ...protocolSettings,
      deviceId: device.id || device.deviceId || baseConfigForm.deviceId,
      imei: device.imei || protocolSettings.imei || baseConfigForm.imei,
      prefixName: device.name || device.deviceName || protocolSettings.prefixName || baseConfigForm.prefixName,
      contacts: seededContacts.slice(0, 1),
      authorizedNumbers: resolveAuthorizedNumbers(protocolSettings, primaryPhone),
      wifiEnabled: String(
        protocolSettings.wifiEnabled
        ?? protocolSettings.wifi_enabled
        ?? protocolSettings.wifiPositioning
        ?? protocolSettings.wifi_positioning
        ?? baseConfigForm.wifiEnabled
      ) === '1' || protocolSettings.wifiPositioning === true || protocolSettings.wifi_positioning === true
        ? '1'
        : '0',
      contactSlot: protocolSettings.contactSlot || 1,
      contactNumber: primaryPhone || '',
      contactName: primaryName || '',
      geoFenceCount: String(normalizedGeoFences.length),
      geoFences: normalizedGeoFences,
      geoFenceEnabled: normalizedGeoFences[0]?.enabled ?? baseConfigForm.geoFenceEnabled,
      geoFenceMode: normalizedGeoFences[0]?.mode ?? baseConfigForm.geoFenceMode,
      geoFenceRadius: normalizedGeoFences[0]?.radius ?? baseConfigForm.geoFenceRadius
    }

    setConfigForm(nextConfigForm)
    setConfigBaseline(nextConfigForm)
    setSelectedGeoFenceSlot(1)
    const nextDeviceId = device.id || device.deviceId || null
    setEditingDeviceId(nextDeviceId)
    setSelectedDeviceId(nextDeviceId ? String(nextDeviceId) : '')
    setDeviceForm({
      name: device.name || device.deviceName || '',
      phoneNumber: device.phoneNumber || '',
      eviewVersion: device.eviewVersion || device.version || '',
      ownerUserId: device.ownerUserId || device.userId || device.user_id || device.owner?.id || device.app_user?.id || '',
      locationId: device.locationId || device.location_id || '',
      externalDeviceId: device.externalDeviceId || device.external_device_id || device.deviceId || '',
      simIccid: device.simIccid || ''
    })

    if (announceLoaded) {
      setActionStatus((prev) => (prev.type === 'error' ? prev : { type: 'success', message: 'Device workspace loaded.' }))
    }
  }, [getContacts, setConfigBaseline, setConfigForm])

  const openDeviceSettings = async (device) => {
    setDeviceWorkspaceLoading(true)
    try {
      const selectedDeviceId = Number(device?.id || device?.deviceId)
      let resolvedDevice = device

      if (Number.isInteger(selectedDeviceId) && selectedDeviceId > 0) {
        setActionStatus({ type: 'info', message: 'Loading latest device configuration...' })
        try {
          resolvedDevice = await fetchJson(`/api/devices/${selectedDeviceId}`, { headers: {} })
        } catch (error) {
          setActionStatus({ type: 'error', message: `Could not refresh device data, using cached row values: ${error.message}` })
        }
      }

      hydrateDeviceWorkspace(resolvedDevice, { announceLoaded: true })
      setActiveSection('device-detail-overview')
    } finally {
      setDeviceWorkspaceLoading(false)
    }
  }

  useEffect(() => {
    if (!isDeviceDetailSection(activeSection)) return
    if (!selectedDeviceId) return

    const hasSelectedDevice = String(selectedDevice?.id || selectedDevice?.deviceId || '') === String(selectedDeviceId)
    if (hasSelectedDevice) return

    const localMatch = devices.find((device) => String(device.id || device.deviceId || '') === String(selectedDeviceId))
    if (localMatch) {
      hydrateDeviceWorkspace(localMatch)
    }

    let cancelled = false
    const loadDeviceFromRoute = async () => {
      try {
        const resolvedDevice = await fetchJson(`/api/devices/${selectedDeviceId}`, { headers: {} })
        if (cancelled) return
        hydrateDeviceWorkspace(resolvedDevice)
      } catch (error) {
        if (cancelled) return
        setActionStatus({ type: 'error', message: `Could not load selected device from URL: ${error.message}` })
      }
    }
    loadDeviceFromRoute()

    return () => {
      cancelled = true
    }
  }, [activeSection, devices, fetchJson, hydrateDeviceWorkspace, selectedDevice, selectedDeviceId])

  const handleCreateLocation = async () => {
    try {
      if (!locationForm.name.trim()) throw new Error('Location name is required')
      if (!locationForm.companyId) throw new Error('Company is required')
      await fetchJson('/api/locations', {
        method: 'POST',
        body: JSON.stringify({
          name: locationForm.name.trim(),
          details: locationForm.details.trim(),
          companyId: Number(locationForm.companyId)
        })
      })
      setActionStatus({ type: 'success', message: 'Location created successfully.' })
      setLocationForm(initialLocationForm)
      setShowLocationModal(false)
      await loadLocations()
    } catch (error) {
      setActionStatus({ type: 'error', message: `Create location failed: ${error.message}` })
    }
  }

  const handleCreateCompany = async () => {
    try {
      const normalizedCompanyName = (companyForm.companyName || '').trim()
      if (!normalizedCompanyName) throw new Error('Company name is required')
      await fetchJson('/api/companies', {
        method: 'POST',
        body: JSON.stringify({
          companyName: normalizedCompanyName,
          name: normalizedCompanyName,
          details: companyForm.details.trim(),
          address: companyForm.address.trim(),
          city: companyForm.city.trim(),
          state: companyForm.state.trim(),
          postalCode: companyForm.postalCode.trim(),
          country: companyForm.country.trim(),
          phone: companyForm.phone.trim(),
          isAlarmReceiverIncluded: Boolean(companyForm.isAlarmReceiverIncluded)
        })
      })
      setActionStatus({ type: 'success', message: 'Company created successfully.' })
      setCompanyForm(initialCompanyForm)
      setShowCompanyModal(false)
      await Promise.all([loadCompanies(), loadLookups()])
    } catch (error) {
      setActionStatus({ type: 'error', message: `Create company failed: ${error.message}` })
    }
  }

  const handleCreateUser = async () => {
    try {
      if (!userForm.email.trim() || !userForm.password.trim()) throw new Error('Email and password are required')
      if ([2, 3, 4].includes(Number(userForm.userRole)) && !userForm.companyId) throw new Error('Company is required for this role')
      const payload = {
        ...userForm,
        userRole: Number(userForm.userRole),
        companyId: userForm.companyId ? Number(userForm.companyId) : null,
        locationId: userForm.locationId ? Number(userForm.locationId) : null
      }

      try {
        await fetchJson('/api/users', { method: 'POST', body: JSON.stringify(payload) })
      } catch {
        await fetchJson('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) })
      }

      setActionStatus({ type: 'success', message: 'User created successfully.' })
      setUserForm(initialUserForm)
      setShowUserModal(false)
      await loadUsers()
    } catch (error) {
      setActionStatus({ type: 'error', message: `Create user failed: ${error.message}` })
    }
  }

  const pollForDeviceImei = useCallback(async (deviceId) => {
    if (!deviceId) return null
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const refreshed = await fetchJson(`/api/devices/${deviceId}`, { headers: {} })
      const resolvedExternalId = String(refreshed?.externalDeviceId || refreshed?.external_device_id || refreshed?.deviceId || '').trim()
      if (resolvedExternalId) return { device: refreshed, externalDeviceId: resolvedExternalId }
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
    return null
  }, [])

  const handleImeiResend = useCallback(async (deviceId, { showGlobalStatus = false } = {}) => {
    if (!deviceId) throw new Error('Device id is missing')
    if (imeiRetryCooldownSeconds > 0) {
      setImeiLinkState((prev) => ({ ...prev, status: `Manual retry available in ${imeiRetryCooldownSeconds}s.` }))
      return null
    }
    setImeiLinkState((prev) => ({
      ...prev,
      resendPending: true,
      status: 'Sending IMEI request (V?)…',
      waitStartedAt: prev.waitStartedAt || new Date().toISOString(),
      lastRetryAt: new Date().toISOString()
    }))
    try {
      const payload = await fetchJson(`/api/devices/${deviceId}/imei-resend`, { method: 'POST' })
      setImeiLinkState((prev) => ({ ...prev, resendPending: false, status: `Retry sent at ${payload?.sentAt || 'just now'}. Waiting for IMEI link…`, waitStartedAt: prev.waitStartedAt || new Date().toISOString() }))
      if (showGlobalStatus) {
        setActionStatus({ type: 'success', message: 'Manual IMEI resend sent successfully.' })
      }
      return payload
    } catch (error) {
      setImeiLinkState((prev) => ({ ...prev, resendPending: false, status: `Retry failed: ${error.message}` }))
      if (showGlobalStatus) {
        setActionStatus({ type: 'error', message: `Manual IMEI resend failed: ${error.message}` })
      }
      throw error
    }
  }, [imeiRetryCooldownSeconds])

  const syncDeviceRecord = useCallback((deviceId, nextValues) => {
    if (!deviceId || !nextValues) return
    setDevices((prev) => prev.map((entry) => {
      const entryId = entry?.id || entry?.deviceId
      if (String(entryId || '') !== String(deviceId)) return entry
      return { ...entry, ...nextValues }
    }))
    setSelectedDevice((prev) => {
      if (!prev) return prev
      const selectedId = prev?.id || prev?.deviceId
      if (String(selectedId || '') !== String(deviceId)) return prev
      return { ...prev, ...nextValues }
    })
  }, [])

  const activateDeviceSim = useCallback(async (deviceId, { refreshDevices = false } = {}) => {
    if (!deviceId) throw new Error('Device id is missing')
    const response = await fetchJson(`/api/devices/${deviceId}/sim/activate`, { method: 'POST' })
    const status = String(response?.status || '').trim()
    const activated = response?.activated === true || status.toUpperCase() === 'ACTIVATED'
    const mergedStatus = {
      simActivated: activated,
      simStatus: status || (activated ? 'ACTIVATED' : null),
      simStatusUpdatedAt: response?.updatedAt || new Date().toISOString()
    }
    syncDeviceRecord(deviceId, mergedStatus)
    if (refreshDevices) await loadDevices()
    return response
  }, [fetchJson, loadDevices, syncDeviceRecord])

  const handleCreateDevice = async () => {
    try {
      if (!deviceForm.ownerUserId) throw new Error('Owner user is required')
      if (!deviceForm.name.trim() || !deviceForm.phoneNumber.trim()) throw new Error('Device name and phone number are required')
      if (!deviceForm.eviewVersion.trim()) throw new Error('Device version is required')

      const payload = {
        name: deviceForm.name.trim(),
        phoneNumber: deviceForm.phoneNumber.trim(),
        eviewVersion: deviceForm.eviewVersion.trim(),
        version: deviceForm.eviewVersion.trim(),
        locationId: deviceForm.locationId ? Number(deviceForm.locationId) : null,
        userId: Number(deviceForm.ownerUserId),
        simIccid: deviceForm.simIccid.trim() || null,
        protocolSettings: applySupportedDeviceDefaults({}),
        ...(deviceForm.externalDeviceId.trim()
          ? { externalDeviceId: deviceForm.externalDeviceId.trim(), deviceId: deviceForm.externalDeviceId.trim() }
          : {})
      }

      let createdDevice
      try {
        createdDevice = await fetchJson(`/api/users/${payload.userId}/devices`, { method: 'POST', body: JSON.stringify(payload) })
      } catch {
        createdDevice = await fetchJson('/api/devices', { method: 'POST', body: JSON.stringify(payload) })
      }

      const createdDeviceId = createdDevice?.id || createdDevice?.deviceId
      const createdExternalId = String(createdDevice?.externalDeviceId || createdDevice?.external_device_id || createdDevice?.deviceId || '').trim()
      const normalizedCreatedDevice = {
        ...createdDevice,
        id: createdDeviceId || createdDevice?.id,
        deviceId: createdDeviceId || createdDevice?.deviceId,
        phoneNumber: createdDevice?.phoneNumber || payload.phoneNumber,
        externalDeviceId: createdExternalId || null,
        simIccid: createdDevice?.simIccid || payload.simIccid || null,
        simActivated: createdDevice?.simActivated === true
      }
      setImeiLinkState({
        open: true,
        deviceId: createdDeviceId || null,
        phoneNumber: createdDevice?.phoneNumber || payload.phoneNumber,
        externalDeviceId: createdExternalId,
        status: createdExternalId
          ? 'IMEI linked automatically.'
          : 'Device created. Backend auto-sent V?. Waiting for IMEI link…',
        polling: !createdExternalId && Boolean(createdDeviceId),
        resendPending: false,
        waitStartedAt: !createdExternalId && createdDeviceId ? new Date().toISOString() : null,
        lastRetryAt: null
      })
      setDeviceRegistrationModal({
        open: true,
        device: normalizedCreatedDevice,
        status: createdExternalId
          ? 'IMEI linked automatically.'
          : 'Waiting for IMEI link…',
        activatingSim: false
      })

      setActionStatus({ type: 'success', message: 'Device created successfully.' })
      setShowDeviceModal(false)
      setDeviceForm(initialDeviceForm)
      await loadDevices()
      if (!createdExternalId && createdDeviceId) {
        try {
          const linkedResult = await pollForDeviceImei(createdDeviceId)
          if (linkedResult?.externalDeviceId) {
            setImeiLinkState((prev) => ({
              ...prev,
              externalDeviceId: linkedResult.externalDeviceId,
              status: `IMEI linked: ${linkedResult.externalDeviceId}`,
              polling: false,
              waitStartedAt: null
            }))
            setDeviceRegistrationModal((prev) => ({
              ...prev,
              status: `IMEI linked: ${linkedResult.externalDeviceId}`,
              device: prev.device ? { ...prev.device, externalDeviceId: linkedResult.externalDeviceId } : prev.device
            }))
            await loadDevices()
          } else {
            setImeiLinkState((prev) => ({ ...prev, polling: false, status: 'IMEI not linked yet. You can manually retry V?.', waitStartedAt: prev.waitStartedAt || new Date().toISOString() }))
            setDeviceRegistrationModal((prev) => ({ ...prev, status: 'IMEI not linked yet. You can manually retry V?.' }))
          }
        } catch {
          setImeiLinkState((prev) => ({ ...prev, polling: false, status: 'IMEI polling failed. You can manually retry V?.', waitStartedAt: prev.waitStartedAt || new Date().toISOString() }))
          setDeviceRegistrationModal((prev) => ({ ...prev, status: 'IMEI polling failed. You can manually retry V?.' }))
        }
      }
    } catch (error) {
      setActionStatus({ type: 'error', message: `Create device failed: ${error.message}` })
      setImeiLinkState(initialImeiLinkState)
      setDeviceRegistrationModal(initialDeviceRegistrationModal)
    }
  }

  const openEditDeviceModal = async (device) => {
    await Promise.all([loadUsers(), loadLocations()])

    setEditingDeviceId(device.id || device.deviceId)
    setDeviceForm({
      name: device.name || device.deviceName || '',
      phoneNumber: device.phoneNumber || '',
      eviewVersion: device.eviewVersion || device.version || '',
      ownerUserId: device.ownerUserId || device.userId || device.user_id || device.owner?.id || device.app_user?.id || '',
      locationId: device.locationId || device.location_id || '',
      externalDeviceId: device.externalDeviceId || device.external_device_id || device.deviceId || '',
      simIccid: device.simIccid || ''
    })
    setShowEditDeviceModal(true)
  }

  const handleUpdateDevice = async () => {
    try {
      if (!editingDeviceId) throw new Error('Device id is missing')
      if (!deviceForm.name.trim() || !deviceForm.phoneNumber.trim()) throw new Error('Device name and phone number are required')

      const normalizedOwnerUserId = deviceForm.ownerUserId ? Number(deviceForm.ownerUserId) : null
      const normalizedLocationId = deviceForm.locationId ? Number(deviceForm.locationId) : null
      const shouldClearLocation = !normalizedLocationId

      const payload = {
        name: deviceForm.name.trim(),
        phoneNumber: deviceForm.phoneNumber.trim(),
        eviewVersion: deviceForm.eviewVersion.trim(),
        version: deviceForm.eviewVersion.trim(),
        ...(normalizedOwnerUserId ? { userId: normalizedOwnerUserId } : {}),
        ...(shouldClearLocation ? { clearLocation: true } : { locationId: normalizedLocationId }),
        simIccid: deviceForm.simIccid.trim() || null,
        externalDeviceId: deviceForm.externalDeviceId.trim() || null,
        deviceId: deviceForm.externalDeviceId.trim() || null
      }

      try {
        await fetchJson(`/api/devices/${editingDeviceId}`, { method: 'PUT', body: JSON.stringify(payload) })
      } catch {
        await fetchJson(`/api/devices/${editingDeviceId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      }

      setActionStatus({ type: 'success', message: 'Device updated successfully.' })
      if (showEditDeviceModal) {
        setShowEditDeviceModal(false)
        setEditingDeviceId(null)
        setDeviceForm(initialDeviceForm)
      }
      if (selectedDevice && String(selectedDevice.id || selectedDevice.deviceId || '') === String(editingDeviceId)) {
        setSelectedDevice((prev) => prev
          ? { ...prev, ...payload, id: prev.id || editingDeviceId, deviceId: prev.deviceId || payload.deviceId }
          : prev)
      }
      try {
        const refreshed = await fetchJson(`/api/devices/${editingDeviceId}`, { headers: {} })
        if (refreshed && typeof refreshed === 'object') {
          setSelectedDevice((prev) => {
            if (!prev) return prev
            if (String(prev.id || prev.deviceId || '') !== String(editingDeviceId)) return prev
            return { ...prev, ...refreshed }
          })
        }
      } catch {
        // Non-blocking refresh; list refresh below will still run.
      }
      await loadDevices()
    } catch (error) {
      setActionStatus({ type: 'error', message: `Update device failed: ${error.message}` })
    }
  }

  const handleSetSimActivation = useCallback(async (device, activate, { silent = false } = {}) => {
    const deviceId = device?.id || device?.deviceId
    if (!deviceId) return false
    setSimActionPendingByDevice((prev) => ({ ...prev, [deviceId]: true }))
    try {
      if (activate) {
        await activateDeviceSim(deviceId)
      } else {
        const response = await fetchJson(`/api/devices/${deviceId}/sim/deactivate`, { method: 'POST' })
        syncDeviceRecord(deviceId, {
          simActivated: false,
          simStatus: String(response?.status || '').trim() || 'DEACTIVATED',
          simStatusUpdatedAt: response?.updatedAt || new Date().toISOString()
        })
      }
      if (!silent) setActionStatus({ type: 'success', message: `SIM ${activate ? 'activated' : 'deactivated'} for device ${device?.name || deviceId}.` })
      return true
    } catch (error) {
      if (!silent) setActionStatus({ type: 'error', message: `SIM ${activate ? 'activation' : 'deactivation'} failed: ${error.message}` })
      return false
    } finally {
      setSimActionPendingByDevice((prev) => ({ ...prev, [deviceId]: false }))
    }
  }, [activateDeviceSim, fetchJson, syncDeviceRecord])




  useEffect(() => {
    setBulkSimSelectedDeviceIds((prev) => prev.filter((id) => devices.some((device) => String(device.id || device.deviceId || '') === id)))
  }, [devices])

  const handleBulkSetSimActivation = useCallback(async (activate) => {
    const selectedDevices = devices.filter((device) => bulkSimSelectedDeviceIds.includes(String(device.id || device.deviceId || '')))
    if (!selectedDevices.length) return

    let successCount = 0
    for (const device of selectedDevices) {
      const ok = await handleSetSimActivation(device, activate, { silent: true })
      if (ok) successCount += 1
    }

    const failedCount = selectedDevices.length - successCount
    if (failedCount > 0) {
      setActionStatus({
        type: 'error',
        message: `Bulk SIM ${activate ? 'activation' : 'deactivation'} completed with partial failures. Success: ${successCount}, Failed: ${failedCount}.`
      })
    } else {
      setActionStatus({
        type: 'success',
        message: `Bulk SIM ${activate ? 'activation' : 'deactivation'} completed for ${successCount} device${successCount === 1 ? '' : 's'}.`
      })
    }

    await loadDevices()
  }, [bulkSimSelectedDeviceIds, devices, handleSetSimActivation, loadDevices])

  const prepareUserEditor = useCallback((entry) => {
    if (!entry) return
    const user = entry
    setEditingUserId(user.id)
    setUserForm({
      email: user.email || '',
      password: '',
      firstName: user.firstName || user.first_name || '',
      lastName: user.lastName || user.last_name || '',
      contactNumber: user.contactNumber || user.contact_number || '',
      address: user.address || '',
      userRole: Number(user.userRole || user.role || user.user_role || 3),
      locationId: user.locationId || user.location_id || user.location?.id || '',
      companyId: user.companyId || user.company_id || user.company?.id || ''
    })
  }, [])

  const openEditUserModal = async (user) => {
    await Promise.all([loadCompanies(), loadLocations(), loadUsers()])
    prepareUserEditor(user)
    setShowEditUserModal(true)
  }

  const openEditLocationModal = (location) => {
    if (!location) return
    setEditingLocationId(location.id)
    setLocationForm({
      name: location.name || '',
      details: location.details || '',
      companyId: location.companyId || location.company_id || location.company?.id || ''
    })
    setShowEditLocationModal(true)
  }

  const openEditCompanyModal = (company) => {
    if (!company) return
    setEditingCompanyId(company.id)
    const alarmReceiverConfig = company.alarmReceiverConfig || company.alarm_receiver_config || {}
    const dnsWhitelist = Array.isArray(company.dnsWhitelist || company.dns_whitelist) ? (company.dnsWhitelist || company.dns_whitelist) : []
    const ipWhitelist = Array.isArray(company.ipWhitelist || company.ip_whitelist) ? (company.ipWhitelist || company.ip_whitelist) : []
    setCompanyForm({
      companyName: company.companyName || company.company_name || company.name || '',
      details: company.details || '',
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      postalCode: company.postalCode || company.postal_code || '',
      country: company.country || '',
      phone: company.phone || '',
      isAlarmReceiverIncluded: Boolean(company.isAlarmReceiverIncluded ?? company.is_alarm_receiver_included ?? company.alarmReceiverIncluded),
      alarmReceiverEnabled: Boolean(company.alarmReceiverEnabled ?? company.alarm_receiver_enabled),
      dnsWhitelistText: dnsWhitelist.join('\n'),
      ipWhitelistText: ipWhitelist.join('\n'),
      alarmReceiverConfigJson: Object.keys(alarmReceiverConfig || {}).length ? JSON.stringify(alarmReceiverConfig, null, 2) : ''
    })
    setShowEditCompanyModal(true)
  }

  const openUserDetailPage = async (entry) => {
    if (!users.length) {
      await loadUsers()
    }
    if (!devices.length) {
      await loadDevices()
    }
    setSelectedUserId(String(entry?.id || ''))
    setActiveSection('user-detail')
  }

  const openLocationDetailPage = async (entry) => {
    if (!locations.length) {
      await loadLocations()
    }
    if (!devices.length) {
      await loadDevices()
    }
    setSelectedLocationId(String(entry?.id || ''))
    setActiveSection('location-detail')
  }

  const handleUpdateUser = async () => {
    try {
      if (!editingUserId) throw new Error('User id is missing')
      if (!userForm.email.trim()) throw new Error('Email is required')
      if ([2, 3, 4].includes(Number(userForm.userRole)) && !userForm.companyId) throw new Error('Company is required for this role')

      const payload = {
        ...userForm,
        userRole: Number(userForm.userRole),
        companyId: userForm.companyId ? Number(userForm.companyId) : null,
        locationId: userForm.locationId ? Number(userForm.locationId) : null
      }

      try {
        await fetchJson(`/api/users/${editingUserId}`, { method: 'PUT', body: JSON.stringify(payload) })
      } catch {
        await fetchJson(`/api/users/${editingUserId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      }

      setActionStatus({ type: 'success', message: 'User updated successfully.' })
      setShowEditUserModal(false)
      setEditingUserId(null)
      setUserForm(initialUserForm)
      await loadUsers()
    } catch (error) {
      setActionStatus({ type: 'error', message: `Update user failed: ${error.message}` })
    }
  }

  const handleUpdateLocation = async () => {
    try {
      if (!editingLocationId) throw new Error('Location id is missing')
      if (!locationForm.name.trim()) throw new Error('Location name is required')
      if (!locationForm.companyId) throw new Error('Company is required')

      const payload = {
        name: locationForm.name.trim(),
        details: locationForm.details.trim(),
        companyId: Number(locationForm.companyId)
      }

      try {
        await fetchJson(`/api/locations/${editingLocationId}`, { method: 'PUT', body: JSON.stringify(payload) })
      } catch {
        await fetchJson(`/api/locations/${editingLocationId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      }

      const alarmReceiverPayload = {
        accountNumber: locationForm.alarmReceiverAccountNumber.trim(),
        en: Boolean(locationForm.alarmReceiverEnabled),
        users: locationForm.alarmReceiverUsers.trim(),
        toggleCompanyAlarmReceiver: Boolean(locationForm.toggleCompanyAlarmReceiver)
      }

      await fetchJson(`/api/locations/${editingLocationId}/alarm-receiver`, {
        method: 'PUT',
        body: JSON.stringify(alarmReceiverPayload)
      })

      setActionStatus({ type: 'success', message: 'Location updated successfully.' })
      setShowEditLocationModal(false)
      setEditingLocationId(null)
      setLocationForm(initialLocationForm)
      await loadLocations()
    } catch (error) {
      setActionStatus({ type: 'error', message: `Update location failed: ${error.message}` })
    }
  }

  const handleUpdateCompany = async () => {
    try {
      if (!editingCompanyId) throw new Error('Company id is missing')
      const normalizedCompanyName = (companyForm.companyName || '').trim()
      if (!normalizedCompanyName) throw new Error('Company name is required')

      const profilePayload = {
        companyName: normalizedCompanyName,
        name: normalizedCompanyName,
        details: companyForm.details.trim(),
        address: companyForm.address.trim(),
        city: companyForm.city.trim(),
        state: companyForm.state.trim(),
        postalCode: companyForm.postalCode.trim(),
        country: companyForm.country.trim(),
        phone: companyForm.phone.trim(),
        isAlarmReceiverIncluded: Boolean(companyForm.isAlarmReceiverIncluded)
      }

      const alarmReceiverPayload = {
        alarmReceiverConfig: parseJsonInput(companyForm.alarmReceiverConfigJson, {}),
        dnsWhitelist: parseCsvLines(companyForm.dnsWhitelistText),
        ipWhitelist: parseCsvLines(companyForm.ipWhitelistText),
        alarmReceiverEnabled: Boolean(companyForm.alarmReceiverEnabled)
      }

      await fetchJson(`/api/companies/${editingCompanyId}`, { method: 'PUT', body: JSON.stringify(profilePayload) })
      await fetchJson(`/api/companies/${editingCompanyId}/alarm-receiver`, { method: 'PUT', body: JSON.stringify(alarmReceiverPayload) })

      setActionStatus({ type: 'success', message: 'Company updated successfully.' })
      setShowEditCompanyModal(false)
      setEditingCompanyId(null)
      setCompanyForm(initialCompanyForm)
      await Promise.all([loadCompanies(), loadLookups()])
    } catch (error) {
      setActionStatus({ type: 'error', message: `Update company failed: ${error.message}` })
    }
  }

  const managers = managerLookupUsers.length
    ? managerLookupUsers
    : users.filter((nextUser) => Number(nextUser.userRole) === 2)
  const allSelectableLocations = locationLookupRows.length ? locationLookupRows : locations
  const selectedCompanyId = Number(userForm.companyId)
  const selectableLocations = Number.isFinite(selectedCompanyId) && selectedCompanyId > 0
    ? allSelectableLocations.filter((entry) => Number(entry.companyId || entry.company_id || entry.company?.id || 0) === selectedCompanyId)
    : allSelectableLocations
  const selectableCompanies = companyLookupRows
  const locationTypeaheadRows = useMemo(
    () =>
      selectableLocations
        .map((location) => ({
          id: String(location?.id || '').trim(),
          label: String(location?.name || 'Unknown location').trim()
        }))
        .filter((entry) => entry.id && entry.label),
    [selectableLocations]
  )
  const locationQueryNormalized = userLocationQuery.trim().toLowerCase()
  const filteredLocationSuggestions = useMemo(() => {
    if (!locationQueryNormalized) return locationTypeaheadRows.slice(0, 8)
    return locationTypeaheadRows
      .filter((entry) => entry.label.toLowerCase().includes(locationQueryNormalized))
      .slice(0, 8)
  }, [locationQueryNormalized, locationTypeaheadRows])
  const selectableUsers = roleUserLookupUsers.length
    ? roleUserLookupUsers
    : users.filter((nextUser) => Number(nextUser.userRole) === 3)
  const selectableMobileUsers = mobileUserLookupUsers.length
    ? mobileUserLookupUsers
    : users.filter((nextUser) => Number(nextUser.userRole) === 4)
  const fallbackAdminUsers = users.filter((nextUser) => Number(nextUser.userRole) === 1)
  const selectableSuperAdmins = superAdminLookupUsers.length ? superAdminLookupUsers : fallbackAdminUsers
  const assignableUsers = [...selectableUsers, ...selectableMobileUsers, ...managers, ...selectableSuperAdmins].filter((entry, index, all) => {
    const id = Number(entry?.id)
    if (!Number.isFinite(id) || id <= 0) return false
    return all.findIndex((nextEntry) => Number(nextEntry?.id) === id) === index
  })
  const eviewDeviceVersionOptions = useMemo(() => {
    const knownOptions = DEFAULT_EVIEW_DEVICE_VERSIONS.map((version) => String(version).trim()).filter(Boolean)
    const discoveredOptions = devices
      .map((entry) => String(entry?.eviewVersion || entry?.version || '').trim())
      .filter(Boolean)

    const merged = [...knownOptions, ...discoveredOptions]
    return merged.filter((option, index, all) => all.indexOf(option) === index)
  }, [devices])
  useEffect(() => {
    if (!(showUserModal || showEditUserModal)) return
    const selectedLocation = locationTypeaheadRows.find((entry) => entry.id === String(userForm.locationId || ''))
    setUserLocationQuery(selectedLocation?.label || '')
  }, [locationTypeaheadRows, showEditUserModal, showUserModal, userForm.locationId])

  const resolveDeviceMeta = (device) => {
    const ownerId = Number(device.ownerUserId || device.userId || device.user_id || device.owner?.id || device.app_user?.id || 0)
    const userById = ownerId ? users.find((user) => Number(user.id) === ownerId) : null
    const owner = device.owner || device.user || device.app_user || userById || null

    const ownerName =
      device.ownerName ||
      device.owner_name ||
      owner?.fullName ||
      `${owner?.firstName || owner?.first_name || ''} ${owner?.lastName || owner?.last_name || ''}`.trim() ||
      owner?.name ||
      owner?.email ||
      '-'

    const ownerRoleRaw = device.ownerRole || device.owner_role || owner?.userRole || owner?.role || owner?.user_role

    const locationIdRaw =
      device.locationId ||
      device.location_id ||
      owner?.locationId ||
      owner?.location_id ||
      owner?.location?.id ||
      null

    const locationId = Number(locationIdRaw)
    const locationById = Number.isFinite(locationId) && locationId > 0
      ? locations.find((loc) => Number(loc.id) === locationId)
      : null

    const ownerLocation =
      locationById?.name ||
      device.location?.name ||
      device.locationName ||
      device.location_name ||
      owner?.locationName ||
      owner?.location?.name ||
      '-'

    return {
      ownerName,
      ownerRole: roleLabel(ownerRoleRaw),
      ownerLocation
    }
  }

  const replyRows = useMemo(
    () =>
      (Array.isArray(replies) ? replies : []).map((item, index) => {
        const dateValue = Number(item?.date || item?.receivedAt || item?.timestamp || 0)
        return {
          key: item?.id || item?._id || `${dateValue || 'row'}-${item?.from || item?.phone || index}`,
          receivedAt: dateValue ? new Date(dateValue).toLocaleString() : 'Unknown time',
          from: item?.from || item?.phone || '-',
          message: String(item?.message || item?.text || item?.body || '-').trim() || '-'
        }
      }),
    [replies]
  )

  const resolveValidCoordinates = useCallback((source) => {
    if (!source || typeof source !== 'object') return null

    const latitude = Number.parseFloat(source.latitude ?? source.lat)
    const longitude = Number.parseFloat(source.longitude ?? source.lng ?? source.lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null

    return { latitude, longitude }
  }, [])

  const latestDeviceLocations = useMemo(() => {
    return devices
      .map((device) => {
        const coordinates = resolveValidCoordinates(device)
        if (!coordinates) return null

        const updatedAt = device.locationUpdatedAt || device.location_updated_at || device.updatedAt || device.updated_at || null
        const updatedAtMs = updatedAt ? new Date(updatedAt).getTime() : 0

        return {
          device,
          ...coordinates,
          updatedAt,
          updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : 0
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
  }, [devices, resolveValidCoordinates])

  useEffect(() => {
    if (!locationDeviceOptions.length) {
      setLocationDeviceId('')
      return
    }

    if (locationDeviceId && locationDeviceOptions.some((device) => String(device.id || device.deviceId || '') === String(locationDeviceId))) {
      return
    }

    const preferredId = configForm.deviceId && locationDeviceOptions.find((device) => String(device.id || device.deviceId || '') === String(configForm.deviceId))
      ? String(configForm.deviceId)
      : String(locationDeviceOptions[0].id || locationDeviceOptions[0].deviceId || '')
    setLocationDeviceId(preferredId)
  }, [locationDeviceOptions, locationDeviceId, configForm.deviceId])

  useEffect(() => {
    if (locationDeviceOptions.some((device) => String(device.id || device.deviceId || '') === String(alarmLogDeviceFilter))) return
    setAlarmLogDeviceFilter('all')
  }, [alarmLogDeviceFilter, locationDeviceOptions])

  const alarmLogLocationOptions = useMemo(() => {
    const seen = new Set()
    return locationDeviceOptions
      .map((device) => ({
        id: String(device.locationId || device.location_id || '').trim(),
        name: device.locationName || ''
      }))
      .filter((location) => location.id)
      .filter((location) => {
        if (seen.has(location.id)) return false
        seen.add(location.id)
        return true
      })
  }, [locationDeviceOptions])

  const alarmLogCodeOptions = useMemo(() => {
    const fallbackCodes = alarmLogs.map((entry) => String(entry?.alarmCode || '').trim()).filter(Boolean)
    return [...new Set([...(alertLogLookupFilters.alarmCodes || []), ...fallbackCodes])]
  }, [alarmLogs, alertLogLookupFilters.alarmCodes])

  const alertLogActionOptions = useMemo(() => {
    const fallbackActions = alarmLogs.map((entry) => String(entry?.action || '').trim()).filter(Boolean)
    return [...new Set([...(alertLogLookupFilters.actions || []), ...fallbackActions])]
  }, [alarmLogs, alertLogLookupFilters.actions])

  const alertLogSourceOptions = useMemo(() => {
    const fallbackSources = alarmLogs.map((entry) => String(entry?.source || '').trim()).filter(Boolean)
    return [...new Set([...(alertLogLookupFilters.sources || []), ...fallbackSources])]
  }, [alarmLogs, alertLogLookupFilters.sources])

  useEffect(() => {
    if (alarmLogLocationFilter === 'all') return
    if (alarmLogLocationOptions.some((location) => location.id === alarmLogLocationFilter)) return
    setAlarmLogLocationFilter('all')
  }, [alarmLogLocationFilter, alarmLogLocationOptions])

  useEffect(() => {
    if (alarmLogAlertFilter === 'all' || alarmLogAlertFilter === 'no-code') return
    if (alarmLogAlertFilter === 'sos' || alarmLogAlertFilter === 'fall' || alarmLogAlertFilter === 'other') return
    if (alarmLogCodeOptions.some((code) => `code:${code}` === alarmLogAlertFilter)) return
    setAlarmLogAlertFilter('all')
  }, [alarmLogAlertFilter, alarmLogCodeOptions])

  useEffect(() => {
    if (alarmLogActionFilter === 'all') return
    if (alertLogActionOptions.includes(alarmLogActionFilter)) return
    setAlarmLogActionFilter('all')
  }, [alarmLogActionFilter, alertLogActionOptions])

  useEffect(() => {
    if (alarmLogSourceFilter === 'all') return
    if (alertLogSourceOptions.includes(alarmLogSourceFilter)) return
    setAlarmLogSourceFilter('all')
  }, [alarmLogSourceFilter, alertLogSourceOptions])

  const filteredAlarmLogs = useMemo(() => {
    return alarmLogs.filter((entry) => {
      if (isConnectivityLog(entry)) return false
      const entryLocationId = String(entry.locationId || '').trim()
      const entryDeviceId = String(entry.deviceId || '').trim()
      const action = String(entry.action || '').trim()
      const source = String(entry.source || '').trim()
      const locationMatches = alarmLogLocationFilter === 'all' || entryLocationId === alarmLogLocationFilter
      const deviceMatches = alarmLogDeviceFilter === 'all' || entryDeviceId === alarmLogDeviceFilter
      const alertMatches = matchesAlertFilter(entry, alarmLogAlertFilter)
      const actionMatches = alarmLogActionFilter === 'all' || action === alarmLogActionFilter
      const sourceMatches = alarmLogSourceFilter === 'all' || source === alarmLogSourceFilter
      return locationMatches && deviceMatches && alertMatches && actionMatches && sourceMatches
    })
  }, [alarmLogActionFilter, alarmLogAlertFilter, alarmLogDeviceFilter, alarmLogLocationFilter, alarmLogSourceFilter, alarmLogs, isConnectivityLog, matchesAlertFilter])

  const filteredConnectivityLogs = useMemo(() => {
    return alarmLogs.filter((entry) => {
      if (!isConnectivityLog(entry)) return false
      const entryLocationId = String(entry.locationId || '').trim()
      const entryDeviceId = String(entry.deviceId || '').trim()
      const action = String(entry.action || '').trim()
      const source = String(entry.source || '').trim()
      const locationMatches = alarmLogLocationFilter === 'all' || entryLocationId === alarmLogLocationFilter
      const deviceMatches = alarmLogDeviceFilter === 'all' || entryDeviceId === alarmLogDeviceFilter
      const connectionMatches = matchesConnectionFilter(entry, alarmLogConnectionFilter)
      const actionMatches = alarmLogActionFilter === 'all' || action === alarmLogActionFilter
      const sourceMatches = alarmLogSourceFilter === 'all' || source === alarmLogSourceFilter
      return locationMatches && deviceMatches && connectionMatches && actionMatches && sourceMatches
    })
  }, [alarmLogActionFilter, alarmLogConnectionFilter, alarmLogDeviceFilter, alarmLogLocationFilter, alarmLogSourceFilter, alarmLogs, isConnectivityLog, matchesConnectionFilter])

  const visibleAlarmLogs = useMemo(() => (
    alarmLogTypeFilter === 'connection' ? [] : filteredAlarmLogs
  ), [alarmLogTypeFilter, filteredAlarmLogs])

  const visibleConnectivityLogs = useMemo(() => (
    alarmLogTypeFilter === 'alerts' ? [] : filteredConnectivityLogs
  ), [alarmLogTypeFilter, filteredConnectivityLogs])

  const selectedLocationDevice = useMemo(
    () => locationDeviceOptions.find((device) => String(device.id || device.deviceId || '') === String(locationDeviceId)) || null,
    [locationDeviceId, locationDeviceOptions]
  )

  const selectedWorkspaceDevice = useMemo(() => {
    if (!selectedDevice) return null
    const selectedId = String(selectedDevice.id || selectedDevice.deviceId || '')
    return devices.find((device) => String(device.id || device.deviceId || '') === selectedId) || selectedDevice
  }, [devices, selectedDevice])
  const selectedUser = useMemo(
    () => users.find((entry) => String(entry.id || '') === String(selectedUserId || '')) || null,
    [selectedUserId, users]
  )
  const selectedLocation = useMemo(
    () => locations.find((entry) => String(entry.id || '') === String(selectedLocationId || '')) || null,
    [locations, selectedLocationId]
  )

  const locationViewerDevice = isDeviceDetailLocationSection ? selectedWorkspaceDevice : selectedLocationDevice
  const geofenceCenterLocation = useMemo(() => {
    const dbCoordinates = resolveValidCoordinates(selectedWorkspaceDevice)
    if (dbCoordinates) return dbCoordinates
    return resolveValidCoordinates(selectedDevice)
  }, [resolveValidCoordinates, selectedDevice, selectedWorkspaceDevice])
  const geoFenceConfigs = useMemo(() => buildGeoFencesFromForm(configForm), [configForm])
  const activeGeoFenceSlot = normalizeGeoFenceSlot(selectedGeoFenceSlot, 1)
  const activeGeoFenceConfig = useMemo(() => (
    geoFenceConfigs.find((entry) => entry.slot === activeGeoFenceSlot) || geoFenceConfigs[0] || { slot: 1, enabled: '1', mode: '0', radius: '100m' }
  ), [activeGeoFenceSlot, geoFenceConfigs])

  useEffect(() => {
    if (!geoFenceConfigs.length) return
    if (geoFenceConfigs.some((entry) => entry.slot === activeGeoFenceSlot)) return
    setSelectedGeoFenceSlot(geoFenceConfigs[0].slot)
  }, [activeGeoFenceSlot, geoFenceConfigs])

  const selectedDeviceWebhookLocation = useMemo(() => {
    if (!locationViewerDevice) return null

    const coordinates = resolveValidCoordinates(locationViewerDevice)
    if (!coordinates) return null

    return {
      ...coordinates,
      mapUrl: `https://www.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}`,
      source: 'webhook',
      updatedAt: locationViewerDevice.locationUpdatedAt || locationViewerDevice.location_updated_at || null
    }
  }, [locationViewerDevice, resolveValidCoordinates])

  const displayedLocation = locationResult || selectedDeviceWebhookLocation
  const usingWebhookFallback = !locationResult && Boolean(selectedDeviceWebhookLocation)
  const breadcrumbPoints = useMemo(() => {
    return locationBreadcrumbs
      .map((entry) => {
        const coordinates = resolveValidCoordinates(entry)
        if (!coordinates) return null
        const capturedAt = entry.capturedAt || entry.eventAt || entry.createdAt || entry.updatedAt || null
        const capturedAtMs = capturedAt ? new Date(capturedAt).getTime() : 0
        return {
          ...entry,
          ...coordinates,
          capturedAt,
          capturedAtMs: Number.isFinite(capturedAtMs) ? capturedAtMs : 0
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.capturedAtMs - b.capturedAtMs)
  }, [locationBreadcrumbs, resolveValidCoordinates])
  const breadcrumbDateBounds = useMemo(() => {
    if (!breadcrumbPoints.length) return { earliest: null, latest: null }
    const datedPoints = breadcrumbPoints.filter((entry) => entry.capturedAtMs > 0)
    if (!datedPoints.length) return { earliest: null, latest: null }
    return {
      earliest: datedPoints[0].capturedAt,
      latest: datedPoints[datedPoints.length - 1].capturedAt
    }
  }, [breadcrumbPoints])
  const filteredBreadcrumbPoints = useMemo(() => {
    const fromMs = breadcrumbDateFrom ? new Date(breadcrumbDateFrom).getTime() : null
    const toMs = breadcrumbDateTo ? new Date(breadcrumbDateTo).getTime() : null
    const hasFrom = Number.isFinite(fromMs)
    const hasTo = Number.isFinite(toMs)

    return breadcrumbPoints.filter((point) => {
      if (!hasFrom && !hasTo) return true
      if (!point.capturedAtMs) return false
      if (hasFrom && point.capturedAtMs < fromMs) return false
      if (hasTo && point.capturedAtMs > toMs) return false
      return true
    })
  }, [breadcrumbDateFrom, breadcrumbDateTo, breadcrumbPoints])
  const filteredBreadcrumbStatus = useMemo(() => {
    if (!breadcrumbPoints.length) return locationBreadcrumbsStatus
    if (!breadcrumbDateFrom && !breadcrumbDateTo) return `Showing ${filteredBreadcrumbPoints.length} breadcrumb point${filteredBreadcrumbPoints.length === 1 ? '' : 's'}.`
    return `Showing ${filteredBreadcrumbPoints.length} of ${breadcrumbPoints.length} breadcrumb point${breadcrumbPoints.length === 1 ? '' : 's'} in selected date range.`
  }, [breadcrumbDateFrom, breadcrumbDateTo, breadcrumbPoints.length, filteredBreadcrumbPoints.length, locationBreadcrumbsStatus])

  useEffect(() => {
    if ((activeSection !== 'location' && activeSection !== 'device-detail-location') || !locationViewerDevice) return
    const deviceId = locationViewerDevice.id || locationViewerDevice.deviceId
    if (!deviceId) return
    loadLocationBreadcrumbs(deviceId)
  }, [activeSection, locationViewerDevice, loadLocationBreadcrumbs])

  useEffect(() => {
    const deviceId = String(locationViewerDevice?.id || locationViewerDevice?.deviceId || '')
    if (!deviceId) return
    setBreadcrumbDateFrom('')
    setBreadcrumbDateTo('')
  }, [locationViewerDevice])
  const dashboardPageSize = 8
  const activeAlertPageSize = 6
  const listPageSize = 10

  const resolveLiveAlarmCode = useCallback(
    (device) => {
      const deviceId = Number(device?.id || device?.deviceId || 0)
      const externalDeviceId = String(device?.externalDeviceId || device?.external_device_id || '').trim()
      const liveEntry =
        (deviceId ? alarmStateByDevice?.[`id:${deviceId}`] : null) ||
        (externalDeviceId ? alarmStateByDevice?.[`ext:${externalDeviceId}`] : null)

      if (!liveEntry) return device?.alarmCode ?? null
      if (liveEntry.alarmCode === null) return null

      if (isMotionAlarmCode(liveEntry.alarmCode)) {
        const updatedAtMs = new Date(liveEntry?.updatedAt || liveEntry?.receivedAt || liveEntry?.timestamp || 0).getTime()
        if (Number.isFinite(updatedAtMs) && updatedAtMs > 0) {
          const motionDurationMs = getDeviceMotionAlertDurationMs(device)
          if (alarmNowMs - updatedAtMs >= motionDurationMs) return null
        }
      }

      return liveEntry.alarmCode || device?.alarmCode || null
    },
    [alarmNowMs, alarmStateByDevice, getDeviceMotionAlertDurationMs, isMotionAlarmCode]
  )

  const activeAlarmDevices = useMemo(
    () =>
      devices
        .map((device) => ({ device, alarmCode: resolveLiveAlarmCode(device) }))
        .filter((entry) => Boolean(entry.alarmCode)),
    [devices, resolveLiveAlarmCode]
  )
  const dashboardAlertCodeOptions = useMemo(() => {
    const fallbackCodes = activeAlarmDevices.map((entry) => String(entry.alarmCode || '').trim()).filter(Boolean)
    return [...new Set([...(alertLookupCodes || []), ...fallbackCodes])]
  }, [activeAlarmDevices, alertLookupCodes])
  const activeAlarmLocations = useMemo(
    () =>
      activeAlarmDevices
        .map(({ device, alarmCode }) => {
          const coordinates = resolveValidCoordinates(device)
          if (!coordinates) return null

          const deviceId = String(device.id || device.deviceId || '')
          const updatedAt = device.locationUpdatedAt || device.location_updated_at || device.updatedAt || device.updated_at || null
          const updatedAtMs = updatedAt ? new Date(updatedAt).getTime() : 0

          return {
            device,
            alarmCode,
            ...coordinates,
            updatedAt,
            updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : 0,
            deviceKey: deviceId
          }
        })
        .filter(Boolean)
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs),
    [activeAlarmDevices, resolveValidCoordinates]
  )
  const selectedAlertLocation = useMemo(
    () => activeAlarmLocations.find((entry) => entry.deviceKey === String(dashboardMapDeviceId)) || null,
    [activeAlarmLocations, dashboardMapDeviceId]
  )
  const filteredDashboardDevices = useMemo(() => {
    const keyword = dashboardDeviceSearch.trim().toLowerCase()
    return devices
      .filter((entry) => {
        const hasActiveAlarm = Boolean(resolveLiveAlarmCode(entry))
        const normalizedAlarmCode = String(resolveLiveAlarmCode(entry) || '').trim().toLowerCase()
        const alarmMatch =
          dashboardDeviceAlertFilter === 'all'
            ? true
            : dashboardDeviceAlertFilter === 'active'
              ? hasActiveAlarm
              : dashboardDeviceAlertFilter === 'inactive'
                ? !hasActiveAlarm
                : dashboardDeviceAlertFilter.startsWith('code:')
                  ? normalizedAlarmCode === dashboardDeviceAlertFilter.slice(5).toLowerCase()
                  : true

        if (!alarmMatch) return false
        if (!keyword) return true

        const owner = resolveDeviceMeta(entry)
        const text = `${entry.name || entry.deviceName || ''} ${entry.phoneNumber || ''} ${entry.externalDeviceId || entry.external_device_id || entry.deviceId || ''} ${owner.ownerName} ${owner.ownerRole} ${owner.ownerLocation}`.toLowerCase()
        return text.includes(keyword)
      })
      .sort((a, b) => {
        const aActive = Boolean(resolveLiveAlarmCode(a))
        const bActive = Boolean(resolveLiveAlarmCode(b))
        if (aActive !== bActive) return aActive ? -1 : 1
        const aName = String(a.name || a.deviceName || '').toLowerCase()
        const bName = String(b.name || b.deviceName || '').toLowerCase()
        return aName.localeCompare(bName)
      })
  }, [dashboardDeviceAlertFilter, dashboardDeviceSearch, devices, resolveDeviceMeta, resolveLiveAlarmCode])
  const dashboardTotalPages = Math.max(1, Math.ceil(filteredDashboardDevices.length / dashboardPageSize))
  const paginatedDashboardDevices = useMemo(() => {
    const start = (dashboardDevicePage - 1) * dashboardPageSize
    return filteredDashboardDevices.slice(start, start + dashboardPageSize)
  }, [dashboardDevicePage, filteredDashboardDevices])

  useEffect(() => {
    if (dashboardDevicePage > dashboardTotalPages) {
      setDashboardDevicePage(dashboardTotalPages)
    }
  }, [dashboardDevicePage, dashboardTotalPages])

  const filteredUsers = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase()
    return users.filter((entry) => {
      const rawRole = entry.userRole || entry.role || entry.user_role || ''
      const role = String(roleLabel(rawRole)).toLowerCase()
      const roleMatch = userRoleFilter === 'all' ? true : role === userRoleFilter
      const locationId = String(entry.locationId || entry.location?.id || '')
      const locationMatch = userLocationFilter === 'all' ? true : locationId === userLocationFilter
      const text = `${entry.firstName || ''} ${entry.lastName || ''} ${entry.email || ''} ${entry.contactNumber || ''} ${entry.locationName || entry.location?.name || ''}`.toLowerCase()
      const textMatch = !keyword || text.includes(keyword)
      return roleMatch && locationMatch && textMatch
    })
  }, [roleLabel, userLocationFilter, userRoleFilter, userSearch, users])

  const filteredCompanies = useMemo(() => {
    const keyword = companySearch.trim().toLowerCase()
    return companies.filter((entry) => {
      const text = `${entry.name || ''} ${entry.details || ''}`.toLowerCase()
      return !keyword || text.includes(keyword)
    })
  }, [companies, companySearch])

  const userLocationOptions = useMemo(() => (
    locations
      .map((entry) => ({ id: String(entry.id || ''), name: entry.name || `Location ${entry.id}` }))
      .filter((entry) => entry.id)
      .sort((a, b) => a.name.localeCompare(b.name))
  ), [locations])

  const getUserDevices = useCallback((userEntry) => {
    const currentId = String(userEntry?.id || '')
    if (!currentId) return []
    return devices.filter((entry) => String(entry.ownerUserId || entry.userId || entry.user_id || entry.owner?.id || entry.app_user?.id || '') === currentId)
  }, [devices])

  const filteredLocations = useMemo(() => {
    const keyword = locationSearch.trim().toLowerCase()
    return locations.filter((entry) => {
      const hasDevice = Number(entry.deviceCount || entry.devices?.length || 0) > 0
      let deviceMatch = true
      if (locationDeviceFilter === 'with-devices') {
        deviceMatch = hasDevice
      } else if (locationDeviceFilter === 'without-devices') {
        deviceMatch = !hasDevice
      }
      const text = `${entry.name || ''} ${entry.details || ''}`.toLowerCase()
      const textMatch = !keyword || text.includes(keyword)
      return deviceMatch && textMatch
    })
  }, [locationDeviceFilter, locationSearch, locations])

  const filteredDevices = useMemo(() => {
    const deviceKeyword = deviceFilters.device.trim().toLowerCase()
    const ownerKeyword = deviceFilters.owner.trim().toLowerCase()
    const locationKeyword = deviceFilters.location.trim().toLowerCase()
    const phoneKeyword = deviceFilters.phone.trim().toLowerCase()
    const versionFilter = deviceFilters.version.trim().toLowerCase()
    return devices.filter((entry) => {
      const alarmMeta = getAlarmMeta(resolveLiveAlarmCode(entry))
      const alarmMatch = deviceAlarmFilter === 'all' ? true : alarmMeta.tone === deviceAlarmFilter
      const owner = resolveDeviceMeta(entry)
      const deviceText = String(entry.name || entry.deviceName || '').toLowerCase()
      const ownerText = String(owner.ownerName || '').toLowerCase()
      const locationText = String(owner.ownerLocation || '').toLowerCase()
      const phoneText = String(entry.phoneNumber || '').toLowerCase()
      const versionText = String(entry.eviewVersion || entry.version || '').toLowerCase()

      const deviceMatch = !deviceKeyword || deviceText.includes(deviceKeyword)
      const ownerMatch = !ownerKeyword || ownerText.includes(ownerKeyword)
      const locationMatch = !locationKeyword || locationText.includes(locationKeyword)
      const phoneMatch = !phoneKeyword || phoneText.includes(phoneKeyword)
      const versionMatch = !versionFilter || versionText === versionFilter
      return alarmMatch && deviceMatch && ownerMatch && locationMatch && phoneMatch && versionMatch
    })
  }, [deviceAlarmFilter, deviceFilters, devices, getAlarmMeta, resolveDeviceMeta, resolveLiveAlarmCode])

  const toPagedRows = useCallback((rows, page) => {
    const totalPages = Math.max(1, Math.ceil(rows.length / listPageSize))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * listPageSize
    return { totalPages, rows: rows.slice(start, start + listPageSize), safePage }
  }, [listPageSize])

  const pagedUsers = toPagedRows(filteredUsers, usersPage)
  const pagedCompanies = toPagedRows(filteredCompanies, companiesPage)
  const pagedLocations = toPagedRows(filteredLocations, locationsPage)
  const pagedDevices = toPagedRows(filteredDevices, devicesPage)
  const activeAlertTotalPages = Math.max(1, Math.ceil(activeAlarmLocations.length / activeAlertPageSize))
  const paginatedActiveAlerts = useMemo(() => {
    const start = (activeAlertPage - 1) * activeAlertPageSize
    return activeAlarmLocations.slice(start, start + activeAlertPageSize)
  }, [activeAlertPage, activeAlarmLocations])

  useEffect(() => setCompaniesPage(1), [companySearch])
  useEffect(() => setUsersPage(1), [userLocationFilter, userSearch, userRoleFilter])
  useEffect(() => setLocationsPage(1), [locationSearch, locationDeviceFilter])
  useEffect(() => setDevicesPage(1), [deviceAlarmFilter, deviceFilters])
  useEffect(() => setDashboardDevicePage(1), [dashboardDeviceSearch, dashboardDeviceAlertFilter])
  useEffect(() => {
    if (dashboardDeviceAlertFilter === 'all' || dashboardDeviceAlertFilter === 'active' || dashboardDeviceAlertFilter === 'inactive') return
    if (dashboardAlertCodeOptions.some((code) => `code:${code}` === dashboardDeviceAlertFilter)) return
    setDashboardDeviceAlertFilter('all')
  }, [dashboardAlertCodeOptions, dashboardDeviceAlertFilter])
  useEffect(() => setActiveAlertPage(1), [activeAlarmLocations.length])
  useEffect(() => { if (companiesPage > pagedCompanies.totalPages) setCompaniesPage(pagedCompanies.totalPages) }, [companiesPage, pagedCompanies.totalPages])
  useEffect(() => { if (usersPage > pagedUsers.totalPages) setUsersPage(pagedUsers.totalPages) }, [pagedUsers.totalPages, usersPage])
  useEffect(() => { if (locationsPage > pagedLocations.totalPages) setLocationsPage(pagedLocations.totalPages) }, [locationsPage, pagedLocations.totalPages])
  useEffect(() => { if (devicesPage > pagedDevices.totalPages) setDevicesPage(pagedDevices.totalPages) }, [devicesPage, pagedDevices.totalPages])
  useEffect(() => { if (activeAlertPage > activeAlertTotalPages) setActiveAlertPage(activeAlertTotalPages) }, [activeAlertPage, activeAlertTotalPages])
  useEffect(() => {
    if (!selectedUser) return
    prepareUserEditor(selectedUser)
  }, [prepareUserEditor, selectedUser])
  useEffect(() => {
    if (!selectedLocation) return
    const alarmReceiverConfig = selectedLocation.alarmReceiverConfig || selectedLocation.alarm_receiver_config || {}
    setEditingLocationId(selectedLocation.id)
    setLocationForm({
      name: selectedLocation.name || '',
      details: selectedLocation.details || '',
      companyId: selectedLocation.companyId || selectedLocation.company_id || selectedLocation.company?.id || '',
      alarmReceiverAccountNumber: alarmReceiverConfig.account_number || alarmReceiverConfig.accountNumber || '',
      alarmReceiverEnabled: Boolean(alarmReceiverConfig.en),
      alarmReceiverUsers: alarmReceiverConfig.users || '',
      toggleCompanyAlarmReceiver: false
    })
  }, [selectedLocation])
  useEffect(() => {
    setUserDetailDeviceSearch('')
    setUserDetailDevicePage(1)
  }, [selectedUserId])
  useEffect(() => {
    setLocationDetailUserSearch('')
    setLocationDetailUserPage(1)
    setLocationDetailDeviceSearch('')
    setLocationDetailDevicePage(1)
  }, [selectedLocationId])

  useEffect(() => {
    if (!activeAlarmLocations.length) {
      setDashboardMapDeviceId('')
      dashboardHasAutoFramedRef.current = false
      dashboardLastFocusedDeviceRef.current = ''
      return
    }
    if (dashboardMapDeviceId && !activeAlarmLocations.some((entry) => entry.deviceKey === String(dashboardMapDeviceId))) {
      setDashboardMapDeviceId('')
    }
  }, [activeAlarmLocations, dashboardMapDeviceId])

  useEffect(() => {
    if (activeSection === 'dashboard') return
    dashboardHasAutoFramedRef.current = false
    dashboardLastFocusedDeviceRef.current = ''
  }, [activeSection])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.L) {
      setLeafletReady(true)
      return
    }

    const cssId = 'leaflet-cdn-css'
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link')
      link.id = cssId
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    const scriptId = 'leaflet-cdn-script'
    const existingScript = document.getElementById(scriptId)
    if (existingScript) {
      existingScript.addEventListener('load', () => setLeafletReady(true), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.onload = () => setLeafletReady(true)
    document.body.appendChild(script)
  }, [])

  useEffect(() => {
    if (
      activeSection !== 'dashboard' ||
      !leafletReady ||
      !dashboardLeafletRef.current ||
      !activeAlarmLocations.length ||
      typeof window === 'undefined' ||
      !window.L
    ) return

    const L = window.L
    const currentContainer = dashboardLeafletMapRef.current?.getContainer?.()
    if (dashboardLeafletMapRef.current && currentContainer !== dashboardLeafletRef.current) {
      dashboardLeafletMapRef.current.remove()
      dashboardLeafletMapRef.current = null
      dashboardMarkersLayerRef.current = null
      dashboardHasAutoFramedRef.current = false
      dashboardLastFocusedDeviceRef.current = ''
    }

    if (!dashboardLeafletMapRef.current) {
      dashboardLeafletMapRef.current = L.map(dashboardLeafletRef.current, {
        zoomControl: true
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(dashboardLeafletMapRef.current)
      dashboardMarkersLayerRef.current = L.layerGroup().addTo(dashboardLeafletMapRef.current)
    }

    const map = dashboardLeafletMapRef.current
    const markersLayer = dashboardMarkersLayerRef.current || L.layerGroup().addTo(map)
    markersLayer.clearLayers()

    const markerBounds = []
    const markerToneColor = {
      critical: '#ef4444',
      warning: '#f59e0b',
      active: '#2563eb',
      idle: '#64748b'
    }
    activeAlarmLocations.forEach(({ device, alarmCode, latitude, longitude, deviceKey, updatedAt }) => {
      const meta = resolveDeviceMeta(device)
      const alarmMeta = getAlarmMeta(alarmCode)
      const locationUpdatedAt = updatedAt ? new Date(updatedAt).toLocaleString() : 'Timestamp unavailable'
      const popupDetails = [
        `<strong>${device.name || device.deviceName || `Device ${deviceKey}`}</strong>`,
        `Owner: ${meta.ownerName}`,
        `Role: ${meta.ownerRole}`,
        `Location: ${meta.ownerLocation}`,
        `Alert: ${alarmMeta.label}`,
        `Updated: ${locationUpdatedAt}`,
        `Lat/Lng: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      ].join('<br/>')
      const toneColor = markerToneColor[alarmMeta.tone] || markerToneColor.idle
      const marker = L.marker([latitude, longitude], {
        icon: L.divIcon({
          className: 'dashboard-pin-marker',
          html: `
            <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="${toneColor}" stroke="#ffffff" stroke-width="2"/>
              <polygon points="12,33 6.5,17 17.5,17" fill="${toneColor}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
              <circle cx="12" cy="12" r="3.75" fill="#ffffff" />
            </svg>
          `,
          iconSize: [24, 36],
          iconAnchor: [12, 34],
          popupAnchor: [0, -30],
          tooltipAnchor: [0, -30]
        })
      })
        .bindPopup(popupDetails)
        .on('click', () => setDashboardMapDeviceId(deviceKey))

      if (String(dashboardMapDeviceId) === String(deviceKey)) {
        marker.bindTooltip(device.name || device.deviceName || `Device ${deviceKey}`, { permanent: true, direction: 'top', offset: [0, -24] })
      } else {
        marker.bindTooltip(device.name || device.deviceName || `Device ${deviceKey}`, { permanent: false, direction: 'top' })
      }

      marker.addTo(markersLayer)
      markerBounds.push([latitude, longitude])
    })

    const selectedKey = selectedAlertLocation?.deviceKey ? String(selectedAlertLocation.deviceKey) : ''
    const shouldRefocusSelection =
      Boolean(selectedAlertLocation) &&
      dashboardLastFocusedDeviceRef.current !== selectedKey

    if (shouldRefocusSelection && selectedAlertLocation) {
      map.setView([selectedAlertLocation.latitude, selectedAlertLocation.longitude], 15)
      dashboardLastFocusedDeviceRef.current = selectedKey
      dashboardHasAutoFramedRef.current = true
    } else if (!dashboardHasAutoFramedRef.current) {
      if (markerBounds.length > 1) {
        map.fitBounds(markerBounds, { padding: [26, 26] })
      } else if (markerBounds.length === 1) {
        map.setView(markerBounds[0], 13)
      }
      dashboardHasAutoFramedRef.current = true
      dashboardLastFocusedDeviceRef.current = selectedAlertLocation ? selectedKey : ''
    } else if (!selectedAlertLocation) {
      dashboardLastFocusedDeviceRef.current = ''
    }

    setTimeout(() => map.invalidateSize(), 120)
  }, [activeAlarmLocations, activeSection, dashboardMapDeviceId, getAlarmMeta, leafletReady, resolveDeviceMeta, selectedAlertLocation])

  useEffect(() => {
    if (activeSection !== 'dashboard') return undefined
    if (typeof window === 'undefined') return undefined
    const map = dashboardLeafletMapRef.current
    if (!map) return undefined

    const container = map.getContainer?.()
    if (!container) return undefined
    const resizeTarget = container.parentElement || container

    const triggerMapResize = () => {
      window.requestAnimationFrame(() => {
        map.invalidateSize()
      })
    }

    triggerMapResize()
    window.addEventListener('resize', triggerMapResize)

    if (!window.ResizeObserver) {
      return () => window.removeEventListener('resize', triggerMapResize)
    }

    const resizeObserver = new window.ResizeObserver(() => {
      triggerMapResize()
    })

    resizeObserver.observe(resizeTarget)

    return () => {
      window.removeEventListener('resize', triggerMapResize)
      resizeObserver.disconnect()
    }
  }, [activeAlarmLocations.length, activeSection, leafletReady])

  useEffect(() => {
    return () => {
      if (dashboardLeafletMapRef.current) {
        dashboardLeafletMapRef.current.remove()
        dashboardLeafletMapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (
      (activeSection !== 'location' && activeSection !== 'device-detail-location') ||
      !leafletReady ||
      !locationLeafletRef.current ||
      !displayedLocation ||
      typeof window === 'undefined' ||
      !window.L
    ) return

    const L = window.L
    const currentContainer = locationLeafletMapRef.current?.getContainer?.()
    if (locationLeafletMapRef.current && currentContainer !== locationLeafletRef.current) {
      locationLeafletMapRef.current.remove()
      locationLeafletMapRef.current = null
      locationLeafletLayerRef.current = null
    }

    if (!locationLeafletMapRef.current) {
      locationLeafletMapRef.current = L.map(locationLeafletRef.current, { zoomControl: true })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(locationLeafletMapRef.current)
      locationLeafletLayerRef.current = L.layerGroup().addTo(locationLeafletMapRef.current)
    }

    const map = locationLeafletMapRef.current
    const layer = locationLeafletLayerRef.current || L.layerGroup().addTo(map)
    layer.clearLayers()

    const trail = filteredBreadcrumbPoints.length ? filteredBreadcrumbPoints : [displayedLocation]
    const latLngs = trail.map((point) => [point.latitude, point.longitude])

    if (latLngs.length > 1) {
      L.polyline(latLngs, { color: '#0f766e', weight: 4, opacity: 0.8 }).addTo(layer)
    }

    trail.forEach((point, index) => {
      const isLastPoint = index === trail.length - 1
      const marker = L.circleMarker([point.latitude, point.longitude], {
        radius: isLastPoint ? 7 : 5,
        weight: 2,
        color: isLastPoint ? '#b91c1c' : '#0f766e',
        fillColor: isLastPoint ? '#ef4444' : '#2dd4bf',
        fillOpacity: 0.9
      })

      const popupTime = point.capturedAt ? new Date(point.capturedAt).toLocaleString() : 'Unknown'
      marker.bindPopup(`Lat/Lng: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}<br/>Time: ${popupTime}`)
      marker.addTo(layer)
    })

    if (latLngs.length > 1) {
      map.fitBounds(latLngs, { padding: [24, 24] })
    } else if (latLngs.length === 1) {
      map.setView(latLngs[0], 15)
    }

    setTimeout(() => map.invalidateSize(), 120)
  }, [activeSection, displayedLocation, filteredBreadcrumbPoints, leafletReady])

  useEffect(() => {
    return () => {
      if (locationLeafletMapRef.current) {
        locationLeafletMapRef.current.remove()
        locationLeafletMapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (
      (activeSection !== 'settings-advanced' && activeSection !== 'device-detail-advanced') ||
      !leafletReady ||
      !geofenceLeafletRef.current ||
      !geofenceCenterLocation ||
      typeof window === 'undefined' ||
      !window.L
    ) return

    const L = window.L
    const currentContainer = geofenceLeafletMapRef.current?.getContainer?.()
    if (geofenceLeafletMapRef.current && currentContainer !== geofenceLeafletRef.current) {
      geofenceLeafletMapRef.current.remove()
      geofenceLeafletMapRef.current = null
      geofenceLeafletLayerRef.current = null
    }

    if (!geofenceLeafletMapRef.current) {
      geofenceLeafletMapRef.current = L.map(geofenceLeafletRef.current, { zoomControl: true })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(geofenceLeafletMapRef.current)
      geofenceLeafletLayerRef.current = L.layerGroup().addTo(geofenceLeafletMapRef.current)
    }

    const map = geofenceLeafletMapRef.current
    const layer = geofenceLeafletLayerRef.current || L.layerGroup().addTo(map)
    layer.clearLayers()

    const center = [geofenceCenterLocation.latitude, geofenceCenterLocation.longitude]
    const radiusMeters = parseGeoFenceRadiusToMeters(activeGeoFenceConfig.radius)
    const modeLabel = String(activeGeoFenceConfig.mode || '0') === '1' ? 'Enter alert' : 'Leave alert'
    const enabled = String(activeGeoFenceConfig.enabled || '0') === '1'

    L.marker(center)
      .bindPopup(`Geo-fence #${activeGeoFenceConfig.slot} center<br/>Mode: ${modeLabel}<br/>Radius: ${radiusMeters} m`)
      .addTo(layer)
    L.circle(center, {
      radius: radiusMeters,
      color: enabled ? '#0369a1' : '#6b7280',
      fillColor: enabled ? '#38bdf8' : '#d1d5db',
      fillOpacity: enabled ? 0.22 : 0.12,
      weight: 2
    }).addTo(layer)

    map.setView(center, 15)
    setTimeout(() => map.invalidateSize(), 120)
  }, [activeGeoFenceConfig, activeSection, geofenceCenterLocation, leafletReady])

  useEffect(() => {
    return () => {
      if (geofenceLeafletMapRef.current) {
        geofenceLeafletMapRef.current.remove()
        geofenceLeafletMapRef.current = null
      }
    }
  }, [])

  const userDeviceRows = useMemo(() => {
    const currentUserId = Number(user?.id || user?.userId || user?.user_id || 0)
    const ownedDevices = devices.filter((device) => {
      const ownerId = Number(device.ownerUserId || device.userId || device.user_id || device.owner?.id || device.app_user?.id || 0)
      return currentUserId > 0 && ownerId === currentUserId
    })

    const currentDevice = ownedDevices[0] || devices[0]
    if (!currentDevice) return []
    const alarmTriggeredAt = currentDevice.alarmTriggeredAt || currentDevice.alarm_triggered_at || null
    const alarmCancelledAt = currentDevice.alarmCancelledAt || currentDevice.alarm_cancelled_at || null

    const deviceMeta = resolveDeviceMeta(currentDevice)
    return [
      ['Device Name', currentDevice.name || currentDevice.deviceName || '-'],
      ['Device Phone Number', currentDevice.phoneNumber || '-'],
      ['Alarm Status', resolveLiveAlarmCode(currentDevice) || 'No active alarm'],
      ['Alarm Triggered', formatTimestamp(alarmTriggeredAt)],
      ['Alarm Cancelled', formatTimestamp(alarmCancelledAt)],
      ['Last Power ON', formatTimestamp(currentDevice.lastPowerOnAt || currentDevice.last_power_on_at)],
      ['Last Power OFF', formatTimestamp(currentDevice.lastPowerOffAt || currentDevice.last_power_off_at)],
      ['Last Disconnected', formatTimestamp(currentDevice.lastDisconnectedAt || currentDevice.last_disconnected_at)],
      ['Owner User', deviceMeta.ownerName],
      ['Owner Location', deviceMeta.ownerLocation],
      ['Last reply', replyRows[0]?.receivedAt || 'No reply yet'],
      ['Battery status', currentDevice.batteryStatus || currentDevice.battery || 'Unknown']
    ]
  }, [devices, formatTimestamp, replyRows, user, resolveDeviceMeta, resolveLiveAlarmCode])

  const getAlarmCancelledAt = useCallback((device) => {
    const internalId = Number(device?.id || device?.deviceId || 0)
    const externalId = String(device?.externalDeviceId || device?.external_device_id || '').trim()
    const liveEntry =
      (internalId ? alarmStateByDevice?.[`id:${internalId}`] : null) ||
      (externalId ? alarmStateByDevice?.[`ext:${externalId}`] : null)

    return (
      liveEntry?.alarmCancelledAt ||
      liveEntry?.alarm_cancelled_at ||
      device?.alarmCancelledAt ||
      device?.alarm_cancelled_at ||
      (internalId ? alarmCancelledAtByDevice?.[`id:${internalId}`] : null) ||
      (externalId ? alarmCancelledAtByDevice?.[`ext:${externalId}`] : null) ||
      null
    )
  }, [alarmCancelledAtByDevice, alarmStateByDevice])

  const getAlarmTriggeredAt = useCallback((device) => {
    const internalId = Number(device?.id || device?.deviceId || 0)
    const externalId = String(device?.externalDeviceId || device?.external_device_id || '').trim()
    const liveEntry =
      (internalId ? alarmStateByDevice?.[`id:${internalId}`] : null) ||
      (externalId ? alarmStateByDevice?.[`ext:${externalId}`] : null)

    return (
      liveEntry?.alarmTriggeredAt ||
      liveEntry?.alarm_triggered_at ||
      (liveEntry?.alarmCode === null ? null : undefined) ||
      device?.alarmTriggeredAt ||
      device?.alarm_triggered_at ||
      null
    )
  }, [alarmStateByDevice])

  const handleCancelAlarm = useCallback(async (device) => {
    try {
      await onCancelDeviceAlarm?.(device)
      const cancelledDeviceId = Number(device?.id || device?.deviceId || 0)
      if (cancelledDeviceId) {
        setAlarmLogDeviceId(String(cancelledDeviceId))
        await loadAlarmLogs(cancelledDeviceId)
      }
      setActionStatus({ type: 'success', message: `Alarm cancelled for ${device?.name || device?.deviceName || 'device'}. Alarm logs refreshed.` })
      await loadDevices()
    } catch (error) {
      setActionStatus({ type: 'error', message: `Cancel alarm failed: ${error.message}` })
    }
  }, [loadAlarmLogs, loadDevices, onCancelDeviceAlarm])

  const renderRaw = (value) => {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  }

  const tryParseJsonString = (value) => {
    if (typeof value !== 'string') return value
    try {
      return JSON.parse(value)
    } catch (error) {
      return value
    }
  }

  const splitWebhookParts = (event) => {
    const parsedPayloadJson = tryParseJsonString(event?.payloadJson)

    const headers =
      event?.headers ??
      event?.requestHeaders ??
      event?.rawHeaders ??
      (parsedPayloadJson && typeof parsedPayloadJson === 'object' ? parsedPayloadJson.rawHeaders : null)

    const payload =
      event?.body ??
      event?.payload ??
      event?.rawBody ??
      (parsedPayloadJson && typeof parsedPayloadJson === 'object' ? parsedPayloadJson.rawBody : parsedPayloadJson)

    const timestamp = event?.receivedAt || event?.timestamp || event?.createdAt || event?.date || null

    return { headers, payload, timestamp, rawEvent: event }
  }

  const extractAlarmAttempts = useCallback((event) => {
    if (Array.isArray(event?.alarmAttempts)) return event.alarmAttempts

    const parsedPayloadJson = tryParseJsonString(event?.payloadJson)
    if (Array.isArray(parsedPayloadJson?.alarmAttempts)) return parsedPayloadJson.alarmAttempts

    const payload = tryParseJsonString(event?.payload ?? event?.body ?? event?.rawBody)
    if (Array.isArray(payload?.alarmAttempts)) return payload.alarmAttempts

    return []
  }, [])


  const queueStatusLabel = String(configQueue?.status || 'IDLE').toUpperCase()
  const isQueuePending = Boolean(configQueue?.pending || queueStatusLabel === 'PENDING')
  const nextResendAtMs = configQueue?.nextResendAt ? new Date(configQueue.nextResendAt).getTime() : null
  const nowMs = Date.now()
  const resendRemainingMs = nextResendAtMs ? Math.max(nextResendAtMs - nowMs, 0) : 0
  const resendCooldownActive = isQueuePending && Boolean(nextResendAtMs) && resendRemainingMs > 0
  const resendRemainingText = resendCooldownActive
    ? `${Math.ceil(resendRemainingMs / 1000)}s`
    : 'Ready now'
  const queuedCommandPreview = (configQueue?.commandPreview || '').trim()
  const activeCommandPreview = (draftCommandPreview || '').trim()
  const hasActiveCommand = Boolean(activeCommandPreview)
  const hasQueuedCommand = Boolean(queuedCommandPreview)
  const hasCommandChanges = hasActiveCommand && activeCommandPreview !== queuedCommandPreview
  const activeDeviceSettingsSection = activeSection.startsWith('device-detail-') ? activeSection : ''
  const configChangeRows = useMemo(() => {
    const safeBaseline = configBaseline && typeof configBaseline === 'object' ? configBaseline : {}
    const safeForm = configForm && typeof configForm === 'object' ? configForm : {}
    const changedKeys = new Set([
      ...Object.keys(safeBaseline),
      ...Object.keys(safeForm)
    ])

    return [...changedKeys]
      .filter((key) => JSON.stringify(safeBaseline?.[key] ?? null) !== JSON.stringify(safeForm?.[key] ?? null))
      .map((key) => ({
        key,
        before: safeBaseline?.[key] ?? '-',
        after: safeForm?.[key] ?? '-'
      }))
  }, [configBaseline, configForm])
  const workspaceConfigChangesBySection = useMemo(() => {
    return configChangeRows.reduce((acc, entry) => {
      const sectionKey = resolveConfigSectionForField(entry.key)
      acc[sectionKey] = (acc[sectionKey] || 0) + 1
      return acc
    }, {})
  }, [configChangeRows])
  const workspaceDeviceMeta = useMemo(() => {
    if (!selectedWorkspaceDevice) return null
    return resolveDeviceMeta(selectedWorkspaceDevice)
  }, [resolveDeviceMeta, selectedWorkspaceDevice])
  const workspaceDeviceProfileChanged = useMemo(() => {
    if (!selectedWorkspaceDevice) return false
    const selectedOwnerId = String(selectedWorkspaceDevice.ownerUserId || selectedWorkspaceDevice.userId || selectedWorkspaceDevice.user_id || selectedWorkspaceDevice.owner?.id || selectedWorkspaceDevice.app_user?.id || '')
    const selectedLocationId = String(selectedWorkspaceDevice.locationId || selectedWorkspaceDevice.location_id || '')
    const selectedExternalId = String(selectedWorkspaceDevice.externalDeviceId || selectedWorkspaceDevice.external_device_id || selectedWorkspaceDevice.deviceId || '')
    const selectedSimIccid = String(selectedWorkspaceDevice.simIccid || '')
    return (
      String(deviceForm.name || '') !== String(selectedWorkspaceDevice.name || selectedWorkspaceDevice.deviceName || '') ||
      String(deviceForm.phoneNumber || '') !== String(selectedWorkspaceDevice.phoneNumber || '') ||
      String(deviceForm.eviewVersion || '') !== String(selectedWorkspaceDevice.eviewVersion || selectedWorkspaceDevice.version || '') ||
      String(deviceForm.ownerUserId || '') !== selectedOwnerId ||
      String(deviceForm.locationId || '') !== selectedLocationId ||
      String(deviceForm.externalDeviceId || '') !== selectedExternalId ||
      String(deviceForm.simIccid || '') !== selectedSimIccid
    )
  }, [deviceForm, selectedWorkspaceDevice])
  const hasPendingWorkspaceChanges = workspaceDeviceProfileChanged || configChangeRows.length > 0
  const geoFenceRawRadius = String(activeGeoFenceConfig.radius || '').trim().toLowerCase()
  const isGeoFenceRadiusRawValid = !geoFenceRawRadius || /^(\d+(?:\.\d+)?)(m|meter|meters|km|kilometer|kilometers)?$/.test(geoFenceRawRadius)
  const workspaceSettingSuggestions = useMemo(() => {
    const query = workspaceSettingQuery.trim().toLowerCase()
    if (!query) return workspaceSettingCatalog.slice(0, 8)
    return workspaceSettingCatalog
      .filter((entry) => entry.label.toLowerCase().includes(query))
      .slice(0, 8)
  }, [workspaceSettingQuery])

  const formatConfigValue = (value) => {
    if (value === null || value === undefined || value === '') return '-'
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }

  const updateActiveGeoFenceConfig = (updates) => {
    const targetSlot = activeGeoFenceConfig.slot
    setConfigForm((prev) => {
      const currentEntries = buildGeoFencesFromForm(prev)
      const nextEntries = currentEntries.map((entry) => (
        entry.slot === targetSlot ? { ...entry, ...updates } : entry
      ))
      const primaryGeoFence = nextEntries[0] || activeGeoFenceConfig
      return {
        ...prev,
        geoFences: nextEntries,
        geoFenceCount: String(nextEntries.length),
        geoFenceEnabled: primaryGeoFence.enabled,
        geoFenceMode: primaryGeoFence.mode,
        geoFenceRadius: primaryGeoFence.radius
      }
    })
  }

  const addGeoFenceConfig = () => {
    setConfigForm((prev) => {
      const currentEntries = buildGeoFencesFromForm(prev)
      if (currentEntries.length >= 4) return prev
      const nextSlot = [1, 2, 3, 4].find((slot) => !currentEntries.some((entry) => entry.slot === slot))
      if (!nextSlot) return prev
      const seed = currentEntries[currentEntries.length - 1] || { enabled: '1', mode: '0', radius: '100m' }
      const nextEntries = [...currentEntries, { slot: nextSlot, enabled: seed.enabled, mode: seed.mode, radius: seed.radius }]
      const primaryGeoFence = nextEntries[0]
      return {
        ...prev,
        geoFences: nextEntries,
        geoFenceCount: String(nextEntries.length),
        geoFenceEnabled: primaryGeoFence.enabled,
        geoFenceMode: primaryGeoFence.mode,
        geoFenceRadius: primaryGeoFence.radius
      }
    })
    setSelectedGeoFenceSlot((prev) => {
      const nextSlot = [1, 2, 3, 4].find((slot) => !geoFenceConfigs.some((entry) => entry.slot === slot))
      return nextSlot || prev
    })
  }

  const openConfigReview = () => {
    if (!configForm.deviceId) {
      setActionStatus({ type: 'error', message: 'Open a device first before saving device changes.' })
      return
    }
    if (!configChangeRows.length) {
      setActionStatus({ type: 'info', message: 'No device changes detected yet.' })
      return
    }
    setShowConfigReviewModal(true)
  }

  const applyDefaultsAndSendConfig = async () => {
    if (!configForm.deviceId) {
      setActionStatus({ type: 'error', message: 'Select a device before resetting defaults.' })
      return
    }
    setConfirmDialog({
      open: true,
      message: 'Reset this device to its default settings',
      onConfirm: async () => {
        const defaultedForm = applySupportedDeviceDefaults({
          ...(configForm && typeof configForm === 'object' ? configForm : {})
        })
        setConfigForm(defaultedForm)
        await sendConfig(defaultedForm)
      }
    })
  }

  const confirmSendConfig = async () => {
    try {
      await sendConfig()
      setConfigBaseline({ ...(configForm && typeof configForm === 'object' ? configForm : {}) })
      setShowConfigReviewModal(false)
    } catch (error) {
      setActionStatus({ type: 'error', message: `Save & send failed: ${error?.message || 'Unknown error'}` })
    }
  }

  const moveToDeviceSection = (nextSection, { force = false } = {}) => {
    if (!force && isDeviceWorkspaceSection && !isDeviceDetailSection(nextSection) && hasPendingWorkspaceChanges) {
      setConfirmDialog({
        open: true,
        message: 'You have unsaved device changes. Leave this workspace anyway?',
        onConfirm: () => setActiveSection(nextSection)
      })
      return false
    }
    setActiveSection(nextSection)
    return true
  }

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, message: '', onConfirm: null })
  }

  const confirmDialogAction = async () => {
    const callback = confirmDialog.onConfirm
    closeConfirmDialog()
    if (typeof callback !== 'function') return
    await callback()
  }

  const jumpToChangedField = (fieldKey) => {
    const section = resolveConfigSectionForField(fieldKey)
    setShowConfigReviewModal(false)
    moveToDeviceSection(section, { force: true })
  }

  const openWorkspaceSetting = (entry) => {
    if (!entry) return
    if (entry.advancedTab) setAdvancedSettingsTab(entry.advancedTab)
    moveToDeviceSection(entry.section, { force: true })
    setWorkspaceSettingQuery('')
    if (!entry.anchorId || typeof window === 'undefined') return
    window.setTimeout(() => {
      const target = document.getElementById(entry.anchorId)
      if (!target) return
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (typeof target.focus === 'function') target.focus({ preventScroll: true })
    }, 120)
  }

  const handleSectionChange = (section) => {
    moveToDeviceSection(section)
    if (section !== 'user-detail') setSelectedUserId('')
    if (section !== 'location-detail') setSelectedLocationId('')
    if (!isDeviceDetailSection(section)) setSelectedDeviceId('')
  }

  return (
    <div className={`home-shell ${isDeviceWorkspaceSection ? 'is-device-detail-page' : ''}`}>
      <Sidebar
        activeSection={activeSection}
        onChangeSection={handleSectionChange}
        onLogout={onLogout}
        showDeviceCenter={false}
        isSuperAdmin={isSuperAdmin}
      />

      <div className="dashboard-content">
        {dataStatus ? <p className="status">{dataStatus}</p> : null}
        {isDeviceWorkspaceSection ? (
          <Suspense fallback={<p className="status">Loading device workspace...</p>}>
            <DeviceSettingsPage
            actionStatus={actionStatus}
            workspaceSettingQuery={workspaceSettingQuery}
            setWorkspaceSettingQuery={setWorkspaceSettingQuery}
            workspaceSettingSuggestions={workspaceSettingSuggestions}
            openWorkspaceSetting={openWorkspaceSetting}
            activeDeviceSettingsSection={activeDeviceSettingsSection}
            moveToDeviceSection={moveToDeviceSection}
            deviceWorkspaceLoading={deviceWorkspaceLoading}
            openConfigReview={openConfigReview}
            configForm={configForm}
            configChangeRows={configChangeRows}
            selectedWorkspaceDevice={selectedWorkspaceDevice}
            workspaceDeviceMeta={workspaceDeviceMeta}
            hasPendingWorkspaceChanges={hasPendingWorkspaceChanges}
            />
          </Suspense>
        ) : (
          actionStatus.message && actionStatus.type === 'error'
            ? <p className="status-error">{actionStatus.message}</p>
            : null
        )}

        {activeSection === 'dashboard' && (
          <>
            {!isAdminDashboard ? <h2 className="page-title">My Device Dashboard</h2> : null}
            <section className="live-alarm-strip">
              <div>
                <strong>Live alarm feed</strong>
                <p>
                  {alarmStreamConnected
                    ? (alarmFeed.length ? 'Receiving global alarm updates in real time.' : 'Connected. Waiting for incoming alarm updates...')
                    : 'Live updates reconnecting…'}
                </p>
              </div>
              <div className="live-alarm-list">
                <span className={`live-connection-chip ${alarmStreamConnected ? 'is-connected' : 'is-reconnecting'}`}>
                  {alarmStreamConnected ? 'Live connected' : 'Reconnecting…'}
                </span>
                {alarmFeed.slice(0, 3).map((entry, index) => {
                  const alarmMeta = getAlarmMeta(entry?.alarmCode)
                  return (
                    <span key={`${entry?.updatedAt || 'alarm'}-${entry?.deviceId || 'device'}-${index}`} className={`alarm-pill alarm-pill-${alarmMeta.tone}`}>
                      #{entry?.deviceId || entry?.externalDeviceId || '-'} · {alarmMeta.label}
                    </span>
                  )
                })}
              </div>
            </section>

            {isAdminDashboard ? (
              <>
                <section className="dashboard-hero-shell">
                  <article className="dashboard-hero">
                    <div className="dashboard-hero-backdrop" aria-hidden="true" />
                    <div className="dashboard-hero-top">
                      <div>
                        <p className="dashboard-hero-kicker">Operations overview</p>
                        <h3>Mission Control Dashboard</h3>
                      </div>
                      <div className="dashboard-hero-actions">
                        <span className="hero-pill">Live</span>
                        <span className="hero-pill">Global</span>
                      </div>
                    </div>
                    <div className="dashboard-hero-widgets">
                      <section className="metric-grid">
                        {metrics.map((metric) => (
                          <button
                            type="button"
                            key={metric.label}
                            className="metric-card metric-card-link"
                            onClick={() => setActiveSection(metric.section)}
                          >
                            <div className="metric-card-head">
                              <span className="metric-card-title"><AppIcon name={metric.icon} className="card-icon" />{metric.label}</span>
                              {metric.hasRangeControl ? (
                                <label className="metric-range-select" onClick={(event) => event.stopPropagation()}>
                                  <span className="sr-only">Error range</span>
                                  <select
                                    value={errorLogRange}
                                    onChange={(event) => setErrorLogRange(event.target.value)}
                                  >
                                    {errorRangeOptions.map((option) => (
                                      <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                  </select>
                                </label>
                              ) : (
                                <span className="metric-card-menu">⋮</span>
                              )}
                            </div>
                            <div className="metric-card-body">
                              <h3>{Number(metric.value || 0).toLocaleString()}</h3>
                              <span className="metric-card-jump">↗</span>
                            </div>
                          </button>
                        ))}
                      </section>
                    </div>
                  </article>
                </section>

                <section className="dashboard-top-layout">
                  <article className="card-like superadmin-map-panel">
                    <div className="map-panel-head">
                      <div>
                        <h3>Live Device Location Overview</h3>
                        <p>Shows devices with active alerts. Click an alert card to focus the map on that device.</p>
                      </div>
                      <div className="map-kpi-stack">
                        <span className="map-kpi-chip">
                          <strong>{activeAlarmLocations.length}</strong>
                          <small>Alert devices on map</small>
                        </span>
                        <span className="map-kpi-chip">
                          <strong>{activeAlarmLocations[0]?.updatedAt ? new Date(activeAlarmLocations[0].updatedAt).toLocaleString() : '—'}</strong>
                          <small>Freshest update</small>
                        </span>
                      </div>
                    </div>
                    {activeAlarmLocations.length ? (
                      <div className="dashboard-map-layout">
                        <div className="map-placeholder map-square dashboard-live-map">
                          {leafletReady ? <div ref={dashboardLeafletRef} className="leaflet-map" /> : <span className="map-chip">Loading map…</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="map-placeholder map-square">
                        <span className="map-chip">No active alert locations to map yet.</span>
                      </div>
                    )}
                  </article>

                  <aside className="active-alerts card-like">
                    <div className="section-head">
                      <div className="active-alerts-title">
                        <h3>Active Alerts</h3>
                        <span className="active-alert-count" aria-label={`${activeAlarmDevices.length} active alerts`}>{activeAlarmDevices.length}</span>
                      </div>
                      <div className="alert-head-actions">
                        <button
                          type="button"
                          className="table-link action-chip action-chip-neutral"
                          onClick={() => setDashboardMapDeviceId('')}
                          disabled={!selectedAlertLocation}
                        >
                          Show all on map
                        </button>
                      </div>
                    </div>
                    <div className="active-alerts-list">
                      {activeAlarmLocations.length ? paginatedActiveAlerts.map(({ device, alarmCode, updatedAt, deviceKey }) => {
                        const meta = resolveDeviceMeta(device)
                        const alarmMeta = getAlarmMeta(alarmCode)
                        const isMapFocused = String(dashboardMapDeviceId) === String(deviceKey)
                        return (
                          <button
                            type="button"
                            key={`alarm-${device.id || device.deviceId || device.phoneNumber}`}
                            className={`active-alert-row ${isMapFocused ? 'is-map-focused' : ''}`}
                            onClick={() => setDashboardMapDeviceId(deviceKey)}
                          >
                            <div className="active-alert-row-inline">
                              <span className={`active-alert-dot tone-${alarmMeta.tone}`} aria-hidden="true" />
                              <div className="active-alert-row-copy">
                                <strong>{device.name || device.deviceName || 'Unnamed device'}</strong>
                                <span>{meta.ownerName}</span>
                              </div>
                              <span className={`alarm-pill alarm-pill-${alarmMeta.tone}`}>{alarmMeta.label}</span>
                              <small>{formatAlertTimestamp(updatedAt)}</small>
                              <span className="active-alert-chevron" aria-hidden="true">›</span>
                            </div>
                          </button>
                        )
                      }) : <p className="status">No active alerts right now.</p>}
                    </div>
                    <div className="table-pagination">
                      <button type="button" className="table-link action-chip action-chip-neutral" disabled={activeAlertPage <= 1} onClick={() => setActiveAlertPage((prev) => Math.max(prev - 1, 1))}>Prev</button>
                      <span>Page {activeAlertPage} of {activeAlertTotalPages}</span>
                      <button type="button" className="table-link action-chip action-chip-neutral" disabled={activeAlertPage >= activeAlertTotalPages} onClick={() => setActiveAlertPage((prev) => Math.min(prev + 1, activeAlertTotalPages))}>Next</button>
                    </div>
                  </aside>
                </section>

                <section className="dashboard-main-grid">
                  <article className="device-overview card-like">
                    <h3>Device List</h3>
                    <div className="table-controls">
                      <input
                        placeholder="Search device, owner, role, location..."
                        value={dashboardDeviceSearch}
                        onChange={(event) => setDashboardDeviceSearch(event.target.value)}
                      />
                      <select value={dashboardDeviceAlertFilter} onChange={(event) => setDashboardDeviceAlertFilter(event.target.value)}>
                        <option value="all">All devices</option>
                        <option value="active">Active alerts only</option>
                        <option value="inactive">No active alerts</option>
                        {dashboardAlertCodeOptions.map((alarmCode) => (
                          <option key={`dashboard-alert-code-${alarmCode}`} value={`code:${alarmCode}`}>
                            {alarmCode}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="table-shell dashboard-device-table">
                      <table className="data-table">
                        <thead><tr><th>Device</th><th>Alarm</th><th>Owner</th><th>Role</th><th>Location</th></tr></thead>
                        <tbody>
                          {paginatedDashboardDevices.map((device) => {
                            const meta = resolveDeviceMeta(device)
                            const alarmMeta = getAlarmMeta(resolveLiveAlarmCode(device))
                            return (
                              <tr key={device.id || device.phoneNumber || device.name}>
                                <td>{device.name || device.deviceName || '-'}</td>
                                <td><span className={`alarm-pill alarm-pill-${alarmMeta.tone}`}>{alarmMeta.label}</span></td>
                                <td>{meta.ownerName}</td>
                                <td>{meta.ownerRole}</td>
                                <td>{meta.ownerLocation}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="table-pagination">
                      <button type="button" className="table-link action-chip action-chip-neutral" disabled={dashboardDevicePage <= 1} onClick={() => setDashboardDevicePage((prev) => Math.max(prev - 1, 1))}>Prev</button>
                      <span>Page {dashboardDevicePage} of {dashboardTotalPages}</span>
                      <button type="button" className="table-link action-chip action-chip-neutral" disabled={dashboardDevicePage >= dashboardTotalPages} onClick={() => setDashboardDevicePage((prev) => Math.min(prev + 1, dashboardTotalPages))}>Next</button>
                    </div>
                  </article>

                  <aside className="action-stack card-like dashboard-status-panel">
                    <h3>System Pulse</h3>
                    <p>Keep an eye on feed health and latest incoming alarm events.</p>
                    <div className="dashboard-status-items">
                      <div>
                        <strong>{alarmStreamConnected ? 'Connected' : 'Reconnecting'}</strong>
                        <span>Alarm stream state</span>
                      </div>
                      <div>
                        <strong>{alarmFeed.length}</strong>
                        <span>Recent feed events</span>
                      </div>
                      <div>
                        <strong>{activeAlarmDevices.length}</strong>
                        <span>Devices with active alerts</span>
                      </div>
                    </div>
                  </aside>
                </section>
              </>
            ) : (
              <section className="dashboard-main-grid user-dashboard-grid">
                <article className="device-overview card-like">
                  <h3>My Assigned Device</h3>
                  <div className="device-panel">
                    <div className="device-photo-placeholder" />
                    <dl>
                      {(userDeviceRows.length ? userDeviceRows : [['Status', 'No assigned device found yet.']]).map(([label, value]) => (
                        <div className="device-row" key={label}><dt>{label}</dt><dd>{value}</dd></div>
                      ))}
                    </dl>
                  </div>
                </article>
              </section>
            )}
          </>
        )}

        {activeSection === 'users' && (
          <Suspense fallback={<p className="status">Loading users page...</p>}>
            <UsersPage
            loadLocations={loadLocations}
            loadUsers={loadUsers}
            loadCompanies={loadCompanies}
            setShowUserModal={setShowUserModal}
            userSearch={userSearch}
            setUserSearch={setUserSearch}
            userRoleFilter={userRoleFilter}
            setUserRoleFilter={setUserRoleFilter}
            userLocationFilter={userLocationFilter}
            setUserLocationFilter={setUserLocationFilter}
            userLocationOptions={userLocationOptions}
            pagedUsers={pagedUsers}
            usersPage={usersPage}
            setUsersPage={setUsersPage}
            openUserDetailPage={openUserDetailPage}
            roleLabel={roleLabel}
            getUserDevices={getUserDevices}
            />
          </Suspense>
        )}

        {activeSection === 'companies' && (
          <Suspense fallback={<p className="status">Loading companies page...</p>}>
            <CompaniesPage
            companySearch={companySearch}
            setCompanySearch={setCompanySearch}
            pagedCompanies={pagedCompanies}
            companiesPage={companiesPage}
            setCompaniesPage={setCompaniesPage}
            setShowCompanyModal={setShowCompanyModal}
            onEditCompany={openEditCompanyModal}
            />
          </Suspense>
        )}

        {activeSection === 'locations' && (
          <Suspense fallback={<p className="status">Loading locations page...</p>}>
            <LocationsPage
            setShowLocationModal={setShowLocationModal}
            locationSearch={locationSearch}
            setLocationSearch={setLocationSearch}
            locationDeviceFilter={locationDeviceFilter}
            setLocationDeviceFilter={setLocationDeviceFilter}
            pagedLocations={pagedLocations}
            locationsPage={locationsPage}
            setLocationsPage={setLocationsPage}
            openLocationDetailPage={openLocationDetailPage}
            />
          </Suspense>
        )}

        {activeSection === 'devices' && (
          <Suspense fallback={<p className="status">Loading devices page...</p>}>
            <DevicesPage
            devices={devices}
            loadUsers={loadUsers}
            loadLocations={loadLocations}
            setShowDeviceModal={setShowDeviceModal}
            deviceFilters={deviceFilters}
            setDeviceFilters={setDeviceFilters}
            deviceAlarmFilter={deviceAlarmFilter}
            setDeviceAlarmFilter={setDeviceAlarmFilter}
            pagedDevices={pagedDevices}
            resolveDeviceMeta={resolveDeviceMeta}
            getAlarmMeta={getAlarmMeta}
            resolveLiveAlarmCode={resolveLiveAlarmCode}
            getAlarmCancelledAt={getAlarmCancelledAt}
            handleCancelAlarm={handleCancelAlarm}
            openLocationDetailPage={openLocationDetailPage}
            openDeviceSettings={openDeviceSettings}
            onSetSimActivation={handleSetSimActivation}
            simActionPendingByDevice={simActionPendingByDevice}
            devicesPage={devicesPage}
            setDevicesPage={setDevicesPage}
            />
          </Suspense>
        )}


        {activeSection === 'bulk-sim' && isSuperAdmin && (
          <Suspense fallback={<p className="status">Loading bulk SIM manager...</p>}>
            <BulkSimPage
              devices={devices}
              selectedDeviceIds={bulkSimSelectedDeviceIds}
              setSelectedDeviceIds={setBulkSimSelectedDeviceIds}
              onBulkSetSimActivation={handleBulkSetSimActivation}
              simActionPendingByDevice={simActionPendingByDevice}
              loading={loading}
            />
          </Suspense>
        )}

        {activeSection === 'user-detail' && (
          <Suspense fallback={<p className="status">Loading user profile...</p>}>
            <UserDetailPage
            selectedUser={selectedUser}
            roleLabel={roleLabel}
            devices={devices}
            userForm={userForm}
            setUserForm={setUserForm}
            onSaveUser={handleUpdateUser}
            openDeviceSettings={openDeviceSettings}
            userDeviceSearch={userDetailDeviceSearch}
            setUserDeviceSearch={setUserDetailDeviceSearch}
            userDevicePage={userDetailDevicePage}
            setUserDevicePage={setUserDetailDevicePage}
            onBack={() => setActiveSection('users')}
            />
          </Suspense>
        )}

        {activeSection === 'location-detail' && (
          <Suspense fallback={<p className="status">Loading location profile...</p>}>
            <LocationDetailPage
            selectedLocation={selectedLocation}
            devices={devices}
            users={users}
            locationForm={locationForm}
            setLocationForm={setLocationForm}
            onSaveLocation={handleUpdateLocation}
            resolveDeviceMeta={resolveDeviceMeta}
            openDeviceSettings={openDeviceSettings}
            locationUserSearch={locationDetailUserSearch}
            setLocationUserSearch={setLocationDetailUserSearch}
            locationUserPage={locationDetailUserPage}
            setLocationUserPage={setLocationDetailUserPage}
            locationDeviceSearch={locationDetailDeviceSearch}
            setLocationDeviceSearch={setLocationDetailDeviceSearch}
            locationDevicePage={locationDetailDevicePage}
            setLocationDevicePage={setLocationDetailDevicePage}
            onBack={() => setActiveSection('locations')}
            />
          </Suspense>
        )}

        {activeSection === 'device-detail-overview' && (
          <section className="card-like section-panel">
            <h2 className="section-title">Device Info</h2>
            {!selectedDevice ? <p className="status">Open a device workspace from Devices list first.</p> : null}
            {deviceWorkspaceLoading ? <p className="status">Refreshing latest server values…</p> : null}
            <div className="field-grid two-col device-profile-grid">
              <div>
                <label htmlFor="setting-device-name">Device Name</label>
                <input id="setting-device-name" placeholder="Testdevice" value={deviceForm.name} onChange={(event) => setDeviceForm((prev) => ({ ...prev, name: event.target.value }))} />
              </div>
              <div>
                <label htmlFor="setting-device-phone">Phone Number</label>
                <input id="setting-device-phone" placeholder="12345" value={deviceForm.phoneNumber} onChange={(event) => setDeviceForm((prev) => ({ ...prev, phoneNumber: event.target.value }))} />
              </div>
              <div>
                <label htmlFor="setting-device-version">Device Version</label>
                <select id="setting-device-version" value={deviceForm.eviewVersion} onChange={(event) => setDeviceForm((prev) => ({ ...prev, eviewVersion: event.target.value }))}>
                  <option value="">Select Device Version</option>
                  {eviewDeviceVersionOptions.map((version) => <option key={version} value={version}>{version}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="setting-device-external-id">Webhook Device ID</label>
                <input id="setting-device-external-id" placeholder="Lorem Ipsum" value={deviceForm.externalDeviceId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, externalDeviceId: event.target.value }))} />
              </div>
              <div>
                <label htmlFor="setting-device-sim-iccid">SIM ICCID</label>
                <input id="setting-device-sim-iccid" placeholder="898821..." value={deviceForm.simIccid} onChange={(event) => setDeviceForm((prev) => ({ ...prev, simIccid: event.target.value }))} />
              </div>
              <div>
                <label htmlFor="setting-device-owner">Owner</label>
                <select id="setting-device-owner" value={deviceForm.ownerUserId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, ownerUserId: event.target.value }))}><option value="">Select User</option>{assignableUsers.map((entry) => <option key={entry.id || entry.email} value={entry.id || ''}>{`${entry.firstName || ''} ${entry.lastName || ''}`.trim() || entry.email}</option>)}</select>
              </div>
              <div>
                <label htmlFor="setting-device-location">Location (Optional)</label>
                <select id="setting-device-location" value={deviceForm.locationId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, locationId: event.target.value }))}><option value="">Location (Optional)</option>{selectableLocations.map((entry) => <option key={entry.id || entry.name} value={entry.id || ''}>{entry.name || 'Unknown location'}</option>)}</select>
              </div>
            </div>
            {selectedWorkspaceDevice ? (
              <div className="lifecycle-grid">
                <div className="lifecycle-card"><strong>Alarm Status</strong><span>{getAlarmMeta(resolveLiveAlarmCode(selectedWorkspaceDevice)).label}</span></div>
                <div className="lifecycle-card"><strong>Alarm Triggered</strong><span>{formatTimestamp(getAlarmTriggeredAt(selectedWorkspaceDevice))}</span></div>
                <div className="lifecycle-card"><strong>Alarm Cancelled</strong><span>{formatTimestamp(getAlarmCancelledAt(selectedWorkspaceDevice))}</span></div>
                <div className="lifecycle-card"><strong>Last Power ON</strong><span>{formatTimestamp(selectedWorkspaceDevice.lastPowerOnAt || selectedWorkspaceDevice.last_power_on_at)}</span></div>
                <div className="lifecycle-card"><strong>Last Power OFF</strong><span>{formatTimestamp(selectedWorkspaceDevice.lastPowerOffAt || selectedWorkspaceDevice.last_power_off_at)}</span></div>
                <div className="lifecycle-card"><strong>Last Disconnected</strong><span>{formatTimestamp(selectedWorkspaceDevice.lastDisconnectedAt || selectedWorkspaceDevice.last_disconnected_at)}</span></div>
              </div>
            ) : null}
            <div className="device-quick-actions">
              <button className="table-link action-chip action-chip-neutral" type="button" onClick={() => moveToDeviceSection('device-detail-location', { force: true })}>Go to Live Location</button>
              <button className="table-link action-chip action-chip-primary device-detail-btn-primary" type="button" onClick={requestLocationUpdate} disabled={loading}>Request Location Now</button>
              <button
                className="table-link action-chip action-chip-neutral"
                type="button"
                onClick={() => handleImeiResend(editingDeviceId, { showGlobalStatus: true })}
                disabled={!editingDeviceId}
              >
                Retry IMEI Request (V?)
              </button>
              <button className="table-link action-chip action-chip-danger" type="button" onClick={() => selectedWorkspaceDevice && handleCancelAlarm(selectedWorkspaceDevice)} disabled={!selectedWorkspaceDevice || !resolveLiveAlarmCode(selectedWorkspaceDevice)}>Cancel Active Alarm</button>
              <button className="table-link action-chip action-chip-neutral" type="button" onClick={() => moveToDeviceSection('device-detail-commands', { force: true })}>Open Command Center</button>
            </div>
            <div className="device-profile-actions">
              <button className="mini-action device-detail-btn-primary" disabled={!editingDeviceId || !workspaceDeviceProfileChanged} onClick={handleUpdateDevice}>Save Device Info</button>
              <button className="mini-action device-detail-btn-primary" type="button" onClick={openConfigReview} disabled={!configForm.deviceId || !configChangeRows.length}>Review &amp; Send</button>
            </div>
          </section>
        )}

        {(activeSection === 'settings-basic' || activeSection === 'device-detail-basic') && (
          <section className="card-like section-panel">
            <div className="basic-config-header">
              <div>
                <h2 className="section-title basic-config-title">{selectedDevice?.name || selectedDevice?.deviceName || 'Device Profile'}</h2>
                <p className="status basic-config-meta">
                  Phone {selectedDevice?.phoneNumber || selectedWorkspaceDevice?.phoneNumber || '-'} · IMEI {configForm.imei || selectedDevice?.imei || '-'}
                </p>
              </div>
              <div className="workspace-context-chips">
                <span className={`map-kpi-chip compact status-chip status-chip-loaded ${deviceWorkspaceLoading ? 'is-loading' : ''}`}>
                  <span className="chip-icon-dot" aria-hidden="true" />
                  {deviceWorkspaceLoading ? 'Refreshing…' : 'Loaded'}
                </span>
                <span className="map-kpi-chip compact status-chip status-chip-location">
                  <AppIcon name="location" className="chip-inline-icon" />
                  {workspaceDeviceMeta?.ownerLocation || 'No location'}
                </span>
                <span className={`map-kpi-chip compact ${hasPendingWorkspaceChanges ? 'is-pending' : ''}`}>{hasPendingWorkspaceChanges ? 'Unsaved changes' : 'All changes saved'}</span>
              </div>
            </div>
            {!selectedWorkspaceDevice && !selectedDevice ? (
              <div className="basic-config-tip-banner">
                <span className="basic-config-tip-icon" aria-hidden="true" />
                <div>
                  <strong>Select a device from Devices list to configure.</strong>
                  <p>Tip: Keep contact #1 as the primary emergency contact and validate numbers before sending commands.</p>
                </div>
              </div>
            ) : null}

            <article className="settings-group">
              <h3 className="block-title">Basic Configuration</h3>
              <div className="field-grid two-col">
                <div><label>IMEI</label><input className="basic-config-input" value={configForm.imei} placeholder="Testdevice" readOnly /></div>
                <div id="setting-prefix-name" tabIndex={-1}><label className="label-with-default-hint">Device Name<SettingDefaultHint field="prefixName" /></label><input className="basic-config-input" title={defaultSettingTooltipByField.prefixName} value={configForm.prefixName} placeholder="Testdevice" onChange={(event) => setConfigForm((prev) => ({ ...prev, prefixName: event.target.value }))} /></div>
                <div id="setting-sms-password" tabIndex={-1}><label className="label-with-default-hint">SMS Password<SettingDefaultHint field="smsPassword" /></label><input className="basic-config-input" title={defaultSettingTooltipByField.smsPassword} value={configForm.smsPassword} placeholder="Lorem Ipsum" onChange={(event) => setConfigForm((prev) => ({ ...prev, smsPassword: event.target.value }))} /><small className="field-hint">Default: 123456 (unless modified on the device)</small></div>
                <div>
                  <label className="label-with-default-hint">SMS White List<SettingDefaultHint field="smsWhitelistEnabled" /></label>
                  <label className="switch-row"><input type="checkbox" checked={configForm.smsWhitelistEnabled} onChange={() => toggle('smsWhitelistEnabled')} /><span className="switch-pill" title={defaultSettingTooltipByField.smsWhitelistEnabled}>{configForm.smsWhitelistEnabled ? 'On' : 'Off'}</span></label>
                  {isSuperAdmin ? (
                    <button
                      className="mini-action add-contact-btn device-detail-btn-primary"
                      type="button"
                      onClick={() => {
                        setConfigForm((prev) => ({ ...prev, smsWhitelistEnabled: true }))
                        updateAuthorizedNumbers((numbers) => {
                          const safeNumbers = numbers.slice(0, 10)
                          if (safeNumbers.length >= 10) return safeNumbers
                          return [...safeNumbers, '']
                        })
                      }}
                      disabled={getAuthorizedNumbers(configForm).length >= 10}
                    >
                      + Add Device to Whitelist
                    </button>
                  ) : null}
                </div>
              </div>
            </article>

            <article className="settings-group" id="setting-contacts" tabIndex={-1}>
              <div className="section-head">
                <h3 className="block-title label-with-default-hint">Contact Information<SettingDefaultHint field="contacts" /></h3>
              </div>
              {isSuperAdmin ? (
                <div className="field-grid two-col">
                  <div>
                    <label>Gateway Name</label>
                    <input
                      className="basic-config-input"
                      value={getContacts(configForm)[0]?.name || ''}
                      onChange={(event) => updateContacts((contacts) => contacts.map((entry, entryIndex) => (entryIndex === 0 ? { ...entry, name: event.target.value } : entry)))}
                      placeholder="SMS Gateway"
                    />
                  </div>
                  <div>
                    <label>Gateway Number (A1)</label>
                    <input
                      className="basic-config-input"
                      value={getContacts(configForm)[0]?.phone || ''}
                      onChange={(event) => {
                        const nextPhone = event.target.value
                        updateContacts((contacts) => contacts.map((entry, entryIndex) => (entryIndex === 0 ? { ...entry, phone: nextPhone } : entry)))
                        updateAuthorizedNumbers((numbers) => {
                          const next = numbers.length ? [...numbers] : ['']
                          next[0] = nextPhone
                          return next
                        })
                      }}
                      placeholder="+639693106202"
                    />
                    <small className="field-hint">Call delivery is forced OFF for gateway commands (`A1,1,0,...`) and cannot be changed.</small>
                  </div>
                  <div>
                    <label className="switch-row">
                      <input
                        type="checkbox"
                        checked={Boolean(configForm.applyGatewayToAllDevices)}
                        onChange={() => setConfigForm((prev) => ({ ...prev, applyGatewayToAllDevices: !prev.applyGatewayToAllDevices }))}
                      />
                      <span className="switch-pill">{configForm.applyGatewayToAllDevices ? 'Bulk On' : 'Bulk Off'}</span>
                    </label>
                    <small className="field-hint">When enabled, this gateway number is included in bulk settings payloads for all devices.</small>
                  </div>
                </div>
              ) : (
                <p className="status">Contact information is managed by Super Admin. This SMS gateway value is read-only for your role.</p>
              )}
              {isSuperAdmin ? (
                <div className="contact-table" style={{ marginTop: '1rem' }}>
                  <div className="section-head">
                    <h4 className="block-title">Whitelisted Numbers (A1-A10)</h4>
                    <button
                      className="mini-action add-contact-btn device-detail-btn-primary"
                      type="button"
                      onClick={() => updateAuthorizedNumbers((numbers) => [...numbers, ''])}
                      disabled={getAuthorizedNumbers(configForm).length >= 10}
                    >
                      + Add Number
                    </button>
                  </div>
                  <div className="contact-head"><span>Slot</span><span>Number</span><span>SMS</span><span>Call</span><span>Action</span></div>
                  {getAuthorizedNumbers(configForm).map((number, index) => (
                    <div className="contact-row" key={`whitelist-${index + 1}`}>
                      <span className="chip">A{index + 1}</span>
                      <input
                        className="basic-config-input"
                        value={number}
                        onChange={(event) => updateAuthorizedNumbers((numbers) => numbers.map((entry, entryIndex) => (entryIndex === index ? event.target.value : entry)))}
                        placeholder="+447111111111"
                      />
                      <span className="chip">1</span>
                      <span className="chip">0</span>
                      <button
                        className="table-link remove-contact-btn"
                        type="button"
                        onClick={() => updateAuthorizedNumbers((numbers) => numbers.length <= 1 ? [''] : numbers.filter((_, entryIndex) => entryIndex !== index))}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <small className="field-hint">Commands are sent as <code>A#,1,0,&lt;number&gt;</code> and blank numbers are skipped automatically.</small>
                </div>
              ) : null}
            </article>
            <div className="basic-config-footer-actions">
              <button
                className="table-link action-chip action-chip-neutral device-detail-btn-secondary"
                type="button"
                onClick={() => setConfigForm({ ...(configBaseline && typeof configBaseline === 'object' ? configBaseline : {}) })}
                disabled={!configChangeRows.length}
              >
                Discard Changes
              </button>
              <button
                className="table-link action-chip action-chip-neutral device-detail-btn-secondary"
                type="button"
                onClick={applyDefaultsAndSendConfig}
                disabled={!configForm.deviceId || loading}
                title="Apply default settings and send only the changed commands."
              >
                Reset to Defaults
              </button>
              <button className="mini-action device-detail-btn-primary" type="button" onClick={openConfigReview} disabled={!configForm.deviceId || !configChangeRows.length}>Apply Changes</button>
            </div>
          </section>
        )}

        {(activeSection === 'settings-advanced' || activeSection === 'device-detail-advanced') && (
          <section className="card-like section-panel advanced-settings-panel">
            {!isDeviceDetailAdvancedSection ? <h2 className="section-title">Advanced Configuration</h2> : null}
            {!isDeviceDetailAdvancedSection
              ? (selectedDevice ? <p className="status-success">Device workspace loaded.</p> : <p className="status">Select a device from Devices list to configure advanced settings.</p>)
              : null}
            <div className="advanced-tab-row">
              <button type="button" className={advancedSettingsTab === 'general' ? 'is-active' : ''} onClick={() => setAdvancedSettingsTab('general')}>General</button>
              <button type="button" className={advancedSettingsTab === 'alarm' ? 'is-active' : ''} onClick={() => setAdvancedSettingsTab('alarm')}>Alarm Controls</button>
              <button type="button" className={advancedSettingsTab === 'geofence' ? 'is-active' : ''} onClick={() => setAdvancedSettingsTab('geofence')}>Geo-fencing</button>
            </div>

            {advancedSettingsTab === 'general' ? (
              <article className="settings-group advanced-settings-group" id="setting-wifi-enabled" tabIndex={-1}>
              <h3 className="block-title advanced-block-title">General</h3>
              <div className="advanced-callout">
                <span className="advanced-callout-icon" aria-hidden="true" />
                <p>Use values in seconds for timing fields; avoid blank values to prevent malformed SMS commands.</p>
              </div>
              <div className="advanced-form-grid">
                <div className="advanced-form-row">
                  <label className="label-with-default-hint">Wi-Fi Positioning<SettingDefaultHint field="wifiEnabled" /></label>
                  <label className="switch-row">
                    <input type="checkbox" checked={configForm.wifiEnabled === '1'} onChange={() => setConfigForm((prev) => ({ ...prev, wifiEnabled: prev.wifiEnabled === '1' ? '0' : '1' }))} />
                    <span>{configForm.wifiEnabled === '1' ? 'On' : 'Off'}</span>
                  </label>
                </div>
                <div className="advanced-form-row" id="setting-speaker-volume" tabIndex={-1}>
                  <label className="label-with-default-hint">Speaker Volume<SettingDefaultHint field="speakerVolume" /></label>
                  <div className="range-with-value">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={configForm.speakerVolume}
                      style={getRangeProgressStyle(configForm.speakerVolume, 0, 100)}
                      onChange={(event) => setConfigForm((prev) => ({ ...prev, speakerVolume: event.target.value }))}
                    />
                    <span className="range-value">{configForm.speakerVolume}</span>
                  </div>
                </div>
                <div className="advanced-form-row">
                  <label className="label-with-default-hint">Continuous Tracking Interval (seconds)<SettingDefaultHint field="continuousLocateInterval" /></label>
                  <div>
                    <input type="number" min="5" step="1" value={configForm.continuousLocateInterval} onChange={(event) => setConfigForm((prev) => ({ ...prev, continuousLocateInterval: event.target.value }))} />
                    <small className="field-hint">Recommended: 30-300s.</small>
                  </div>
                </div>
                <div className="advanced-form-row">
                  <label className="label-with-default-hint">Continuous Tracking Duration (seconds)<SettingDefaultHint field="continuousLocateDuration" /></label>
                  <div>
                    <input type="number" min="30" step="1" value={configForm.continuousLocateDuration} onChange={(event) => setConfigForm((prev) => ({ ...prev, continuousLocateDuration: event.target.value }))} />
                    <small className="field-hint">Recommended: 60-3600s.</small>
                  </div>
                </div>
                <div className="advanced-form-row" id="setting-timezone" tabIndex={-1}>
                  <label className="label-with-default-hint">Timezone (UTC offset)<SettingDefaultHint field="timeZone" /></label>
                  <div>
                    <input placeholder="e.g. +0 or +8" value={configForm.timeZone} onChange={(event) => setConfigForm((prev) => ({ ...prev, timeZone: event.target.value }))} />
                    <small className="field-hint">Use device-supported offset format.</small>
                  </div>
                </div>
                <div className="advanced-form-row">
                  <label className="label-with-default-hint">Timezone (UTC offset)<SettingDefaultHint field="checkStatus" /></label>
                  <label className="switch-row"><input type="checkbox" checked={configForm.checkStatus} onChange={() => toggle('checkStatus')} /><span>{configForm.checkStatus ? 'On' : 'Off'}</span></label>
                </div>
              </div>
            </article>
            ) : null}

            {advancedSettingsTab === 'alarm' ? (
            <article className="settings-group advanced-settings-group" id="setting-sos" tabIndex={-1}>
              <h3 className="block-title">Alarm Controls</h3>
              <div className="alarm-card">
                <h4>SOS Action</h4>
                <div className="advanced-form-row">
                  <label className="label-with-default-hint">Mode<SettingDefaultHint field="sosMode" /></label>
                  <select value={configForm.sosMode} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosMode: event.target.value }))}><option value="1">Long Press</option><option value="2">Double Click</option></select>
                </div>
                <div className="advanced-form-row">
                  <label className="label-with-default-hint">Action Time<SettingDefaultHint field="sosActionTime" /></label>
                  <div className="range-with-value">
                    <input type="range" min="5" max="60" value={configForm.sosActionTime} style={getRangeProgressStyle(configForm.sosActionTime, 5, 60)} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosActionTime: event.target.value }))} />
                    <span className="range-value">{configForm.sosActionTime}</span>
                  </div>
                </div>
              </div>
              <div className="alarm-card" id="setting-fall" tabIndex={-1}>
                <h4>Fall Detection</h4>
                <div className="advanced-form-row">
                  <label className="label-with-default-hint">Enable<SettingDefaultHint field="fallDownEnabled" /></label>
                  <label className="switch-row"><input type="checkbox" checked={configForm.fallDownEnabled === '1'} onChange={() => setConfigForm((prev) => ({ ...prev, fallDownEnabled: prev.fallDownEnabled === '1' ? '0' : '1' }))} /><span>{configForm.fallDownEnabled === '1' ? 'On' : 'Off'}</span></label>
                </div>
                <div className="advanced-form-row">
                  <label className="label-with-default-hint">Sensitivity<SettingDefaultHint field="fallDownSensitivity" /></label>
                  <div className="range-with-value">
                    <input type="range" min="1" max="9" value={configForm.fallDownSensitivity} style={getRangeProgressStyle(configForm.fallDownSensitivity, 1, 9)} onChange={(event) => setConfigForm((prev) => ({ ...prev, fallDownSensitivity: event.target.value }))} />
                    <span className="range-value">{configForm.fallDownSensitivity}</span>
                  </div>
                </div>
              </div>
              <div className="alarm-card" id="setting-motion" tabIndex={-1}>
                <h4>Motion / No Motion</h4>
                <div className="advanced-form-row">
                  <label className="label-with-default-hint">Alarm Type<SettingDefaultHint field="motionAlarmType" /></label>
                  <select
                    value={configForm.motionAlarmType || 'motion'}
                    onChange={(event) => setConfigForm((prev) => ({ ...prev, motionAlarmType: event.target.value }))}
                  >
                    <option value="motion">Motion Alarm (mo)</option>
                    <option value="no-motion">No Motion Alarm (nm0)</option>
                  </select>
                </div>
                <div className="advanced-form-row">
                  <label className="label-with-default-hint">Enable<SettingDefaultHint field="motionEnabled" /></label>
                  <label className="switch-row">
                    <input type="checkbox" checked={configForm.motionEnabled === '1'} onChange={() => setConfigForm((prev) => ({ ...prev, motionEnabled: prev.motionEnabled === '1' ? '0' : '1' }))} />
                    <span>{configForm.motionEnabled === '1' ? 'On' : 'Off'}</span>
                  </label>
                </div>
                <div className="advanced-form-row">
                  <label className="label-with-default-hint">Static Time<SettingDefaultHint field="motionStaticTime" /></label>
                  <input type="number" min="1" step="1" value={configForm.motionStaticTime} onChange={(event) => setConfigForm((prev) => ({ ...prev, motionStaticTime: event.target.value }))} />
                </div>
                <div className="advanced-form-row">
                  <label className="label-with-default-hint">Duration<SettingDefaultHint field="motionDurationTime" /></label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={configForm.motionDurationTime}
                    onChange={(event) => setConfigForm((prev) => ({ ...prev, motionDurationTime: event.target.value }))}
                    disabled={(configForm.motionAlarmType || 'motion') === 'no-motion'}
                  />
                </div>
              </div>
            </article>
            ) : null}

            {advancedSettingsTab === 'geofence' ? (
            <article className="settings-group advanced-settings-group" id="setting-geofence" tabIndex={-1}>
              <h3 className="block-title">Geo-fencing</h3>
              <p className="status advanced-geofence-tip"><span className="advanced-callout-icon" aria-hidden="true" />Command format: <code>Geo#,n,on/off,distance</code> where # is 1-4. Radius range: 100-65535 meters.</p>
              <div className="advanced-form-grid">
                <div className="advanced-form-row">
                  <label className="label-with-default-hint">Geo-fence Slots<SettingDefaultHint field="geoFenceCount" /></label>
                  <div className="inline-actions">
                    <button type="button" className="mini-action" onClick={addGeoFenceConfig} disabled={geoFenceConfigs.length >= 4}>+ Add Geo-fence</button>
                    <span className="field-hint">{geoFenceConfigs.length}/4 configured</span>
                  </div>
                </div>
                {geoFenceConfigs.length > 1 ? (
                <div className="advanced-form-row">
                  <label>Editing Geo-fence #</label>
                  <select value={String(activeGeoFenceConfig.slot)} onChange={(event) => setSelectedGeoFenceSlot(Number(event.target.value))}>
                    {geoFenceConfigs.map((entry) => <option key={`geo-fence-slot-${entry.slot}`} value={entry.slot}>Geo{entry.slot}</option>)}
                  </select>
                </div>
                ) : null}
                <div className="advanced-form-row">
                  <label className="label-with-default-hint">Enable<SettingDefaultHint field="geoFenceEnabled" /></label>
                  <label className="switch-row">
                    <input type="checkbox" checked={activeGeoFenceConfig.enabled === '1'} onChange={() => updateActiveGeoFenceConfig({ enabled: activeGeoFenceConfig.enabled === '1' ? '0' : '1' })} />
                    <span>{activeGeoFenceConfig.enabled === '1' ? 'On' : 'Off'}</span>
                  </label>
                </div>
                <div className="advanced-form-row">
                  <label className="label-with-default-hint">Radius (meters)<SettingDefaultHint field="geoFenceRadius" /></label>
                  <div className="range-with-value">
                    <input
                      type="range"
                      min="100"
                      max="65535"
                      step="10"
                      value={parseGeoFenceRadiusToMeters(activeGeoFenceConfig.radius)}
                      style={getRangeProgressStyle(parseGeoFenceRadiusToMeters(activeGeoFenceConfig.radius), 100, 65535)}
                      onChange={(event) => updateActiveGeoFenceConfig({ radius: `${event.target.value}m` })}
                    />
                    <span className="range-value">{parseGeoFenceRadiusToMeters(activeGeoFenceConfig.radius)}</span>
                  </div>
                </div>
                <div className="advanced-form-row">
                  <label className="label-with-default-hint">Trigger Mode<SettingDefaultHint field="geoFenceMode" /></label>
                  <select value={activeGeoFenceConfig.mode || '0'} onChange={(event) => updateActiveGeoFenceConfig({ mode: event.target.value })}>
                    <option value="0">Leave Area (0)</option>
                    <option value="1">Enter Area (1)</option>
                  </select>
                </div>
                <div className="advanced-form-row">
                  <label>Radius Manual Override</label>
                  <div>
                    <input
                      value={activeGeoFenceConfig.radius}
                      onChange={(event) => updateActiveGeoFenceConfig({ radius: event.target.value })}
                      placeholder="100m"
                    />
                    {!isGeoFenceRadiusRawValid ? <small className="status-error">Use numbers with optional unit, e.g. 500m or 1km.</small> : <small className="field-hint">Supported units: m or km.</small>}
                  </div>
                </div>
              </div>
              <div className="map-placeholder map-square geofence-leaflet-wrap">
                {leafletReady && geofenceCenterLocation
                  ? <div ref={geofenceLeafletRef} className="leaflet-map geofence-leaflet-map" />
                  : <span className="map-chip">{leafletReady ? 'Waiting for current device coordinates…' : 'Loading geo-fence map…'}</span>}
              </div>
              <p className="status">
                {geofenceCenterLocation
                  ? `Geo-fence center uses the device coordinates from database (${geofenceCenterLocation.latitude}, ${geofenceCenterLocation.longitude}).`
                  : 'No device coordinates in database yet. Update device location first to set geo-fence center.'}
              </p>
            </article>
            ) : null}
            <div className="basic-config-footer-actions">
              <button className="mini-action device-detail-btn-primary" type="button" onClick={openConfigReview} disabled={!configForm.deviceId || !configChangeRows.length}>Apply Changes</button>
            </div>
          </section>
        )}

        {(activeSection === 'location' || activeSection === 'device-detail-location') && (
          <section className="section-panel">
            {!isDeviceDetailLocationSection ? <h2 className="page-title">Live Location</h2> : null}
            <article className="card-like map-panel location-viewer-card">
              <div className="section-head location-viewer-toolbar">
                <div>
                  <p className="status location-note">Live map view for the active device. SMS data falls back to latest webhook coordinates when needed.</p>
                </div>
                <button className="mini-action request-btn-inline device-detail-btn-primary" disabled={loading} onClick={requestLocationUpdate}>Request Location (Loc)</button>
              </div>
              {isDeviceDetailLocationSection ? (
                <p className="location-context-label">
                  Location for{' '}
                  <strong>
                    {locationViewerDevice
                      ? `${locationViewerDevice.name || locationViewerDevice.deviceName || `Device ${locationViewerDevice.id || locationViewerDevice.deviceId || ''}`}`
                      : 'selected device'}
                  </strong>
                </p>
              ) : (
                <div className="field-grid location-device-picker">
                  <div>
                    <label htmlFor="location-device-select">Device</label>
                    <select
                      id="location-device-select"
                      value={locationDeviceId}
                      onChange={(event) => setLocationDeviceId(event.target.value)}
                    >
                      {locationDeviceOptions.map((device) => (
                        <option key={device.id || device.deviceId || device.phoneNumber} value={String(device.id || device.deviceId || '')}>
                          {device.name || device.deviceName || `Device ${device.id || device.deviceId}`} ({device.phoneNumber || 'No phone'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {displayedLocation ? (
                <>
                  <div className={`location-viewer-layout ${isDeviceDetailLocationSection ? 'is-device-workspace' : ''}`}>
                    <div className="map-placeholder map-square location-leaflet-wrap" id="setting-live-location-map" tabIndex={-1}>
                      {leafletReady
                        ? <div ref={locationLeafletRef} className="leaflet-map location-leaflet-map" />
                        : <span className="map-chip">Loading map…</span>}
                    </div>
                    <aside className="location-meta-panel">
                      <h4>Location details</h4>
                      <div className="location-coordinates">
                        <span className="location-coordinate-pill">
                          <strong>Latitude</strong>
                          <span>{Number(displayedLocation.latitude).toFixed(6)}</span>
                        </span>
                        <span className="location-coordinate-pill">
                          <strong>Longitude</strong>
                          <span>{Number(displayedLocation.longitude).toFixed(6)}</span>
                        </span>
                      </div>
                      <a className="table-link action-chip action-chip-neutral" href={displayedLocation.mapUrl} target="_blank" rel="noreferrer">Open in Google Maps</a>
                      {usingWebhookFallback ? <span className="status location-source-chip">Source: Webhook fallback</span> : <span className="status location-source-chip">Source: SMS reply</span>}
                      <span className="status location-source-chip">Breadcrumbs: {filteredBreadcrumbPoints.length} / {breadcrumbPoints.length}</span>
                      {breadcrumbDateBounds.earliest && breadcrumbDateBounds.latest ? (
                        <div className="breadcrumb-filter-grid">
                          <label htmlFor="breadcrumb-date-from">
                            From date
                            <input
                              id="breadcrumb-date-from"
                              type="datetime-local"
                              value={breadcrumbDateFrom}
                              max={breadcrumbDateTo || undefined}
                              onChange={(event) => setBreadcrumbDateFrom(event.target.value)}
                            />
                          </label>
                          <label htmlFor="breadcrumb-date-to">
                            Latest date
                            <input
                              id="breadcrumb-date-to"
                              type="datetime-local"
                              value={breadcrumbDateTo}
                              min={breadcrumbDateFrom || undefined}
                              onChange={(event) => setBreadcrumbDateTo(event.target.value)}
                            />
                          </label>
                          {(breadcrumbDateFrom || breadcrumbDateTo) ? (
                            <button type="button" className="mini-action" onClick={() => {
                              setBreadcrumbDateFrom('')
                              setBreadcrumbDateTo('')
                            }}
                            >
                              Clear range
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {selectedDeviceWebhookLocation?.updatedAt ? (
                        <span className="status">Last device update: {new Date(selectedDeviceWebhookLocation.updatedAt).toLocaleString()}</span>
                      ) : null}
                      <span className="status">{filteredBreadcrumbStatus}</span>
                    </aside>
                  </div>
                  {filteredBreadcrumbPoints.length ? (
                    <div className="table-wrap breadcrumb-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Captured</th>
                            <th>Latitude</th>
                            <th>Longitude</th>
                            <th>Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...filteredBreadcrumbPoints].reverse().slice(0, 20).map((crumb) => (
                            <tr key={crumb.id || `${crumb.latitude}-${crumb.longitude}-${crumb.capturedAt || ''}`}>
                              <td>{crumb.capturedAt ? new Date(crumb.capturedAt).toLocaleString() : '-'}</td>
                              <td>{Number(crumb.latitude).toFixed(6)}</td>
                              <td>{Number(crumb.longitude).toFixed(6)}</td>
                              <td><span className="crumb-source-pill">{String(crumb.source || '-').replace(/_/g, ' ')}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {locationResult?.rawMessage ? <pre className="preview-box">{locationResult.rawMessage}</pre> : null}
                </>
              ) : (
                <div className="map-placeholder map-square"><span className="map-chip">No SMS reply or webhook location yet for this device.</span></div>
              )}
              <p className="status">{status}</p>
            </article>
          </section>
        )}

        {activeSection === 'alarm-logs' && (
          <section className="section-panel">
            <h2 className="page-title">Alarm Logs</h2>
            <article className="card-like">
              <div className="field-grid location-device-picker location-device-picker-inline">
                <div>
                  <label htmlFor="alarm-log-location-filter">Location filter</label>
                  <select
                    id="alarm-log-location-filter"
                    value={alarmLogLocationFilter}
                    onChange={(event) => setAlarmLogLocationFilter(event.target.value)}
                  >
                    <option value="all">All locations</option>
                    {alarmLogLocationOptions.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name || `Location ${location.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="alarm-log-device-filter">Device filter</label>
                  <select
                    id="alarm-log-device-filter"
                    value={alarmLogDeviceFilter}
                    onChange={(event) => setAlarmLogDeviceFilter(event.target.value)}
                  >
                    <option value="all">All devices</option>
                    {locationDeviceOptions.map((device) => (
                      <option key={device.id || device.deviceId || device.phoneNumber} value={String(device.id || device.deviceId || '')}>
                        {device.name || device.deviceName || `Device ${device.id || device.deviceId}`} ({device.phoneNumber || 'No phone'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="alarm-log-type-filter">Log type</label>
                  <select
                    id="alarm-log-type-filter"
                    value={alarmLogTypeFilter}
                    onChange={(event) => setAlarmLogTypeFilter(event.target.value)}
                  >
                    <option value="all">All logs</option>
                    <option value="alerts">Alert logs only</option>
                    <option value="connection">Connection logs only</option>
                  </select>
                </div>
                {alarmLogTypeFilter !== 'connection' && (
                  <div>
                    <label htmlFor="alarm-log-alert-filter">Alarm type</label>
                    <select
                      id="alarm-log-alert-filter"
                      value={alarmLogAlertFilter}
                      onChange={(event) => setAlarmLogAlertFilter(event.target.value)}
                    >
                      <option value="all">All alarm types</option>
                      <option value="no-code">No alarm code</option>
                      {alarmLogCodeOptions.map((alarmCode) => (
                        <option key={`alarm-log-code-${alarmCode}`} value={`code:${alarmCode}`}>
                          {alarmCode}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor="alarm-log-action-filter">Action</label>
                  <select
                    id="alarm-log-action-filter"
                    value={alarmLogActionFilter}
                    onChange={(event) => setAlarmLogActionFilter(event.target.value)}
                  >
                    <option value="all">All actions</option>
                    {alertLogActionOptions.map((action) => (
                      <option key={`alarm-log-action-${action}`} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="alarm-log-source-filter">Source</label>
                  <select
                    id="alarm-log-source-filter"
                    value={alarmLogSourceFilter}
                    onChange={(event) => setAlarmLogSourceFilter(event.target.value)}
                  >
                    <option value="all">All sources</option>
                    {alertLogSourceOptions.map((source) => (
                      <option key={`alarm-log-source-${source}`} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                </div>
                {alarmLogTypeFilter !== 'alerts' && (
                  <div>
                    <label htmlFor="alarm-log-connection-filter">Connection logs</label>
                    <select
                      id="alarm-log-connection-filter"
                      value={alarmLogConnectionFilter}
                      onChange={(event) => setAlarmLogConnectionFilter(event.target.value)}
                    >
                      <option value="all">All connection logs</option>
                      <option value="webhook-connected">Webhook connected</option>
                      <option value="webhook-disconnected">Webhook disconnected</option>
                      <option value="connected">Any connected / online</option>
                      <option value="disconnected">Any disconnected / offline</option>
                    </select>
                  </div>
                )}
              </div>
              <p className="status">{alarmLogsStatus}</p>
              {alarmLogTypeFilter !== 'connection' && (
                <>
                  <h3>Alarm Event Logs</h3>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Event At</th>
                          <th>Action</th>
                          <th>Alarm Code</th>
                          <th>Device</th>
                          <th>Location</th>
                          <th>Source</th>
                          <th>Latitude</th>
                          <th>Longitude</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleAlarmLogs.length ? visibleAlarmLogs.map((entry) => (
                          <tr key={entry.id || `${entry.eventAt || ''}-${entry.action || ''}`}>
                            <td>{entry.eventAt ? new Date(entry.eventAt).toLocaleString() : '-'}</td>
                            <td>{entry.action || '-'}</td>
                            <td>{entry.alarmCode || '-'}</td>
                            <td>{entry.deviceName || entry.deviceId || '-'}</td>
                            <td>{entry.locationName || entry.locationId || '-'}</td>
                            <td>{entry.source || '-'}</td>
                            <td>{entry.latitude ?? '-'}</td>
                            <td>{entry.longitude ?? '-'}</td>
                            <td>{entry.note || '-'}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={9}>No alarm logs to show for this filter.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {alarmLogTypeFilter !== 'alerts' && (
                <>
                  <h3>Device Connection Logs</h3>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Event At</th>
                          <th>Action</th>
                          <th>Device</th>
                          <th>Location</th>
                          <th>Source</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleConnectivityLogs.length ? visibleConnectivityLogs.map((entry) => (
                          <tr key={`connectivity-${entry.id || `${entry.eventAt || ''}-${entry.action || ''}-${entry.deviceId || ''}`}`}>
                            <td>{entry.eventAt ? new Date(entry.eventAt).toLocaleString() : '-'}</td>
                            <td>{entry.action || '-'}</td>
                            <td>{entry.deviceName || entry.deviceId || '-'}</td>
                            <td>{entry.locationName || entry.locationId || '-'}</td>
                            <td>{entry.source || '-'}</td>
                            <td>{entry.note || '-'}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={6}>No connection logs to show for this filter.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </article>
          </section>
        )}

        {activeSection === 'auth-logs' && (
          <section className="section-panel">
            <h2 className="page-title">Login / Logout Audit Trail</h2>
            <article className="card-like">
              <div className="section-head">
                <button className="mini-action" type="button" onClick={loadAuthLogs}>Refresh</button>
              </div>
              <p className="status">{authLogsStatus}</p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Created At</th>
                      <th>Event</th>
                      <th>User ID</th>
                      <th>Identifier</th>
                      <th>Device ID</th>
                      <th>OS</th>
                      <th>API Version</th>
                      <th>IP Address</th>
                      <th>User Agent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {authLogs.length ? authLogs.map((entry) => (
                      <tr key={entry.id || `${entry.createdAt || ''}-${entry.eventType || ''}-${entry.userId || ''}`}>
                        <td>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '-'}</td>
                        <td>{entry.eventType || '-'}</td>
                        <td>{entry.userId ?? '-'}</td>
                        <td>{entry.loginIdentifier || '-'}</td>
                        <td>{entry.deviceId || '-'}</td>
                        <td>{entry.osType || '-'}</td>
                        <td>{entry.apiVersion || '-'}</td>
                        <td>{entry.ipAddress || '-'}</td>
                        <td>{entry.userAgent || '-'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={9}>No login/logout audit entries found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {activeSection === 'error-logs' && (
          <section className="section-panel error-logs-panel">
            <h2 className="page-title">Error Logs</h2>
            <article className="card-like error-logs-card">
              <div className="section-head error-log-head">
                <div className="table-controls error-log-filters">
                  <label className="webhook-limit-control" htmlFor="error-log-range">
                    <span>Range</span>
                    <select id="error-log-range" value={errorLogRange} onChange={(event) => setErrorLogRange(event.target.value)}>
                      {errorRangeOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  {isSuperAdmin ? (
                    <label className="webhook-limit-control" htmlFor="error-log-company-filter">
                      <span>Company</span>
                      <select id="error-log-company-filter" value={errorLogCompanyFilter} onChange={(event) => setErrorLogCompanyFilter(event.target.value)}>
                        <option value="all">All companies</option>
                        {errorLogFilterOptions.companies.map((entry) => (
                          <option key={`error-company-${entry.id}`} value={entry.id}>{entry.label}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {(isSuperAdmin || isCompanyAdmin) ? (
                    <label className="webhook-limit-control" htmlFor="error-log-location-filter">
                      <span>Location</span>
                      <select id="error-log-location-filter" value={errorLogLocationFilter} onChange={(event) => setErrorLogLocationFilter(event.target.value)}>
                        <option value="all">All locations</option>
                        {errorLogFilterOptions.locations.map((entry) => (
                          <option key={`error-location-${entry.id}`} value={entry.id}>{entry.label}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="webhook-limit-control" htmlFor="error-log-user-filter">
                    <span>User</span>
                    <select id="error-log-user-filter" value={errorLogUserFilter} onChange={(event) => setErrorLogUserFilter(event.target.value)}>
                      <option value="all">{isSuperAdmin || isCompanyAdmin ? 'All users' : 'My logs'}</option>
                      {errorLogFilterOptions.users.map((entry) => (
                        <option key={`error-user-${entry.id}`} value={entry.id}>{entry.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <button className="mini-action" type="button" onClick={loadErrorLogs}>Refresh</button>
              </div>
              <p className="status">{errorLogsStatus}</p>
              <p className="status error-log-count">Showing {filteredErrorLogs.length} error entr{filteredErrorLogs.length === 1 ? 'y' : 'ies'} in the selected range.</p>
              <div className="table-wrap error-log-table-wrap">
                <table className="data-table error-log-table">
                  <thead>
                    <tr>
                      <th>Occurred At</th>
                      <th>Route</th>
                      <th>Status</th>
                      <th>Type</th>
                      <th>Message</th>
                      <th>Stack Trace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredErrorLogs.length ? filteredErrorLogs.map((entry) => (
                      <tr key={entry.id || `${entry.occurredAt || ''}-${entry.path || ''}-${entry.errorType || ''}`}>
                        <td>{entry.occurredAt ? new Date(entry.occurredAt).toLocaleString() : '-'}</td>
                        <td>{`${entry.method || '-'} ${entry.path || '-'}`}</td>
                        <td><span className="error-log-status-badge">{entry.statusCode ?? '-'}</span></td>
                        <td>{entry.errorType || '-'}</td>
                        <td>{entry.errorMessage || '-'}</td>
                        <td>
                          <details>
                            <summary>View</summary>
                            <pre className="preview-box">{entry.stackTrace || '-'}</pre>
                          </details>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6}>No backend errors found for this filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {(activeSection === 'commands' || activeSection === 'device-detail-commands') && (
          <section className="commands-section">
            <h2 className="page-title">Send Commands</h2>
            <div className="commands-layout">
              <article className="card-like commands-card commands-input-card" id="setting-command-input" tabIndex={-1}>
                <h3 className="commands-card-title">Command Input</h3>
                <p className="status commands-info-banner">Review values below before sending. Commands use the selected device in this workspace.</p>
                <div className="field-grid commands-field-grid">
                  <div>
                    <label>Contact Number</label>
                    <input title="Phone number used for command payloads." value={configForm.contactNumber} onChange={(event) => setConfigForm((prev) => ({ ...prev, contactNumber: event.target.value }))} />
                  </div>
                  <div>
                    <label>SOS Action</label>
                    <input title="Sets SOS action time in seconds for generated commands." value={configForm.sosActionTime} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosActionTime: event.target.value }))} />
                  </div>
                  <div>
                    <label>Geo-fence</label>
                    <input title="Geo-fence radius command value (e.g. 500m)." value={activeGeoFenceConfig.radius} onChange={(event) => updateActiveGeoFenceConfig({ radius: event.target.value })} />
                  </div>
                  {geoFenceConfigs.length > 1 ? (
                    <div>
                      <label>Editing Geo-fence #</label>
                      <select title="Choose which Geo# command to edit." value={String(activeGeoFenceConfig.slot)} onChange={(event) => setSelectedGeoFenceSlot(Number(event.target.value))}>
                        {geoFenceConfigs.map((entry) => <option key={`commands-geo-slot-${entry.slot}`} value={entry.slot}>Geo{entry.slot}</option>)}
                      </select>
                    </div>
                  ) : null}
                </div>
                <button className="mini-action commands-btn commands-btn-primary commands-btn-send" title="Send the currently prepared command set to the selected device." disabled={loading} onClick={sendConfig}>Send Command</button>
              </article>
              <article className="card-like queue-card commands-card" id="setting-command-queue" tabIndex={-1}>
                <h3>Command Queue</h3>
                <div className="queue-grid">
                  <p><strong>Status:</strong> <span className={`queue-chip queue-${queueStatusLabel.toLowerCase()}`}>{queueStatusLabel}</span></p>
                  <p><strong>Last Sent:</strong> {configQueue?.lastSentAt ? new Date(configQueue.lastSentAt).toLocaleString() : '-'}</p>
                  <p><strong>Applied:</strong> {configQueue?.appliedAt ? new Date(configQueue.appliedAt).toLocaleString() : 'Not confirmed yet'}</p>
                  <p><strong>Next Resend:</strong> {configQueue?.nextResendAt ? new Date(configQueue.nextResendAt).toLocaleString() : '-'}</p>
                  <p><strong>Cooldown:</strong> {resendRemainingText}</p>
                </div>
                <div className="queue-actions">
                  <button className="mini-action commands-btn commands-btn-secondary" title="Fetch the latest queue status from the backend." disabled={loading || !configForm.deviceId} onClick={() => refreshConfigQueueStatus(configForm.deviceId)}>Refresh</button>
                  <button
                    className="mini-action commands-btn commands-btn-primary"
                    title="Retry the pending SMS command if cooldown allows."
                    disabled={loading || !isQueuePending || resendCooldownActive}
                    onClick={resendPendingConfig}
                  >
                    {resendCooldownActive ? `Resend in ${resendRemainingText}` : 'Resend'}
                  </button>
                </div>
                <div className="queue-previews-grid">
                  <section className="queue-preview-panel">
                    <div className="queue-preview-head">
                      <h4>Queued Command</h4>
                      <span className={`queue-mini-chip ${hasQueuedCommand ? 'queue-mini-ready' : 'queue-mini-empty'}`}>
                        {hasQueuedCommand ? 'In Queue' : 'Empty'}
                      </span>
                    </div>
                    <pre className="preview-box queue-preview">{queuedCommandPreview || 'No command queued yet.'}</pre>
                  </section>

                  <section className="queue-preview-panel">
                    <div className="queue-preview-head">
                      <h4>Active Draft (Updates Only)</h4>
                      <span className={`queue-mini-chip ${hasCommandChanges ? 'queue-mini-changed' : 'queue-mini-empty'}`}>
                        {hasCommandChanges ? 'Pending Updates' : 'No Updates'}
                      </span>
                    </div>
                    <pre className="preview-box queue-preview">{activeCommandPreview || 'No draft updates. Only changed values are shown here.'}</pre>
                  </section>
                </div>
              </article>
            </div>
            <article className="card-like gateway-panel"><h3>SMS Gateway + Test Message</h3><div className="field-grid two-col"><div><label>Gateway Base URL</label><input placeholder="https://gateway-url" value={gatewayBaseUrl} onChange={(event) => setGatewayBaseUrl(event.target.value)} /></div><div><label>Gateway Token</label><input placeholder="Authorization token" value={gatewayToken} onChange={(event) => setGatewayToken(event.target.value)} /></div><div><label>Test Phone Number</label><input value={phone} onChange={(event) => setPhone(event.target.value)} /></div><div><label>Custom Message</label><input value={message} onChange={(event) => setMessage(event.target.value)} /></div></div><button className="mini-action device-detail-btn-primary" disabled={loading} onClick={sendMessage}>Send Test Message</button><div className="status">{status}</div><div className="status">{configStatus}</div>{configResult ? <pre className="replies conversation-box">{JSON.stringify(configResult, null, 2)}</pre> : null}</article>
          </section>
        )}

        {activeSection === 'replies' && (
          <section className="card-like section-panel">
            <h2 className="section-title">Replies</h2>
            <div className="section-head">
              <button className="mini-action" disabled={loading} onClick={fetchReplies}>Manual Refresh</button>
              <button className="mini-action" type="button" onClick={() => setAutoFetchReplies((prev) => !prev)}>
                {autoFetchReplies ? 'Stop Auto Refresh' : 'Start Auto Refresh (5s)'}
              </button>
            </div>
            <p className="status">{autoFetchReplies ? 'Auto refresh is running every 5 seconds.' : 'Auto refresh is off.'}</p>
            <div className="table-shell replies-shell">
              <table className="data-table replies-table">
                <thead>
                  <tr><th>Received At</th><th>From</th><th>Message</th></tr>
                </thead>
                <tbody>
                  {replyRows.length ? replyRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.receivedAt}</td>
                      <td>{row.from}</td>
                      <td className="reply-message">{row.message}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="reply-empty">No replies loaded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <details className="reply-raw-wrap">
              <summary>Raw Reply Log</summary>
              <pre className="replies conversation-box">{formattedReplies}</pre>
            </details>
          </section>
        )}

        {activeSection === 'webhooks' && (
          <section className="card-like section-panel">
            <div className="section-head">
              <h2 className="section-title">Webhook Events</h2>
              <div className="webhook-actions">
                <label className="webhook-limit-control" htmlFor="webhook-limit-select">
                  <span>Limit</span>
                  <select id="webhook-limit-select" value={webhookLimit} onChange={(event) => setWebhookLimit(event.target.value)}>
                    <option value="3">3</option>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="all">All</option>
                  </select>
                </label>
                <button className="mini-action" type="button" onClick={loadWebhookEvents}>Refresh Events</button>
                <button className="mini-action" type="button" onClick={clearWebhookEvents} disabled={clearingWebhookEvents}>
                  {clearingWebhookEvents ? 'Clearing…' : 'Clear Events'}
                </button>
              </div>
            </div>
            <p className="status">Live listener is active. New events appear automatically. Showing all fetched events.</p>
            <p className="status">{webhookStatus || 'No webhook data loaded yet.'}</p>
            <p className="status webhook-hint">
              Use <code>action</code> + <code>reason</code> in alarm attempts to understand whether backend queued or ignored each update.
            </p>

            <div className="webhook-list">
              {webhookRaw === null ? (
                <pre className="conversation-box webhook-pre">No webhook events found.</pre>
              ) : Array.isArray(webhookRaw) ? (
                webhookRaw.map((event, index) => {
                  const summary = webhookSummary(event, index)
                  const { parts } = summary
                  const alarmAttempts = extractAlarmAttempts(event)
                  return (
                    <article className="webhook-event" key={event?.id || event?._id || `${parts.timestamp || 'event'}-${index}`}>
                      <header className="webhook-head">
                        <h3 className="webhook-title">{summary.title}</h3>
                        <div className="webhook-meta-row">
                          <span className="webhook-chip">ID: {summary.id}</span>
                          <span className="webhook-chip">Source: {summary.source}</span>
                          {summary.phone ? <span className="webhook-chip">Phone: {summary.phone}</span> : null}
                        </div>
                        {parts.timestamp ? <p className="webhook-time">{String(parts.timestamp)}</p> : null}
                      </header>
                      {parts.headers !== null && parts.headers !== undefined ? (
                        <>
                          <h4>Headers</h4>
                          <pre className="conversation-box webhook-pre">{renderRaw(parts.headers)}</pre>
                        </>
                      ) : null}
                      <h4>Payload</h4>
                      <pre className="conversation-box webhook-pre">{renderRaw(parts.payload ?? parts.rawEvent)}</pre>
                      <h4>Alarm Attempts</h4>
                      {alarmAttempts.length ? (
                        <div className="table-shell webhook-attempt-shell">
                          <table className="data-table webhook-attempt-table">
                            <thead>
                              <tr>
                                <th>Candidate #</th>
                                <th>External Device ID</th>
                                <th>Alarm Code</th>
                                <th>Event Timestamp</th>
                                <th>Action</th>
                                <th>Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {alarmAttempts.map((attempt, attemptIndex) => (
                                <tr key={`${summary.id}-attempt-${attemptIndex}`}>
                                  <td>{attempt?.candidateIndex ?? '-'}</td>
                                  <td>{attempt?.externalDeviceId || '-'}</td>
                                  <td>{attempt?.alarmCode || '-'}</td>
                                  <td>{attempt?.eventTimestamp || '-'}</td>
                                  <td>{attempt?.action || '-'}</td>
                                  <td>{attempt?.reason || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="webhook-attempt-empty">No alarm attempts detected in this event.</p>
                      )}
                    </article>
                  )
                })
              ) : (
                <article className="webhook-event">
                  <h4>Payload</h4>
                  <pre className="conversation-box webhook-pre">{renderRaw(webhookRaw)}</pre>
                </article>
              )}
            </div>
          </section>
        )}
      </div>

      {confirmDialog.open ? (
        <div className="overlay" onClick={closeConfirmDialog}>
          <div className="modal confirm-dialog-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Confirm Action</h3>
            <p className="status">{confirmDialog.message}</p>
            <div className="section-head">
              <button className="table-link action-chip action-chip-neutral" type="button" onClick={closeConfirmDialog}>Cancel</button>
              <button className="mini-action" type="button" onClick={confirmDialogAction}>Confirm</button>
            </div>
          </div>
        </div>
      ) : null}

      {showConfigReviewModal ? (
        <div className="overlay" onClick={() => setShowConfigReviewModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Review Device Changes</h3>
            <p className="status">Please confirm what changed before sending SMS.</p>
            <div className="table-shell">
              <table className="data-table">
                <thead><tr><th>Field</th><th>Before</th><th>After</th><th>Section</th></tr></thead>
                <tbody>
                  {configChangeRows.map((entry) => (
                    <tr key={`config-change-${entry.key}`}>
                      <td>{entry.key}</td>
                      <td>{formatConfigValue(entry.before)}</td>
                      <td>{formatConfigValue(entry.after)}</td>
                      <td>
                        <button className="table-link table-link-compact" type="button" onClick={() => jumpToChangedField(entry.key)}>
                          Open {resolveConfigSectionForField(entry.key).replace('device-detail-', '').replace('-', ' ')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="section-head">
              <button className="table-link action-chip action-chip-neutral" type="button" onClick={() => setShowConfigReviewModal(false)}>Cancel</button>
              <button className="mini-action" type="button" onClick={confirmSendConfig} disabled={loading}>Save &amp; Send SMS</button>
            </div>
          </div>
        </div>
      ) : null}

      {showCompanyModal ? (
        <div className="overlay" onClick={() => setShowCompanyModal(false)}>
          <div className="modal form-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Create Company</h3>
            <p>Use the same clean structure as other create forms.</p>
            <div className="field-grid">
              <input placeholder="Company Name" value={companyForm.companyName} onChange={(event) => setCompanyForm((prev) => ({ ...prev, companyName: event.target.value }))} />
              <textarea rows={3} placeholder="Details" value={companyForm.details} onChange={(event) => setCompanyForm((prev) => ({ ...prev, details: event.target.value }))} />
              <input placeholder="Address" value={companyForm.address} onChange={(event) => setCompanyForm((prev) => ({ ...prev, address: event.target.value }))} />
              <input placeholder="City" value={companyForm.city} onChange={(event) => setCompanyForm((prev) => ({ ...prev, city: event.target.value }))} />
              <input placeholder="State" value={companyForm.state} onChange={(event) => setCompanyForm((prev) => ({ ...prev, state: event.target.value }))} />
              <input placeholder="Postal Code" value={companyForm.postalCode} onChange={(event) => setCompanyForm((prev) => ({ ...prev, postalCode: event.target.value }))} />
              <input placeholder="Country" value={companyForm.country} onChange={(event) => setCompanyForm((prev) => ({ ...prev, country: event.target.value }))} />
              <input placeholder="Phone" value={companyForm.phone} onChange={(event) => setCompanyForm((prev) => ({ ...prev, phone: event.target.value }))} />
              <label className="checkbox-field">
                <input type="checkbox" checked={Boolean(companyForm.isAlarmReceiverIncluded)} onChange={(event) => setCompanyForm((prev) => ({ ...prev, isAlarmReceiverIncluded: event.target.checked }))} />
                <span>Include Alarm Receiver</span>
              </label>
            </div>
            <div className="form-actions">
              <button className="btn-pill btn-pill-secondary" type="button" onClick={() => setShowCompanyModal(false)}>Cancel</button>
              <button className="btn-pill btn-pill-primary" type="button" onClick={handleCreateCompany}><AppIcon name="plus" className="btn-icon" />Create Company</button>
            </div>
          </div>
        </div>
      ) : null}

      {showUserModal ? (
        <div className="overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal form-modal create-user-modal" onClick={(event) => event.stopPropagation()}>
            <div className="create-user-modal-head">
              <div className="create-user-modal-icon"><AppIcon name="plusUser" className="btn-icon" /></div>
              <div>
                <h3>Create User</h3>
              </div>
            </div>
            <div className="field-grid two-col create-user-field-grid">
              <div className="form-control">
                <label>Full name</label>
                <input placeholder="e.g., John Doe" value={`${userForm.firstName || ''} ${userForm.lastName || ''}`.trim()} onChange={(event) => {
                  const trimmed = event.target.value.trim()
                  const [firstName = '', ...rest] = trimmed.split(/\s+/)
                  setUserForm((prev) => ({ ...prev, firstName, lastName: rest.join(' ') }))
                }} />
              </div>
              <div className="form-control">
                <label>Account</label>
                <input placeholder="Lorem Ipsum" value={userForm.address} onChange={(event) => setUserForm((prev) => ({ ...prev, address: event.target.value }))} />
              </div>
              <div className="form-control">
                <label>Email</label>
                <input placeholder="name@email.com" value={userForm.email} onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))} />
              </div>
              <div className="form-control">
                <label>Password</label>
                <input placeholder="Lorem Ipsum" type="password" value={userForm.password} onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))} />
              </div>
              <div className="form-control">
                <label>Phone</label>
                <input placeholder="e.g., 0412 345 678" value={userForm.contactNumber} onChange={(event) => setUserForm((prev) => ({ ...prev, contactNumber: event.target.value }))} />
              </div>
              <div className="form-control">
                <label>Role</label>
                <select value={userForm.userRole} onChange={(event) => setUserForm((prev) => ({ ...prev, userRole: Number(event.target.value) }))}><option value={3}>Portal User</option><option value={4}>Mobile App User</option><option value={2}>Company Admin</option><option value={1}>Super Admin</option></select>
              </div>
              <div className="form-control">
                <label>Company</label>
                <select value={userForm.companyId} onChange={(event) => setUserForm((prev) => ({ ...prev, companyId: event.target.value, locationId: '' }))}>
                  <option value="">Select Company</option>
                  {selectableCompanies.map((company) => <option key={company.id || company.name || company.companyName} value={company.id || ''}>{company.companyName || company.company_name || company.name || 'Unknown company'}</option>)}
                </select>
              </div>
              <div className="form-control user-typeahead">
                <label>Location (Optional)</label>
                <input placeholder="Lorem Ipsum" value={userLocationQuery} onChange={(event) => {
                  const nextValue = event.target.value
                  setUserLocationQuery(nextValue)
                  const exactMatch = locationTypeaheadRows.find((entry) => entry.label.toLowerCase() === nextValue.trim().toLowerCase())
                  setUserForm((prev) => ({ ...prev, locationId: exactMatch?.id || '' }))
                }} />
                {userLocationQuery.trim() && filteredLocationSuggestions.length ? (
                  <div className="typeahead-list">
                    {filteredLocationSuggestions.map((location) => (
                      <button key={`location-suggestion-${location.id}`} type="button" className="typeahead-option" onClick={() => {
                        setUserLocationQuery(location.label)
                        setUserForm((prev) => ({ ...prev, locationId: location.id }))
                      }}>
                        {location.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-pill btn-pill-secondary" type="button" onClick={() => setShowUserModal(false)}>Cancel</button>
              <button className="btn-pill btn-pill-primary" type="button" onClick={handleCreateUser}><AppIcon name="plusUser" className="btn-icon" />Create User</button>
            </div>
          </div>
        </div>
      ) : null}

      {showLocationModal ? (
        <div className="overlay" onClick={() => setShowLocationModal(false)}>
          <div className="modal form-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Create Location</h3>
            <p>Keep inputs consistent with the rest of the dashboard.</p>
            <div className="field-grid">
              <select value={locationForm.companyId} onChange={(event) => setLocationForm((prev) => ({ ...prev, companyId: event.target.value }))}>
                <option value="">Select Company</option>
                {selectableCompanies.map((company) => <option key={company.id || company.name || company.companyName} value={company.id || ''}>{company.companyName || company.company_name || company.name || 'Unknown company'}</option>)}
              </select>
              <input placeholder="Location Name" value={locationForm.name} onChange={(event) => setLocationForm((prev) => ({ ...prev, name: event.target.value }))} />
              <textarea rows={3} placeholder="Details" value={locationForm.details} onChange={(event) => setLocationForm((prev) => ({ ...prev, details: event.target.value }))} />
            </div>
            <div className="form-actions">
              <button className="btn-pill btn-pill-secondary" type="button" onClick={() => setShowLocationModal(false)}>Cancel</button>
              <button className="btn-pill btn-pill-primary" type="button" onClick={handleCreateLocation}><AppIcon name="plus" className="btn-icon" />Create Location</button>
            </div>
          </div>
        </div>
      ) : null}

      {showEditCompanyModal ? (
        <div className="overlay" onClick={() => { setShowEditCompanyModal(false); setEditingCompanyId(null); setCompanyForm(initialCompanyForm) }}>
          <div className="modal form-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Company Configuration</h3>
            <p>Update company details with the same modal layout pattern.</p>
            <div className="field-grid">
              <input placeholder="Company Name" value={companyForm.companyName} onChange={(event) => setCompanyForm((prev) => ({ ...prev, companyName: event.target.value }))} />
              <textarea rows={3} placeholder="Details" value={companyForm.details} onChange={(event) => setCompanyForm((prev) => ({ ...prev, details: event.target.value }))} />
              <input placeholder="Address" value={companyForm.address} onChange={(event) => setCompanyForm((prev) => ({ ...prev, address: event.target.value }))} />
              <input placeholder="City" value={companyForm.city} onChange={(event) => setCompanyForm((prev) => ({ ...prev, city: event.target.value }))} />
              <input placeholder="State" value={companyForm.state} onChange={(event) => setCompanyForm((prev) => ({ ...prev, state: event.target.value }))} />
              <input placeholder="Postal Code" value={companyForm.postalCode} onChange={(event) => setCompanyForm((prev) => ({ ...prev, postalCode: event.target.value }))} />
              <input placeholder="Country" value={companyForm.country} onChange={(event) => setCompanyForm((prev) => ({ ...prev, country: event.target.value }))} />
              <input placeholder="Phone" value={companyForm.phone} onChange={(event) => setCompanyForm((prev) => ({ ...prev, phone: event.target.value }))} />
              <label className="checkbox-field">
                <input type="checkbox" checked={Boolean(companyForm.isAlarmReceiverIncluded)} onChange={(event) => setCompanyForm((prev) => ({ ...prev, isAlarmReceiverIncluded: event.target.checked }))} />
                <span>Include Alarm Receiver</span>
              </label>
              <label className="checkbox-field">
                <input type="checkbox" checked={Boolean(companyForm.alarmReceiverEnabled)} onChange={(event) => setCompanyForm((prev) => ({ ...prev, alarmReceiverEnabled: event.target.checked }))} />
                <span>Alarm Receiver Enabled</span>
              </label>
              <textarea rows={3} placeholder="DNS whitelist (comma or newline separated)" value={companyForm.dnsWhitelistText} onChange={(event) => setCompanyForm((prev) => ({ ...prev, dnsWhitelistText: event.target.value }))} />
              <textarea rows={3} placeholder="IP whitelist (comma or newline separated)" value={companyForm.ipWhitelistText} onChange={(event) => setCompanyForm((prev) => ({ ...prev, ipWhitelistText: event.target.value }))} />
              <textarea rows={6} placeholder="Alarm Receiver Config JSON" value={companyForm.alarmReceiverConfigJson} onChange={(event) => setCompanyForm((prev) => ({ ...prev, alarmReceiverConfigJson: event.target.value }))} />
            </div>
            <div className="form-actions">
              <button className="btn-pill btn-pill-secondary" type="button" onClick={() => { setShowEditCompanyModal(false); setEditingCompanyId(null); setCompanyForm(initialCompanyForm) }}>Cancel</button>
              <button className="btn-pill btn-pill-primary" type="button" onClick={handleUpdateCompany}><AppIcon name="settings" className="btn-icon" />Save Company</button>
            </div>
          </div>
        </div>
      ) : null}



      {showEditUserModal ? (
        <div className="overlay" onClick={() => { setShowEditUserModal(false); setEditingUserId(null); setUserForm(initialUserForm) }}>
          <div className="modal form-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Edit User</h3>
            <p>Use matching spacing and controls for user updates.</p>
            <div className="field-grid two-col">
              <input placeholder="First Name" value={userForm.firstName} onChange={(event) => setUserForm((prev) => ({ ...prev, firstName: event.target.value }))} />
              <input placeholder="Last Name" value={userForm.lastName} onChange={(event) => setUserForm((prev) => ({ ...prev, lastName: event.target.value }))} />
              <input placeholder="Email" value={userForm.email} onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))} />
              <input placeholder="Contact Number" value={userForm.contactNumber} onChange={(event) => setUserForm((prev) => ({ ...prev, contactNumber: event.target.value }))} />
              <input placeholder="Address" value={userForm.address} onChange={(event) => setUserForm((prev) => ({ ...prev, address: event.target.value }))} />
              <select value={userForm.userRole} onChange={(event) => setUserForm((prev) => ({ ...prev, userRole: Number(event.target.value) }))}><option value={3}>Portal User</option><option value={4}>Mobile App User</option><option value={2}>Company Admin</option><option value={1}>Super Admin</option></select>
              <select value={userForm.companyId} onChange={(event) => setUserForm((prev) => ({ ...prev, companyId: event.target.value, locationId: '' }))}><option value="">Company</option>{selectableCompanies.map((company) => <option key={company.id || company.name || company.companyName} value={company.id || ''}>{company.companyName || company.company_name || company.name || 'Unknown company'}</option>)}</select>
              <select value={userForm.locationId} onChange={(event) => setUserForm((prev) => ({ ...prev, locationId: event.target.value }))}><option value="">Location (Optional)</option>{selectableLocations.map((location) => <option key={location.id || location.name} value={location.id || ''}>{location.name || 'Unknown location'}</option>)}</select>
            </div>
            <div className="form-actions">
              <button className="btn-pill btn-pill-secondary" type="button" onClick={() => { setShowEditUserModal(false); setEditingUserId(null); setUserForm(initialUserForm) }}>Cancel</button>
              <button className="btn-pill btn-pill-primary" type="button" onClick={handleUpdateUser}><AppIcon name="settings" className="btn-icon" />Save User</button>
            </div>
          </div>
        </div>
      ) : null}

      {showEditLocationModal ? (
        <div className="overlay" onClick={() => { setShowEditLocationModal(false); setEditingLocationId(null); setLocationForm(initialLocationForm) }}>
          <div className="modal form-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Edit Location</h3>
            <p>Maintain the same polished form style across location forms.</p>
            <div className="field-grid">
              <select value={locationForm.companyId} onChange={(event) => setLocationForm((prev) => ({ ...prev, companyId: event.target.value }))}>
                <option value="">Select Company</option>
                {selectableCompanies.map((company) => <option key={company.id || company.name || company.companyName} value={company.id || ''}>{company.companyName || company.company_name || company.name || 'Unknown company'}</option>)}
              </select>
              <input placeholder="Location Name" value={locationForm.name} onChange={(event) => setLocationForm((prev) => ({ ...prev, name: event.target.value }))} />
              <textarea rows={3} placeholder="Details" value={locationForm.details} onChange={(event) => setLocationForm((prev) => ({ ...prev, details: event.target.value }))} />
            </div>
            <div className="form-actions">
              <button className="btn-pill btn-pill-secondary" type="button" onClick={() => { setShowEditLocationModal(false); setEditingLocationId(null); setLocationForm(initialLocationForm) }}>Cancel</button>
              <button className="btn-pill btn-pill-primary" type="button" onClick={handleUpdateLocation}><AppIcon name="settings" className="btn-icon" />Save Location</button>
            </div>
          </div>
        </div>
      ) : null}

      {showDeviceModal ? (
        <div className="overlay" onClick={() => { setShowDeviceModal(false); setImeiLinkState(initialImeiLinkState) }}>
          <div className="modal form-modal device-create-modal" onClick={(event) => event.stopPropagation()}>
            <div className="device-create-head">
              <h3>Add Device</h3>
            </div>
            <div className="field-grid two-col device-create-grid">
              <label>
                <span>Device Name</span>
                <input placeholder="e.g. EV-12 North Wing" value={deviceForm.name} onChange={(event) => setDeviceForm((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label>
                <span>Phone Number</span>
                <input placeholder="e.g. +1 555 0100" value={deviceForm.phoneNumber} onChange={(event) => setDeviceForm((prev) => ({ ...prev, phoneNumber: event.target.value }))} />
              </label>
              <label>
                <span>Device Version</span>
                <select value={deviceForm.eviewVersion} onChange={(event) => setDeviceForm((prev) => ({ ...prev, eviewVersion: event.target.value }))}>
                  <option value="">Select Device Version</option>
                  {eviewDeviceVersionOptions.map((version) => <option key={version} value={version}>{version}</option>)}
                </select>
              </label>
              <label>
                <span>SIM ICCID</span>
                <input placeholder="898821..." value={deviceForm.simIccid} onChange={(event) => setDeviceForm((prev) => ({ ...prev, simIccid: event.target.value }))} />
              </label>
              <label>
                <span>Owner User</span>
                <select value={deviceForm.ownerUserId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, ownerUserId: event.target.value }))}><option value="">Select User</option>{assignableUsers.map((user) => <option key={user.id || user.email} value={user.id || ''}>{`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}</option>)}</select>
              </label>
              <label>
                <span>Location</span>
                <select value={deviceForm.locationId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, locationId: event.target.value }))}><option value="">Location (Optional)</option>{selectableLocations.map((location) => <option key={location.id || location.name} value={location.id || ''}>{location.name || 'Unknown location'}</option>)}</select>
              </label>
              <label className="device-create-full">
                <span>Webhook Device ID (externalDeviceId)</span>
                <input placeholder="Optional IMEI / Webhook ID" value={deviceForm.externalDeviceId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, externalDeviceId: event.target.value }))} />
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-pill btn-pill-primary" type="button" onClick={handleCreateDevice}><AppIcon name="plus" className="btn-icon" />Add Device</button>
            </div>
            {imeiLinkState.open ? (
              <div className="status imei-wait-card" style={{ marginTop: 12 }}>
                <p>{imeiLinkState.status}</p>
                {!imeiLinkState.externalDeviceId && imeiLinkState.waitStartedAt ? (
                  <div className="imei-progress">
                    <span className="imei-progress-dot" aria-hidden="true" />
                    <strong>Waiting for IMEI link… {imeiElapsedSeconds}s elapsed</strong>
                  </div>
                ) : null}
                <p>Device ID: {imeiLinkState.deviceId || '-'} · Phone: {imeiLinkState.phoneNumber || '-'}</p>
                <p>Webhook Device ID: {imeiLinkState.externalDeviceId || '-'}</p>
                <p className="imei-retry-note">Manual IMEI retry can be sent once every 120 seconds.</p>
                <button
                  className="table-link action-chip action-chip-neutral"
                  type="button"
                  onClick={() => handleImeiResend(imeiLinkState.deviceId)}
                  disabled={!imeiLinkState.deviceId || imeiLinkState.resendPending || imeiRetryCooldownSeconds > 0}
                >
                  {imeiLinkState.resendPending ? 'Retrying…' : (imeiRetryCooldownSeconds > 0 ? `Retry available in ${imeiRetryCooldownSeconds}s` : 'Manual Retry IMEI (V?)')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showEditDeviceModal ? (
        <div className="overlay" onClick={() => { setShowEditDeviceModal(false); setEditingDeviceId(null); setDeviceForm(initialDeviceForm) }}>
          <div className="modal form-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Edit Device</h3>
            <p>Use the same UI language as every create/edit form.</p>
            <div className="field-grid">
              <input placeholder="Device Name" value={deviceForm.name} onChange={(event) => setDeviceForm((prev) => ({ ...prev, name: event.target.value }))} />
              <input placeholder="Phone Number" value={deviceForm.phoneNumber} onChange={(event) => setDeviceForm((prev) => ({ ...prev, phoneNumber: event.target.value }))} />
              <select value={deviceForm.eviewVersion} onChange={(event) => setDeviceForm((prev) => ({ ...prev, eviewVersion: event.target.value }))}>
                <option value="">Select Device Version</option>
                {eviewDeviceVersionOptions.map((version) => <option key={version} value={version}>{version}</option>)}
              </select>
              <input placeholder="Webhook Device ID (externalDeviceId)" value={deviceForm.externalDeviceId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, externalDeviceId: event.target.value }))} />
              <input placeholder="SIM ICCID" value={deviceForm.simIccid} onChange={(event) => setDeviceForm((prev) => ({ ...prev, simIccid: event.target.value }))} />
              <select value={deviceForm.ownerUserId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, ownerUserId: event.target.value }))}><option value="">Select User</option>{assignableUsers.map((user) => <option key={user.id || user.email} value={user.id || ''}>{`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}</option>)}</select>
              <select value={deviceForm.locationId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, locationId: event.target.value }))}><option value="">Location (Optional)</option>{selectableLocations.map((location) => <option key={location.id || location.name} value={location.id || ''}>{location.name || 'Unknown location'}</option>)}</select>
            </div>
            <div className="form-actions">
              <button className="btn-pill btn-pill-secondary" type="button" onClick={() => { setShowEditDeviceModal(false); setEditingDeviceId(null); setDeviceForm(initialDeviceForm) }}>Cancel</button>
              <button className="btn-pill btn-pill-primary" type="button" onClick={handleUpdateDevice}><AppIcon name="settings" className="btn-icon" />Save Device</button>
            </div>
          </div>
        </div>
      ) : null}

      {deviceRegistrationModal.open ? (
        <div className="overlay" onClick={() => setDeviceRegistrationModal(initialDeviceRegistrationModal)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Device Registered</h3>
            <div className="status imei-wait-card" style={{ marginTop: 12 }}>
              <p>{deviceRegistrationModal.status || 'Device created successfully.'}</p>
              {!imeiLinkState.externalDeviceId && imeiLinkState.waitStartedAt ? (
                <div className="imei-progress">
                  <span className="imei-progress-dot" aria-hidden="true" />
                  <strong>Waiting for IMEI completion… {imeiElapsedSeconds}s elapsed</strong>
                </div>
              ) : null}
              <p>Device ID: {deviceRegistrationModal.device?.id || deviceRegistrationModal.device?.deviceId || '-'}</p>
              <p>Name: {deviceRegistrationModal.device?.name || deviceRegistrationModal.device?.deviceName || '-'}</p>
              <p>Phone: {deviceRegistrationModal.device?.phoneNumber || '-'}</p>
              <p>SIM ICCID: {deviceRegistrationModal.device?.simIccid || '-'}</p>
              <p>
                SIM Status: {deviceRegistrationModal.device?.simActivated ? 'Activated' : 'Not activated'}
                {deviceRegistrationModal.device?.simStatus ? ` (${deviceRegistrationModal.device.simStatus})` : ''}
              </p>
              <p>Waiting for IMEI: {deviceRegistrationModal.device?.externalDeviceId ? 'No' : 'Yes'}</p>
              <p>Webhook Device ID / IMEI: {deviceRegistrationModal.device?.externalDeviceId || '-'}</p>
              <p className="imei-retry-note">Manual IMEI retry can be sent once every 120 seconds.</p>
            </div>
            <div className="modal-actions">
              <button
                className="table-link action-chip action-chip-neutral"
                type="button"
                onClick={() => handleImeiResend(deviceRegistrationModal.device?.id || deviceRegistrationModal.device?.deviceId)}
                disabled={!deviceRegistrationModal.device || imeiLinkState.resendPending || imeiRetryCooldownSeconds > 0}
              >
                {imeiLinkState.resendPending ? 'Retrying…' : (imeiRetryCooldownSeconds > 0 ? `Retry available in ${imeiRetryCooldownSeconds}s` : 'Manual Retry IMEI (V?)')}
              </button>
              {!deviceRegistrationModal.device?.simActivated ? (
                <button
                  className="table-link action-chip action-chip-primary"
                  type="button"
                  onClick={async () => {
                    const deviceId = deviceRegistrationModal.device?.id || deviceRegistrationModal.device?.deviceId
                    if (!deviceId) return
                    setDeviceRegistrationModal((prev) => ({ ...prev, activatingSim: true }))
                    try {
                      const response = await activateDeviceSim(deviceId, { refreshDevices: true })
                      setDeviceRegistrationModal((prev) => ({
                        ...prev,
                        activatingSim: false,
                        status: `SIM activated${response?.status ? ` (${response.status})` : ''}.`,
                        device: prev.device
                          ? {
                              ...prev.device,
                              simActivated: true,
                              simStatus: response?.status || 'ACTIVATED',
                              simStatusUpdatedAt: response?.updatedAt || new Date().toISOString()
                            }
                          : prev.device
                      }))
                    } catch (error) {
                      setDeviceRegistrationModal((prev) => ({ ...prev, activatingSim: false, status: `SIM activation failed: ${error.message}` }))
                    }
                  }}
                  disabled={deviceRegistrationModal.activatingSim}
                >
                  {deviceRegistrationModal.activatingSim ? 'Activating SIM…' : 'Activate SIM'}
                </button>
              ) : null}
              <button className="mini-action" type="button" onClick={() => setDeviceRegistrationModal(initialDeviceRegistrationModal)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
