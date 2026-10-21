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

  test('values of fields named like secrets, in any format', () => {
    for (const text of [
      "curl -H 'x-api-key: 1a2b3c4d5e6f7a8b.c9d0e1f2-3a4b-5c6d'",
      "-H 'x-acme-token: Zt5Kq9Lm-Wx2Rv7Np4-Hc8Jd3Gf6Ys1Bu0Ea'",
      '{ "clientSecret": "q8Fv2R.kLm9Tz~Wp4Hx7Nc3" }',
      'MY_SERVICE_AUTH=Wx2Rv7Np4Hc8Jd3Gf6Ys',
      'https://acct.blob.core.windows.net/c?sv=2024&sig=Ab3dEf6hIj9kLm2nOp5q%3D',
    ]) expect(kinds(text, false)).toEqual(['named-secret'])
    expect(kinds('Host=db;Username=app;Password=s3cretPass;')).toEqual(['connection-password'])
  })

  test('random strings in typed text, but not when entropy is off', () => {
    expect(kinds(`the secret is "${RANDOM}"`)).toEqual(['high-entropy'])
    expect(kinds(`the secret is "${RANDOM}"`, false)).toEqual([])
  })
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
      'sortKey: createdAtTimestamp',
      'PublicKeyToken=b77a5c561934e089',
      'UnauthorizedLogWindow = TimeSpan.FromMinutes(5)',
      'HashKey = RandomNumberGenerator.GetBytes(32)',
      "key: '/Users/someone/projects/app/src/index.ts'",
      'tokenExpiresAt: 2026-10-14T13:35:06.207Z',
      'apiSecret: __ENV.API_SECRET_V2',
      'secret: ${CI_DEPLOY_TOKEN_2}',
      'password: ****redacted0h',
      'ThrottleKey: "tenant.upload:42:device7"',
      'const token = await getAccessToken(scope)',
      '"publicKeyId": "11111111-2222-4333-8444-555555555555"',
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

// Regression: the named-secret prefix was unbounded, so dash/underscore-separated text of this size took seconds.
test('long separator-heavy text is scanned in linear time and still finds a secret after it', () => {
  const filler = 'ab-'.repeat(33_000)
  const started = performance.now()
  const found = detect(`${filler}\nMY_SERVICE_AUTH=Wx2Rv7Np4Hc8Jd3Gf6Ys`, { entropy: false })
  expect(performance.now() - started).toBeLessThan(250)
  expect(found.map(f => f.kind)).toEqual(['named-secret'])
})
