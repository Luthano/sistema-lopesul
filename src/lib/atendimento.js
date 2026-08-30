import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export const SETORES_ATENDIMENTO = [
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'agencias', label: 'Agências' },
  { id: 'administrativo', label: 'Administrativo' },
]

export function labelSetor(setor) {
  return SETORES_ATENDIMENTO.find((item) => item.id === setor)?.label || 'Atendimento'
}

export function previewMensagem(texto) {
  const limpo = String(texto || '').replace(/\s+/g, ' ').trim()
  return limpo.slice(0, 140)
}

const CONVERSA_CAMPOS =
  'id, cliente_id, setor, status, ultima_mensagem_at, preview, nao_lidas_cliente, nao_lidas_master'

export async function buscarConversaCliente(clienteId, setor) {
  const { data, error } = await supabase
    .from('atendimento_conversas')
    .select(CONVERSA_CAMPOS)
    .eq('cliente_id', clienteId)
    .eq('setor', setor)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function listarConversasCliente(clienteId) {
  const { data, error } = await supabase
    .from('atendimento_conversas')
    .select(CONVERSA_CAMPOS)
    .eq('cliente_id', clienteId)

  if (error) throw error
  return data || []
}

export async function garantirConversaCliente(clienteId, setor) {
  const existente = await buscarConversaCliente(clienteId, setor)
  if (existente) return existente

  const { data, error } = await supabase
    .from('atendimento_conversas')
    .insert({ cliente_id: clienteId, setor, status: 'aberta' })
    .select(CONVERSA_CAMPOS)
    .single()

  if (error?.code === '23505') {
    return buscarConversaCliente(clienteId, setor)
  }
  if (error) throw error
  return data
}

export async function listarConversasMaster() {
  const { data, error } = await supabase
    .from('atendimento_conversas')
    .select(
      'id, cliente_id, setor, status, ultima_mensagem_at, preview, nao_lidas_cliente, nao_lidas_master, profiles:cliente_id (id, nome_completo, email)',
    )
    .order('ultima_mensagem_at', { ascending: false, nullsFirst: false })

  if (error) throw error
  return data || []
}

const MENSAGEM_CAMPOS =
  'id, conversa_id, autor_id, papel, corpo, tipo, arquivo_path, arquivo_nome, arquivo_mime, arquivo_tamanho, created_at'

export async function listarMensagens(conversaId) {
  const { data, error } = await supabase
    .from('atendimento_mensagens')
    .select(MENSAGEM_CAMPOS)
    .eq('conversa_id', conversaId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function enviarMensagem({ conversaId, autorId, papel, corpo, anexo }) {
  const texto = String(corpo || '').replace(/\s+/g, ' ').trim()
  if (!anexo && texto.length < 1) throw new Error('Escreva uma mensagem ou anexe um arquivo.')
  if (texto.length > 2000) throw new Error('A mensagem é longa demais.')

  const { data, error } = await supabase
    .from('atendimento_mensagens')
    .insert({
      conversa_id: conversaId,
      autor_id: autorId,
      papel,
      corpo: texto,
      tipo: anexo?.tipo || 'texto',
      arquivo_path: anexo?.path || null,
      arquivo_nome: anexo?.nome || null,
      arquivo_mime: anexo?.mime || null,
      arquivo_tamanho: anexo?.tamanho || null,
    })
    .select(MENSAGEM_CAMPOS)
    .single()

  if (error) throw error
  return data
}

export async function marcarLida(conversaId, isMaster) {
  const campo = isMaster ? 'nao_lidas_master' : 'nao_lidas_cliente'
  const { error } = await supabase
    .from('atendimento_conversas')
    .update({ [campo]: 0 })
    .eq('id', conversaId)

  if (error) throw error
}

export async function contarNaoLidas(userId, isMaster) {
  let query = supabase.from('atendimento_conversas').select('nao_lidas_cliente, nao_lidas_master')
  if (!isMaster) query = query.eq('cliente_id', userId)
  const { data, error } = await query
  if (error) throw error
  return (data || []).reduce(
    (total, row) => total + (Number(isMaster ? row.nao_lidas_master : row.nao_lidas_cliente) || 0),
    0,
  )
}

export function useAtendimentoNaoLidas(userId, isMaster) {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!userId) {
      setCount(0)
      return
    }
    try {
      setCount(await contarNaoLidas(userId, isMaster))
    } catch {
      setCount(0)
    }
  }, [userId, isMaster])

  useEffect(() => {
    refresh()
    if (!userId) return undefined

    const filter = isMaster ? undefined : `cliente_id=eq.${userId}`
    const channel = supabase
      .channel(`atend-unread-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'atendimento_conversas',
          ...(filter ? { filter } : {}),
        },
        () => {
          refresh()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, isMaster, refresh])

  return count
}

export function formatarHoraMensagem(value) {
  if (!value) return ''
  const data = new Date(value)
  if (Number.isNaN(data.getTime())) return ''
  const hoje = new Date()
  const mesmaDia =
    data.getDate() === hoje.getDate() &&
    data.getMonth() === hoje.getMonth() &&
    data.getFullYear() === hoje.getFullYear()
  return mesmaDia
    ? data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
