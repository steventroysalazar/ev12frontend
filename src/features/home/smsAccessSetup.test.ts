import { describe, expect, it } from 'vitest'
import {
  SmsAccessValidationError,
  buildEviewSmsAccessSetup
} from './smsAccessSetup'

describe('buildEviewSmsAccessSetup', () => {
  it('returns unrestricted access queue for empty input', () => {
    expect(buildEviewSmsAccessSetup()).toEqual({
      config: {
        authorizedNumbers: [],
        restrictedAccess: false,
        accessModeSms: 'callin(0)'
      },
      smsQueue: ['callin(0)']
    })
  })

  it('builds a queue for one number in unrestricted mode', () => {
    expect(buildEviewSmsAccessSetup({
      authorizedNumbers: ['+447111111111'],
      restrictedAccess: false
    })).toEqual({
      config: {
        authorizedNumbers: [
          { slot: 1, number: '+447111111111', smsEnabled: 1, callEnabled: 0, sms: 'A1,1,0,+447111111111' }
        ],
        restrictedAccess: false,
        accessModeSms: 'callin(0)'
      },
      smsQueue: ['A1,1,0,+447111111111', 'callin(0)']
    })
  })

  it('builds queue with three numbers in restricted mode', () => {
    expect(buildEviewSmsAccessSetup({
      authorizedNumbers: ['+447111111111', '+447222222222', '+447333333333'],
      restrictedAccess: true
    })).toEqual({
      config: {
        authorizedNumbers: [
          { slot: 1, number: '+447111111111', smsEnabled: 1, callEnabled: 0, sms: 'A1,1,0,+447111111111' },
          { slot: 2, number: '+447222222222', smsEnabled: 1, callEnabled: 0, sms: 'A2,1,0,+447222222222' },
          { slot: 3, number: '+447333333333', smsEnabled: 1, callEnabled: 0, sms: 'A3,1,0,+447333333333' }
        ],
        restrictedAccess: true,
        accessModeSms: 'callin(1)'
      },
      smsQueue: ['A1,1,0,+447111111111', 'A2,1,0,+447222222222', 'A3,1,0,+447333333333', 'callin(1)']
    })
  })

  it('skips blank and null slots while preserving slot order', () => {
    expect(buildEviewSmsAccessSetup({
      authorizedNumbers: ['+447111111111', '', null, '+447444444444'],
      restrictedAccess: false
    })).toEqual({
      config: {
        authorizedNumbers: [
          { slot: 1, number: '+447111111111', smsEnabled: 1, callEnabled: 0, sms: 'A1,1,0,+447111111111' },
          { slot: 4, number: '+447444444444', smsEnabled: 1, callEnabled: 0, sms: 'A4,1,0,+447444444444' }
        ],
        restrictedAccess: false,
        accessModeSms: 'callin(0)'
      },
      smsQueue: ['A1,1,0,+447111111111', 'A4,1,0,+447444444444', 'callin(0)']
    })
  })

  it('throws when more than 10 numbers are provided', () => {
    expect(() => buildEviewSmsAccessSetup({
      authorizedNumbers: Array.from({ length: 11 }, (_, index) => `+44700000000${index}`),
      restrictedAccess: false
    })).toThrowError(SmsAccessValidationError)
  })

  it('throws when restricted mode has no valid numbers', () => {
    expect(() => buildEviewSmsAccessSetup({
      authorizedNumbers: ['', null],
      restrictedAccess: true
    })).toThrowError('Whitelist-only access requires at least one valid authorized number.')
  })
})
