import { supabase } from './supabase'

export const ACCEPT_ATENDIMENTO =
  'image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const LIMITES = {
  imagem: 8 * 1024 * 1024,
  audio: 15 * 1024 * 1024,
  video: 40 * 1024 * 1024,
  documento: 15 * 1024 * 1024,
}

const MIME_TIPO = {
  'image/jpeg': 'imagem',
  'image/png': 'imagem',
  'image/gif': 'imagem',
  'image/webp': 'imagem',
  'image/heic': 'imagem',
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/mp4': 'audio',
  'audio/aac': 'audio',
  'audio/webm': 'audio',
  'audio/ogg': 'audio',
  'audio/wav': 'audio',
  'audio/x-wav': 'audio',
  'audio/x-m4a': 'audio',
  'audio/m4a': 'audio',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
  'video/3gpp': 'video',
  'application/pdf': 'documento',
  'application/msword': 'documento',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'documento',
  'application/vnd.ms-excel': 'documento',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'documento',
}

const EXT_TIPO = {
  jpg: 'imagem',
  jpeg: 'imagem',
  png: 'imagem',
  gif: 'imagem',
  webp: 'imagem',
  heic: 'imagem',
  mp3: 'audio',
  m4a: 'audio',
  aac: 'audio',
  wav: 'audio',
  ogg: 'audio',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  pdf: 'documento',
  doc: 'documento',
  docx: 'documento',
  xls: 'documento',
  xlsx: 'documento',
}

export function extensaoArquivo(nome) {
  const parte = String(nome || '').split('.').pop()
  return String(parte || '').toLowerCase()
}

export function classificarArquivo(file) {
  const mime = String(file?.type || '').toLowerCase().split(';')[0].trim()
  const nome = String(file?.name || '')
  if (MIME_TIPO[mime]) return MIME_TIPO[mime]
  if (mime.startsWith('audio/') || /^audio[-_]/i.test(nome)) return 'audio'
  if (mime.startsWith('image/')) return 'imagem'
  if (mime.startsWith('video/')) return 'video'
  return EXT_TIPO[extensaoArquivo(nome)] || ''
}

export function validarArquivo(file) {
  if (!file) throw new Error('Selecione um arquivo.')
  const tipo = classificarArquivo(file)
  if (!tipo) {
    throw new Error('Envie imagem, áudio, vídeo, PDF, Word ou Excel.')
  }
  const limite = LIMITES[tipo]
  if (file.size > limite) {
    const mb = Math.round(limite / (1024 * 1024))
    throw new Error(`Este arquivo passa de ${mb} MB.`)
  }
  return tipo
}

export function nomeArquivoSeguro(nome) {
  const bruto = String(nome || 'arquivo').replace(/[/\\]/g, '')
  const limpo = bruto.replace(/[^\w.\- ()à-úÀ-Ú]/gi, '_').slice(0, 80)
  return limpo || 'arquivo'
}

export async function enviarArquivoConversa(conversaId, file) {
  const tipo = validarArquivo(file)
  const nome = nomeArquivoSeguro(file.name)
  const path = `${conversaId}/${crypto.randomUUID()}-${nome}`

  const { error } = await supabase.storage.from('atendimento').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || undefined,
    upsert: false,
  })
  if (error) throw new Error(error.message || 'Não foi possível enviar o arquivo.')

  return {
    tipo,
    path,
    nome: file.name || nome,
    mime: file.type || '',
    tamanho: file.size,
  }
}

export async function urlAssinadaAnexo(path) {
  if (!path) return ''
  const { data, error } = await supabase.storage.from('atendimento').createSignedUrl(path, 3600)
  if (error) throw error
  return data?.signedUrl || ''
}

export function rotuloTipoAnexo(tipo) {
  return (
    {
      imagem: 'Imagem',
      audio: 'Áudio',
      video: 'Vídeo',
      documento: 'Documento',
    }[tipo] || 'Arquivo'
  )
}
