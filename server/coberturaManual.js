import { getPublicSupabase } from './supabase.js'

const CACHE_TTL_MS = 10 * 1000
const cache = new Map()
const LOPESUL_ID = 'lopesul'

function normalizeUf(value) {
  return String(value ?? '').trim().toUpperCase()
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function ordenarSiglas(siglas) {
  return [...siglas].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

function requireClient() {
  const client = getPublicSupabase()
  if (!client) {
    throw new Error('Supabase não configurado para consultar a cobertura de cidades.')
  }
  return client
}

/** Contorna o limite padrão de 1000 linhas do PostgREST/Supabase. */
async function selectAllRows(buildQuery, pageSize = 1000) {
  const rows = []
  let from = 0

  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw new Error(error.message || 'Falha ao consultar cobertura.')
    if (!data?.length) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return rows
}

async function carregarTransportadorasAtivas() {
  const client = requireClient()
  const { data, error } = await client
    .from('transportadoras_cobertura')
    .select('id, nome, sigla, ativo, ordem')
    .eq('ativo', true)
    .eq('id', LOPESUL_ID)
    .order('ordem', { ascending: true })

  if (error) throw new Error(error.message || 'Falha ao carregar transportadoras.')
  return data || []
}

export async function listarUfsCobertura() {
  const client = requireClient()
  const data = await selectAllRows(() =>
    client.from('cobertura_cidades').select('uf').eq('transportadora_id', LOPESUL_ID).order('uf', { ascending: true }),
  )

  const ufs = [...new Set((data || []).map((row) => normalizeUf(row.uf)).filter(Boolean))]
  ufs.sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return {
    sucesso: true,
    ufs,
    total: ufs.length,
  }
}

export async function listarCidadesPorUf(ufRaw) {
  const uf = normalizeUf(ufRaw)
  if (!/^[A-Z]{2}$/.test(uf)) {
    throw new Error('Informe uma UF válida.')
  }

  const cacheKey = `uf:${uf}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data
  }

  const client = requireClient()
  const carriers = await carregarTransportadorasAtivas()
  const siglaPorId = Object.fromEntries(carriers.map((c) => [c.id, c.sigla]))

  const data = await selectAllRows(() =>
    client
      .from('cobertura_cidades')
      .select('cidade, transportadora_id, transportadoras_cobertura!inner(id, sigla, ativo)')
      .eq('uf', uf)
      .eq('transportadora_id', LOPESUL_ID)
      .eq('transportadoras_cobertura.ativo', true)
      .order('cidade', { ascending: true }),
  )

  const byCity = new Map()
  for (const row of data || []) {
    const nome = String(row.cidade || '').trim()
    if (!nome) continue
    const key = normalizeText(nome)
    const sigla =
      row.transportadoras_cobertura?.sigla ||
      siglaPorId[row.transportadora_id] ||
      String(row.transportadora_id || '').slice(0, 2).toUpperCase()

    let entry = byCity.get(key)
    if (!entry) {
      entry = { nome, siglas: new Set() }
      byCity.set(key, entry)
    }
    if (sigla) entry.siglas.add(String(sigla).toUpperCase())
  }

  const cidades = [...byCity.values()]
    .map((item) => ({
      nome: item.nome,
      siglas: ordenarSiglas(item.siglas),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const labels = ordenarSiglas(new Set(cidades.flatMap((c) => c.siglas))).join(' + ')

  const result = {
    sucesso: true,
    uf,
    total: cidades.length,
    cidades,
    carriers: carriers.map((c) => ({ id: c.id, nome: c.nome, sigla: c.sigla })),
    mensagem: cidades.length
      ? `${cidades.length} cidade(s) em ${uf}${labels ? ` (${labels})` : ''}`
      : `Nenhuma cidade cadastrada em ${uf}`,
    fonte: 'manual',
  }

  cache.set(cacheKey, { at: Date.now(), data: result })
  return result
}

export async function buscarCidadesPorNome(nomeRaw) {
  const nome = String(nomeRaw ?? '').trim()
  if (nome.length < 2) {
    throw new Error('Informe ao menos 2 caracteres da cidade.')
  }

  const termo = normalizeText(nome)
  const client = requireClient()
  const carriers = await carregarTransportadorasAtivas()

  const data = await selectAllRows(() =>
    client
      .from('cobertura_cidades')
      .select('uf, cidade, transportadora_id, transportadoras_cobertura!inner(sigla, ativo)')
      .eq('transportadora_id', LOPESUL_ID)
      .eq('transportadoras_cobertura.ativo', true)
      .order('cidade', { ascending: true }),
  )

  const matchesMap = new Map()
  for (const row of data || []) {
    const cidade = String(row.cidade || '').trim()
    const uf = normalizeUf(row.uf)
    if (!cidade || !uf) continue
    const norm = normalizeText(cidade)
    if (!(norm === termo || norm.startsWith(termo) || (termo.length >= 3 && norm.includes(termo)))) {
      continue
    }

    const key = `${norm}|${uf}`
    const sigla = String(row.transportadoras_cobertura?.sigla || '').toUpperCase()
    let entry = matchesMap.get(key)
    if (!entry) {
      entry = { uf, cidade, nome: cidade, siglas: new Set() }
      matchesMap.set(key, entry)
    }
    if (sigla) entry.siglas.add(sigla)
  }

  const matches = [...matchesMap.values()]
    .map((item) => ({
      uf: item.uf,
      cidade: item.cidade,
      nome: item.nome,
      siglas: ordenarSiglas(item.siglas),
    }))
    .sort((a, b) => {
      const byCity = a.cidade.localeCompare(b.cidade, 'pt-BR')
      return byCity || a.uf.localeCompare(b.uf, 'pt-BR')
    })

  return {
    sucesso: true,
    uf: '',
    total: matches.length,
    cidades: matches.map((item) => ({
      nome: `${item.cidade} / ${item.uf}`,
      siglas: item.siglas,
    })),
    matches,
    carriers: carriers.map((c) => ({ id: c.id, nome: c.nome, sigla: c.sigla })),
    mensagem: matches.length
      ? `${matches.length} cidade(s) atendida(s) encontrada(s)`
      : `Nenhuma cidade atendida encontrada para "${nome}"`,
    fonte: 'manual',
  }
}

export function limparCacheCobertura() {
  cache.clear()
}
