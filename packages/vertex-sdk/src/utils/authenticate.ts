import { SignJWT, importPKCS8 } from 'jose'

type Token = {
  access_token: string
  expires_in: number
  token_type: string
}

type TokenWithExpiration = Token & {
  expires_at: number
}

let token: TokenWithExpiration | null = null

async function createToken(options: {
  clientEmail: string
  privateKey: string
}) {
  const rawPrivateKey = options.privateKey.replace(/\\n/g, '\n')
  const privateKey = await importPKCS8(rawPrivateKey, 'RS256')

  const payload = {
    iss: options.clientEmail,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://www.googleapis.com/oauth2/v4/token',
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    iat: Math.floor(Date.now() / 1000),
  }
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setIssuer(options.clientEmail)
    .setAudience('https://www.googleapis.com/oauth2/v4/token')
    .setExpirationTime('1h')
    .sign(privateKey)

  // Form data for the token request
  const form = {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: token,
  }

  // Make the token request
  const tokenResponse = await fetch(
    'https://www.googleapis.com/oauth2/v4/token',
    {
      method: 'POST',
      body: JSON.stringify(form),
      headers: { 'Content-Type': 'application/json' },
    },
  )

  const json = (await tokenResponse.json()) as Token

  return {
    ...json,
    expires_at: Math.floor(Date.now() / 1000) + json.expires_in,
  }
}

export async function authenticate(options: {
  clientEmail: string
  privateKey: string
}): Promise<Token> {
  if (token === null) {
    token = await createToken(options)
  } else if (token.expires_at < Math.floor(Date.now() / 1000)) {
    token = await createToken(options)
  }
  return token
}
