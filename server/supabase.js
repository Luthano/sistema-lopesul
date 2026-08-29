import { createClient } from '@supabase/supabase-js'

function getConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return { url, anonKey }
}

function getAccessToken(req) {
  const header = String(req.headers.authorization || '')
  if (!header.startsWith('Bearer ')) return ''
  return header.slice(7).trim()
}

/** Cliente anon sem usuário (leitura pública RLS). */
export function getPublicSupabase() {
  const config = getConfig()
  if (!config) return null
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function getAuthedSupabase(req) {
  const config = getConfig()
  const token = getAccessToken(req)
  if (!config || !token) return null

  const client = createClient(config.url, config.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null

  return { client, userId: data.user.id, email: data.user.email }
}

export async function exigirUsuario(req) {
  const auth = await getAuthedSupabase(req)
  if (!auth) {
    return { ok: false, status: 401, mensagem: 'Entre na sua conta para usar o sistema.' }
  }
  return { ok: true, client: auth.client, userId: auth.userId, email: auth.email }
}

export async function exigirMaster(req) {
  const auth = await getAuthedSupabase(req)
  if (!auth) {
    return { ok: false, status: 401, mensagem: 'Entre com a conta master para sincronizar a cobertura.' }
  }

  const { data: profile } = await auth.client
    .from('profiles')
    .select('role')
    .eq('id', auth.userId)
    .maybeSingle()

  if (profile?.role !== 'master') {
    return { ok: false, status: 403, mensagem: 'Apenas o master pode sincronizar as cidades do SSW.' }
  }

  return { ok: true, client: auth.client, userId: auth.userId, email: auth.email }
}

export async function podePersistirCotacao(req) {
  const auth = await getAuthedSupabase(req)
  if (!auth) return false

  const { data: profile } = await auth.client
    .from('profiles')
    .select('status, role')
    .eq('id', auth.userId)
    .maybeSingle()

  return profile?.role === 'master' || profile?.status === 'approved'
}

export async function salvarCotacaoHistorico(req, body, result) {
  try {
    const auth = await getAuthedSupabase(req)
    if (!auth) return

    const { error } = await auth.client.from('cotacoes').insert({
      user_id: auth.userId,
      cnpj_pagador: body.cnpjPagador || null,
      cnpj_remetente: body.cnpjRemetente || null,
      cnpj_destinatario: body.cnpjDestinatario || null,
      cep_origem: body.cepOrigem || null,
      cep_destino: body.cepDestino || null,
      valor_nf: body.valorNF ?? null,
      quantidade: body.quantidade ?? null,
      peso: body.peso ?? null,
      volume: body.volume ?? null,
      total_frete: result.totalFrete ?? null,
      prazo: result.prazo != null ? String(result.prazo) : null,
      payload: { request: body, response: { ...result, token: undefined } },
    })

    if (error) console.error('Erro ao gravar cotação no Supabase:', error.message)
  } catch (error) {
    console.error('Erro ao gravar cotação no Supabase:', error.message)
  }
}

export async function salvarColetaHistorico(req, body, result) {
  try {
    const auth = await getAuthedSupabase(req)
    if (!auth) return

    const { error } = await auth.client.from('coletas').insert({
      user_id: auth.userId,
      numero_coleta: result.numeroColeta || null,
      solicitante: body.solicitante || null,
      cep_coleta: body.cepEndColeta || null,
      cep_entrega: body.cepEntrega || null,
      quantidade: body.quantidade ?? null,
      peso: body.peso ?? null,
      limite_coleta: body.limiteColeta || null,
      payload: { request: body, response: result },
    })

    if (error) console.error('Erro ao gravar coleta no Supabase:', error.message)
  } catch (error) {
    console.error('Erro ao gravar coleta no Supabase:', error.message)
  }
}
