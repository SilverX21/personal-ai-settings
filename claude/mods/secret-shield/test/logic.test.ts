import { describe, expect, test } from 'claude-code/testing'

import { detect, mask, redact } from '../hooks/logic'

// Fake values with the right shapes; none of them is a real credential.
const PAT = 'x7Q'.repeat(25) + 'z' + 'AZDO' + 'F4KE' // 84 chars
const RANDOM = 'Fq8vR2kLm9Tz_Wp4Hx7Nc-3Jd6Gb1Ys5Ea0Ku8Oi2Pq'

const kinds = (text: string, entropy = true) => detect(text, { entropy }).map(f => f.kind)

describe('finds', () => {
  test('known token shapes', () => {
    expect(kinds(`PAT: ${PAT}`)).toEqual(['azure-devops-pat'])
    expect(kinds('token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U')).toEqual(['jwt'])
    expect(kinds('AKIAIOSFODNN7EXAMPL3 is the key id')).toEqual(['aws-access-key'])
    expect(kinds('ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8')).toEqual(['github-token'])
    expect(kinds('-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----')).toEqual(['private-key'])
  })

  test('header values and connection-string passwords', () => {
    expect(kinds("curl -H 'x-api-key: 1a2b3c4d5e6f7a8b.c9d0e1f2-3a4b-5c6d'")).toEqual(['header-secret'])
    expect(kinds('Host=db;Username=app;Password=s3cretPass;')).toEqual(['connection-password'])
  })

  test('random strings in typed text, but not when entropy is off', () => {
    expect(kinds(`the secret is "${RANDOM}"`)).toEqual(['high-entropy'])
    expect(kinds(`the secret is "${RANDOM}"`, false)).toEqual([])
  })
})

test('extra header names from the option', () => {
  const text = "-H 'x-acme-token: Zt5Kq9Lm-Wx2Rv7Np4-Hc8Jd3Gf6Ys1Bu0Ea'"
  expect(kinds(text, false)).toEqual([])
  expect(detect(text, { entropy: false, headers: ['x-acme-token'] }).map(f => f.kind)).toEqual(['header-secret'])
})

describe('leaves alone', () => {
  test('ids, hashes, identifiers, paths and placeholders', () => {
    const text = [
      '11111111-2222-4333-8444-555555555555',
      '37ffa4dc1e2b3a4f5e6d7c8b9a0f1e2d3c4b5a69',
      'build-cache-a1b2c3d4e5f60718293a4b5c6d7e8f90',
      '0011223344556677',
      'my-infra-customer-onboarding-01',
      '123456789012_DevAdministrator',
      'CreateIntegrationCommandValidatorTests',
      '/var/folders/x1/abcd1234efgh5678ijkl90mn0000gn/T/Screenshot.png',
      "-H 'x-api-key: $API_KEY'",
      'Authorization: Bearer <token>',
      'Password = AppRolePassword',
      'Password=******',
      'Password=<REDACTED:connection-password>;Pwd=$DB_PASSWORD;',
      '[Image #12]',
    ].join('\n')
    expect(detect(text)).toEqual([])
  })
})

test('redact replaces each finding with its kind', () => {
  expect(redact(`key ${PAT} and Password=hunter22;`)).toBe('key <REDACTED:azure-devops-pat> and Password=<REDACTED:connection-password>;')
})

test('mask shows only the edges', () => {
  expect(mask(RANDOM)).toBe('Fq8v…Pq (43)')
  expect(mask('short')).toBe('*****')
})
