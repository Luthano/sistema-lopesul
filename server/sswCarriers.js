/**
 * Transportadoras SSW (credenciais por domínio).
 * Configure no .env: SSW_CARRIERS=lopesul,envia
 * e SSW_<ID>_DOMINIO / LOGIN / SENHA (opcional NOME).
 * Envia Rápido: adicione `envia` em SSW_CARRIERS + SSW_ENVIA_*.
 */

const CARRIER_CATALOG = [
  { id: 'lopesul', nomePadrao: 'Lopesul', envKey: 'LOPESUL' },
  { id: 'jetlu', nomePadrao: 'Jetlu', envKey: 'JETLU' },
  { id: 'envia', nomePadrao: 'Envia Rápido', envKey: 'ENVIA' },
]

function readCarrierFromEnv(def) {
  const dominio = String(process.env[`SSW_${def.envKey}_DOMINIO`] || '').trim()
  const login = String(process.env[`SSW_${def.envKey}_LOGIN`] || '').trim()
  const senha = String(process.env[`SSW_${def.envKey}_SENHA`] || '').trim()
  const nome = String(process.env[`SSW_${def.envKey}_NOME`] || def.nomePadrao).trim()

  if (!dominio || !login || !senha) return null

  return {
    id: def.id,
    nome,
    dominio,
    credentials: { dominio, login, senha },
  }
}

function legacyCredentials() {
  const dominio = String(process.env.SSW_DOMINIO || '').trim()
  const login = String(process.env.SSW_LOGIN || '').trim()
  const senha = String(process.env.SSW_SENHA || '').trim()
  if (!dominio || !login || !senha) return null
  return { dominio, login, senha }
}

function requestedCarrierIds() {
  const raw = String(process.env.SSW_CARRIERS || '').trim()
  if (!raw) return CARRIER_CATALOG.map((c) => c.id)
  return raw
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean)
}

/** Transportadoras ativas (com credenciais completas). */
export function listActiveCarriers() {
  const wanted = new Set(requestedCarrierIds())
  const carriers = []

  for (const def of CARRIER_CATALOG) {
    if (!wanted.has(def.id)) continue
    const carrier = readCarrierFromEnv(def)
    if (carrier) carriers.push(carrier)
  }

  if (carriers.length > 0) return carriers

  const legacy = legacyCredentials()
  if (legacy) {
    const dominio = String(legacy.dominio || '').toUpperCase()
    const nome =
      dominio === 'JEU' ? 'Jetlu' : dominio === 'LSU' ? 'Lopesul' : dominio || 'Transportadora'
    const id =
      dominio === 'JEU' ? 'jetlu' : dominio === 'LSU' ? 'lopesul' : 'default'
    return [
      {
        id,
        nome,
        dominio: legacy.dominio,
        credentials: legacy,
      },
    ]
  }

  return []
}

export function getCarrier(id) {
  const key = String(id || '').trim().toLowerCase()
  return listActiveCarriers().find((c) => c.id === key) || null
}

/** Credenciais para rastreio, cidades e mercadorias (domínio padrão). */
export function getDefaultCredentials() {
  const defaultId = String(process.env.SSW_DEFAULT_CARRIER || '').trim().toLowerCase()
  const carriers = listActiveCarriers()

  if (defaultId) {
    const found = carriers.find((c) => c.id === defaultId)
    if (found) return found.credentials
  }

  if (carriers.length > 0) return carriers[0].credentials

  const legacy = legacyCredentials()
  if (legacy) return legacy

  throw new Error(
    'Credenciais SSW não configuradas. Preencha SSW_LOPESUL_* / SSW_JETLU_* (ou SSW_DOMINIO/LOGIN/SENHA) no .env',
  )
}

/**
 * CNPJ/CPF pagador por transportadora.
 * body.cnpjPagadores = { lopesul: '...', jetlu: '...' }
 * fallback: body.cnpjPagador
 */
export function resolveCnpjPagador(carrierId, body = {}) {
  const map = body.cnpjPagadores && typeof body.cnpjPagadores === 'object' ? body.cnpjPagadores : {}
  const override = map[carrierId] ?? map[String(carrierId).toLowerCase()]
  const value = override != null && String(override).trim() !== '' ? override : body.cnpjPagador
  return String(value ?? '').replace(/\D/g, '')
}

export function publicCarrierList() {
  return listActiveCarriers().map(({ id, nome, dominio }) => ({ id, nome, dominio }))
}
