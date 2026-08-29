/**
 * Credenciais SSW da Lopesul (domínio único deste sistema).
 * Preencha SSW_LOPESUL_DOMINIO / LOGIN / SENHA (opcional NOME).
 */

const LOPESUL = { id: 'lopesul', nomePadrao: 'Lopesul', envKey: 'LOPESUL' }

function readLopesulFromEnv() {
  const dominio = String(process.env.SSW_LOPESUL_DOMINIO || '').trim()
  const login = String(process.env.SSW_LOPESUL_LOGIN || '').trim()
  const senha = String(process.env.SSW_LOPESUL_SENHA || '').trim()
  const nome = String(process.env.SSW_LOPESUL_NOME || LOPESUL.nomePadrao).trim()

  if (!dominio || !login || !senha) return null

  return {
    id: LOPESUL.id,
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

/** Única transportadora ativa: Lopesul. */
export function listActiveCarriers() {
  const lopesul = readLopesulFromEnv()
  if (lopesul) return [lopesul]

  const legacy = legacyCredentials()
  if (legacy) {
    return [
      {
        id: LOPESUL.id,
        nome: LOPESUL.nomePadrao,
        dominio: legacy.dominio,
        credentials: legacy,
      },
    ]
  }

  return []
}

export function getCarrier(id) {
  const key = String(id || '').trim().toLowerCase()
  if (key && key !== LOPESUL.id) return null
  return listActiveCarriers()[0] || null
}

/** Credenciais para cotação, rastreio, cidades e mercadorias. */
export function getDefaultCredentials() {
  const carriers = listActiveCarriers()
  if (carriers.length > 0) return carriers[0].credentials

  throw new Error(
    'Credenciais SSW da Lopesul não configuradas. Preencha SSW_LOPESUL_DOMINIO, SSW_LOPESUL_LOGIN e SSW_LOPESUL_SENHA no .env',
  )
}

/**
 * CNPJ/CPF pagador.
 * Aceita body.cnpjPagador ou body.cnpjPagadores.lopesul
 */
export function resolveCnpjPagador(carrierId, body = {}) {
  const map = body.cnpjPagadores && typeof body.cnpjPagadores === 'object' ? body.cnpjPagadores : {}
  const override = map.lopesul ?? map[carrierId] ?? map[String(carrierId).toLowerCase()]
  const value = override != null && String(override).trim() !== '' ? override : body.cnpjPagador
  return String(value ?? '').replace(/\D/g, '')
}

export function publicCarrierList() {
  return listActiveCarriers().map(({ id, nome, dominio }) => ({ id, nome, dominio }))
}
