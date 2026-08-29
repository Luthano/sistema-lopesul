import { getAuthedSupabase, getPublicSupabase } from './supabase.js'

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function limparTexto(value, max = 200) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

const ANO_MIN = 1980
const ANO_MAX = new Date().getFullYear() + 1
const STATUS_OK = new Set(['novo', 'em_contato', 'aprovado', 'recusado'])

export function validarCadastroVeiculo(body = {}) {
  const marca = limparTexto(body.marca, 80)
  const ano = Number(body.ano)
  const modelo = limparTexto(body.modelo, 120)
  const cor = limparTexto(body.cor, 60)
  const rotas = limparTexto(body.rotas, 2000)
  const nome = limparTexto(body.nome, 120) || null
  const telefone = onlyDigits(body.telefone).slice(0, 15) || null
  const emailRaw = limparTexto(body.email, 160).toLowerCase()
  const email = emailRaw || null

  if (marca.length < 2) {
    return { ok: false, mensagem: 'Informe a marca do veículo.' }
  }
  if (!Number.isInteger(ano) || ano < ANO_MIN || ano > ANO_MAX) {
    return { ok: false, mensagem: `Informe um ano entre ${ANO_MIN} e ${ANO_MAX}.` }
  }
  if (modelo.length < 2) {
    return { ok: false, mensagem: 'Informe o modelo do veículo.' }
  }
  if (cor.length < 2) {
    return { ok: false, mensagem: 'Informe a cor do veículo.' }
  }
  if (rotas.length < 3) {
    return { ok: false, mensagem: 'Descreva as rotas que você atende.' }
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, mensagem: 'E-mail inválido.' }
  }
  if (telefone && telefone.length < 10) {
    return { ok: false, mensagem: 'Telefone inválido. Use DDD + número.' }
  }

  return {
    ok: true,
    data: { marca, ano, modelo, cor, rotas, nome, telefone, email },
  }
}

export async function salvarVeiculoParceiro(req, body) {
  const validacao = validarCadastroVeiculo(body)
  if (!validacao.ok) {
    return { sucesso: false, mensagem: validacao.mensagem }
  }

  const auth = await getAuthedSupabase(req)
  const supabase = auth?.client || getPublicSupabase()
  if (!supabase) {
    return { sucesso: false, mensagem: 'Supabase não configurado no servidor.' }
  }

  const payload = {
    ...validacao.data,
    ...(auth ? { user_id: auth.userId } : { user_id: null }),
  }

  // Se logado e não informou e-mail, usa o da conta
  if (auth?.email && !payload.email) {
    payload.email = String(auth.email).toLowerCase()
  }

  const { data, error } = await supabase
    .from('veiculos_parceiros')
    .insert(payload)
    .select('id, created_at, status, user_id')
    .maybeSingle()

  if (error) {
    console.error('Erro ao salvar veículo parceiro:', error.message)
    return {
      sucesso: false,
      mensagem: 'Não foi possível salvar o cadastro. Tente novamente.',
    }
  }

  return {
    sucesso: true,
    mensagem: auth
      ? 'Cadastro vinculado à sua conta. Você pode editar no painel.'
      : 'Cadastro enviado. Crie login na Lopesul com o mesmo e-mail para editar depois.',
    veiculo: data,
  }
}

export async function atualizarVeiculoParceiro(req, id, body) {
  const auth = await getAuthedSupabase(req)
  if (!auth) {
    return { sucesso: false, mensagem: 'Faça login para editar o cadastro.' }
  }

  const validacao = validarCadastroVeiculo(body)
  if (!validacao.ok) {
    return { sucesso: false, mensagem: validacao.mensagem }
  }

  const { data: profile } = await auth.client
    .from('profiles')
    .select('role')
    .eq('id', auth.userId)
    .maybeSingle()

  const isMaster = profile?.role === 'master'
  const patch = { ...validacao.data }

  if (isMaster) {
    const status = String(body.status || '').trim()
    if (status && STATUS_OK.has(status)) patch.status = status
    if (body.notas_master !== undefined) {
      patch.notas_master = limparTexto(body.notas_master, 2000) || null
    }
  }

  let query = auth.client.from('veiculos_parceiros').update(patch).eq('id', id)
  if (!isMaster) query = query.eq('user_id', auth.userId)

  const { data, error } = await query.select('*').maybeSingle()
  if (error) {
    console.error('Erro ao atualizar veículo:', error.message)
    return { sucesso: false, mensagem: 'Não foi possível atualizar o cadastro.' }
  }
  if (!data) {
    return { sucesso: false, mensagem: 'Cadastro não encontrado ou sem permissão.' }
  }

  return { sucesso: true, mensagem: 'Cadastro atualizado.', veiculo: data }
}

export async function listarVeiculosParceiros(req, { status } = {}) {
  const auth = await getAuthedSupabase(req)
  if (!auth) {
    return { sucesso: false, mensagem: 'Faça login para ver os cadastros.', veiculos: [] }
  }

  const { data: profile } = await auth.client
    .from('profiles')
    .select('role')
    .eq('id', auth.userId)
    .maybeSingle()

  const isMaster = profile?.role === 'master'
  let query = auth.client.from('veiculos_parceiros').select('*').order('created_at', { ascending: false })

  if (!isMaster) query = query.eq('user_id', auth.userId)
  if (status && STATUS_OK.has(status)) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('Erro ao listar veículos:', error.message)
    return { sucesso: false, mensagem: 'Não foi possível listar os cadastros.', veiculos: [] }
  }

  return { sucesso: true, veiculos: data || [], isMaster }
}

export async function reivindicarVeiculosPorEmail(req) {
  const auth = await getAuthedSupabase(req)
  if (!auth?.email) {
    return { sucesso: false, mensagem: 'Faça login para vincular cadastros.', vinculados: 0 }
  }

  const email = String(auth.email).toLowerCase()
  const { data, error } = await auth.client
    .from('veiculos_parceiros')
    .update({ user_id: auth.userId })
    .is('user_id', null)
    .eq('email', email)
    .select('id')

  if (error) {
    console.error('Erro ao reivindicar veículos:', error.message)
    return { sucesso: false, mensagem: 'Não foi possível vincular cadastros anteriores.', vinculados: 0 }
  }

  return {
    sucesso: true,
    vinculados: data?.length || 0,
    mensagem:
      data?.length > 0
        ? `${data.length} cadastro(s) vinculado(s) à sua conta.`
        : 'Nenhum cadastro anônimo encontrado para este e-mail.',
  }
}
