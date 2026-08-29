/**
 * Extrai a malha pública da Lopesul no SSW (página Área atendida).
 * Origem: unidades em SSW_CIDADES_ORIGEM (padrão Cascavel / Maringá / Londrina).
 */

const AREAS_URL = 'https://ssw.inf.br/areas.asp'
const PAUSA_MS = 280
const LOPESUL_ID = 'lopesul'

/** Valor do campo ufe no SSW (MG usa MI no texto de pesquisa). */
const UF_PESQUISA = [
  ['AC', '(AC)ACRE'],
  ['AL', '(AL)ALAGOAS'],
  ['AM', '(AM)AMAZONAS'],
  ['AP', '(AP)AMAPA'],
  ['BA', '(BA)BAHIA'],
  ['CE', '(CE)CEARA'],
  ['DF', '(DF)DISTRITO FEDERAL'],
  ['ES', '(ES)ESPIRITO SANTO'],
  ['GO', '(GO)GOIAS'],
  ['MA', '(MA)MARANHAO'],
  ['MG', '(MI)MINAS GERAIS'],
  ['MS', '(MS)MATO GROSSO DO SUL'],
  ['MT', '(MT)MATO GROSSO'],
  ['PA', '(PA)PARA'],
  ['PB', '(PB)PARAIBA'],
  ['PE', '(PE)PERNAMBUCO'],
  ['PI', '(PI)PIAUI'],
  ['PR', '(PR)PARANA'],
  ['RJ', '(RJ)RIO DE JANEIRO'],
  ['RN', '(RN)RIO GRANDE DO NORTE'],
  ['RO', '(RO)RONDONIA'],
  ['RR', '(RR)RORAIMA'],
  ['RS', '(RS)RIO GRANDE DO SUL'],
  ['SC', '(SC)SANTA CATARINA'],
  ['SE', '(SE)SERGIPE'],
  ['SP', '(SP)SAO PAULO'],
  ['TO', '(TO)TOCANTINS'],
]

const ORIGENS_PADRAO = ['CASCAVEL / PR', 'MARINGA / PR', 'LONDRINA / PR']

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function origensDoEnv() {
  const raw = String(process.env.SSW_CIDADES_ORIGEM || '').trim()
  if (!raw) return ORIGENS_PADRAO
  return raw
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
}

function decodeCampo(value) {
  return decodeURIComponent(String(value || '').replace(/\+/g, '%20'))
    .replace(/\s+/g, ' ')
    .trim()
}

function parseCidadeTag(raw) {
  const text = decodeCampo(raw)
  const slash = text.indexOf('/')
  if (slash < 2) return null
  const uf = text.slice(0, slash).trim().toUpperCase()
  const cidade = text.slice(slash + 1).trim()
  if (!/^[A-Z]{2}$/.test(uf) || cidade.length < 2) return null
  return { uf, cidade }
}

function extrairRegistros(html) {
  const cidades = []
  const re = /<cidade>([^<]+)<\/cidade>/gi
  let match
  while ((match = re.exec(html))) {
    const parsed = parseCidadeTag(match[1])
    if (parsed) cidades.push(parsed)
  }
  return cidades
}

function chave(row) {
  return `${row.uf}|${row.cidade.toLocaleUpperCase('pt-BR')}`
}

async function consultarUf(dominio, origem, ufe) {
  const body = new URLSearchParams({
    sigla_emp: dominio,
    sc: 'N',
    find: 'U',
    co: origem,
    cidadeori: origem,
    ce: '',
    cidadedes: '',
    uf: '',
    ufe,
  })

  const response = await fetch(AREAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html',
    },
    body,
  })

  if (!response.ok) {
    throw new Error(`SSW áreas respondeu HTTP ${response.status} para ${ufe}`)
  }

  return extrairRegistros(await response.text())
}

export async function extrairCidadesLopesul(dominio = 'LSU') {
  const origens = origensDoEnv()
  const origemConsulta = origens[0]
  const mapa = new Map()
  const porUf = {}
  const consultas = []

  for (const origem of origens) {
    const [cidadeOrigem, ufOrigem] = origem.split('/').map((p) => p.trim())
    if (cidadeOrigem && ufOrigem) {
      const row = { uf: ufOrigem.toUpperCase(), cidade: cidadeOrigem }
      mapa.set(chave(row), row)
    }
  }

  for (const [, ufe] of UF_PESQUISA) {
    const rows = await consultarUf(dominio, origemConsulta, ufe)
    consultas.push({ origem: origemConsulta, ufe, total: rows.length })
    for (const row of rows) {
      mapa.set(chave(row), row)
    }
    await sleep(PAUSA_MS)
  }

  const cidades = [...mapa.values()].sort((a, b) => {
    const byUf = a.uf.localeCompare(b.uf)
    return byUf || a.cidade.localeCompare(b.cidade, 'pt-BR', { sensitivity: 'base' })
  })

  for (const row of cidades) {
    porUf[row.uf] = (porUf[row.uf] || 0) + 1
  }

  return {
    transportadoraId: LOPESUL_ID,
    dominio,
    origens,
    total: cidades.length,
    porUf,
    cidades,
    consultas,
  }
}

export function linhasCobertura(cidades) {
  return cidades.map((item) => ({
    transportadora_id: LOPESUL_ID,
    uf: item.uf,
    cidade: item.cidade,
  }))
}
