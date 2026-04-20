export interface SmsAccessSetupInput {
  authorizedNumbers?: Array<string | null | undefined>
  restrictedAccess?: boolean
}

export interface AuthorizedNumberConfig {
  slot: number
  number: string
  smsEnabled: 1
  callEnabled: 0
  sms: string
}

export interface SmsAccessSetupOutput {
  config: {
    authorizedNumbers: AuthorizedNumberConfig[]
    restrictedAccess: boolean
    accessModeSms: 'callin(0)' | 'callin(1)'
  }
  smsQueue: string[]
}

const MAX_AUTHORIZED_NUMBERS = 10

export class SmsAccessValidationError extends Error {
  code: string

  constructor(message: string, code = 'SMS_ACCESS_VALIDATION_ERROR') {
    super(message)
    this.name = 'SmsAccessValidationError'
    this.code = code
  }
}

export const normalizePhoneValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null

  const trimmed = String(value).trim()
  if (!trimmed) return null

  const compact = trimmed.replace(/[\s()-]/g, '')
  if (!compact) return null

  const hasLeadingPlus = compact.startsWith('+')
  const rawDigits = hasLeadingPlus ? compact.slice(1) : compact

  if (!/^\d+$/.test(rawDigits)) {
    throw new SmsAccessValidationError(`Invalid phone number format: "${trimmed}". Use international format like +447111111111.`, 'INVALID_PHONE_NUMBER')
  }

  if (rawDigits.length < 7 || rawDigits.length > 15) {
    throw new SmsAccessValidationError(`Invalid phone number length for "${trimmed}". Expected 7 to 15 digits.`, 'INVALID_PHONE_NUMBER_LENGTH')
  }

  return hasLeadingPlus ? `+${rawDigits}` : `+${rawDigits}`
}

export const validateAuthorizedNumbersLimit = (numbers: Array<unknown> = []): void => {
  if (numbers.length > MAX_AUTHORIZED_NUMBERS) {
    throw new SmsAccessValidationError(`A maximum of ${MAX_AUTHORIZED_NUMBERS} authorized numbers is supported.`, 'MAX_AUTHORIZED_NUMBERS_EXCEEDED')
  }
}

export const validateRestrictedAccessHasNumber = (
  restrictedAccess: boolean,
  validNumbersCount: number
): void => {
  if (restrictedAccess && validNumbersCount === 0) {
    throw new SmsAccessValidationError(
      'Whitelist-only access requires at least one valid authorized number.',
      'RESTRICTED_ACCESS_REQUIRES_NUMBER'
    )
  }
}

export const buildEviewSmsAccessSetup = (input: SmsAccessSetupInput = {}): SmsAccessSetupOutput => {
  const authorizedNumbers = Array.isArray(input.authorizedNumbers) ? input.authorizedNumbers : []
  const restrictedAccess = Boolean(input.restrictedAccess)

  validateAuthorizedNumbersLimit(authorizedNumbers)

  const normalizedBySlot = authorizedNumbers
    .slice(0, MAX_AUTHORIZED_NUMBERS)
    .map((number, index) => {
      const normalized = normalizePhoneValue(number)
      if (!normalized) return null

      const slot = index + 1
      return {
        slot,
        number: normalized,
        smsEnabled: 1 as const,
        callEnabled: 0 as const,
        sms: `A${slot},1,0,${normalized}`
      }
    })
    .filter((entry): entry is AuthorizedNumberConfig => Boolean(entry))

  validateRestrictedAccessHasNumber(restrictedAccess, normalizedBySlot.length)

  const accessModeSms = restrictedAccess ? 'callin(1)' : 'callin(0)'
  const smsQueue = [...normalizedBySlot.map((entry) => entry.sms), accessModeSms]

  return {
    config: {
      authorizedNumbers: normalizedBySlot,
      restrictedAccess,
      accessModeSms
    },
    smsQueue
  }
}
