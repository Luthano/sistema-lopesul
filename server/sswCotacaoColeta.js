import { XMLParser } from 'fast-xml-parser'
import { getDefaultCredentials, getCarrier } from './sswCarriers.js'
import { decodeHtmlEntities } from './htmlEntities.js'

const NS = 'urn:sswinfbr.sswCotacaoColeta'
const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  parseTagValue: true,
})

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildSoapEnvelope(method, fields) {
  const body = Object.entries(fields)
    .map(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return `<${key} xsi:nil="true"/>`
      }
      return `<${key}>${escapeXml(value)}</${key}>`
    })
    .join('')

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <${method} xmlns="${NS}">
      ${body}
    </${method}>
  </soap:Body>
</soap:Envelope>`
}

function resolveCredentials(credentialsOrCarrierId) {
  if (credentialsOrCarrierId && typeof credentialsOrCarrierId === 'object') {
    const { dominio, login, senha } = credentialsOrCarrierId
    if (dominio && login && senha) return { dominio, login, senha }
  }
  if (typeof credentialsOrCarrierId === 'string' && credentialsOrCarrierId.trim()) {
    const carrier = getCarrier(credentialsOrCarrierId)
    if (carrier) return carrier.credentials
    throw new Error(`Transportadora "${credentialsOrCarrierId}" não configurada.`)
  }
  return getDefaultCredentials()
}

function getEndpoint() {
  return process.env.SSW_COTACAO_COLETA_URL || 'https://ssw.inf.br/ws/sswCotacaoColeta/index.php'
}

function extractReturnXml(soapResponse) {
  const decoded = soapResponse
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")

  const returnMatch = decoded.match(/<return[^>]*>([\s\S]*?)<\/return>/i)
  if (returnMatch) {
    let inner = returnMatch[1].trim()
    if (inner.includes('&lt;')) {
      inner = inner
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
    }
    return inner
  }

  const cotacaoMatch = decoded.match(/<cotacao[\s\S]*<\/cotacao>/i)
  if (cotacaoMatch) return cotacaoMatch[0]

  const coletaMatch = decoded.match(/<coleta[\s\S]*<\/coleta>/i)
  if (coletaMatch) return coletaMatch[0]

  return decoded
}

async function callSsw(method, fields) {
  const envelope = buildSoapEnvelope(method, fields)
  const response = await fetch(getEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `${NS}#${method}`,
      Accept: 'text/xml',
    },
    body: envelope,
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`SSW respondeu HTTP ${response.status}: ${text.slice(0, 200)}`)
  }

  return extractReturnXml(text)
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function parseMoney(value) {
  if (typeof value === 'number') return value
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  const num = Number(normalized)
  return Number.isNaN(num) ? null : num
}

function toSoapDateTime(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''

  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function assertLimiteColeta(isoDateTime) {
  const date = new Date(isoDateTime)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Informe uma data e hora limite válidas para a coleta.')
  }

  const now = new Date()
  const max = new Date()
  max.setDate(max.getDate() + 15)

  if (date.getTime() < now.getTime() - 60 * 1000) {
    throw new Error('A data limite da coleta não pode estar no passado.')
  }
  if (date.getTime() > max.getTime()) {
    throw new Error('A data de coleta não pode ultrapassar 15 dias.')
  }
}

export async function cotar(payload, credentialsOrCarrierId) {
  const credentials = resolveCredentials(credentialsOrCarrierId)
  const peso = Number(payload.peso) || 0
  const volume = Number(payload.volume) || 0
  const valorNF = Number(payload.valorNF)

  if (!peso && !volume && !(valorNF > 0)) {
    throw new Error('Sem peso e sem cubagem, informe o valor da nota fiscal.')
  }

  const fields = {
    ...credentials,
    cnpjPagador: onlyDigits(payload.cnpjPagador),
    cepOrigem: onlyDigits(payload.cepOrigem),
    cepDestino: onlyDigits(payload.cepDestino),
    valorNF,
    quantidade: Number(payload.quantidade),
    peso,
    volume,
    mercadoria: Number(payload.mercadoria) || 1,
    ciffob: payload.ciffob || undefined,
    cnpjRemetente: onlyDigits(payload.cnpjRemetente) || undefined,
    cnpjDestinatario: onlyDigits(payload.cnpjDestinatario) || undefined,
    observacao: String(payload.observacao ?? '').trim().slice(0, 195) || undefined,
    trt: payload.trt || undefined,
    coletar: payload.coletar || undefined,
    entDificil: payload.entDificil || undefined,
    destContribuinte: payload.destContribuinte || undefined,
    qtdePares: payload.qtdePares ? Number(payload.qtdePares) : undefined,
    altura: payload.altura ? Number(payload.altura) : undefined,
    largura: payload.largura ? Number(payload.largura) : undefined,
    comprimento: payload.comprimento ? Number(payload.comprimento) : undefined,
    fatorMultiplicador: payload.fatorMultiplicador ? Number(payload.fatorMultiplicador) : undefined,
  }

  const xml = await callSsw('cotar', fields)
  const parsed = parser.parse(xml)
  const cotacao = parsed.cotacao || parsed
  const erro = Number(cotacao.erro)
  const numeroCotacao = String(cotacao.cotacao || '').trim()
  const token = String(cotacao.token || '').trim()
  const totalFrete = parseMoney(cotacao.frete)

  return {
    erro,
    mensagem: decodeHtmlEntities(cotacao.mensagem || ''),
    sucesso: erro === 0 && Boolean(numeroCotacao) && Boolean(token),
    alerta: erro === 1,
    enviado: {
      quantidade: fields.quantidade,
      peso: fields.peso,
      volume: fields.volume,
      valorNF: fields.valorNF,
    },
    prazo: cotacao.prazo,
    totalFrete,
    numeroCotacao,
    token,
  }
}

export async function solicitarColeta(payload) {
  const credentials = resolveCredentials(payload.transportadoraId || payload.credentials)
  const solicitante = String(payload.solicitante ?? '').trim()
  const token = String(payload.token ?? '').trim()
  const cotacao = Number(payload.cotacao || payload.numeroCotacao)
  const limiteColeta = toSoapDateTime(payload.limiteColeta)

  if (!solicitante) throw new Error('Informe o nome do solicitante.')
  if (!token) throw new Error('Token da cotação ausente. Gere a cotação novamente.')
  if (!cotacao) throw new Error('Número da cotação ausente. Gere a cotação novamente.')
  assertLimiteColeta(limiteColeta)

  const fields = {
    ...credentials,
    cotacao,
    limiteColeta,
    token,
    solicitante,
    observacao: String(payload.observacao ?? '').trim().slice(0, 195) || undefined,
    chaveNFe: String(payload.chaveNFe ?? '').trim() || undefined,
    nroPedido: String(payload.nroPedido ?? payload.numeroNF ?? '').trim() || undefined,
  }

  const xml = await callSsw('coletar', fields)
  const parsed = parser.parse(xml)
  const coleta = parsed.coleta || parsed
  const erro = Number(coleta.erro)
  const numeroColeta = String(coleta.coleta || coleta.numeroColeta || '').trim()

  return {
    erro,
    sucesso: erro === 0 && Boolean(numeroColeta),
    mensagem: decodeHtmlEntities(coleta.mensagem || (erro === 0 ? 'Coleta gerada com sucesso' : 'Não foi possível gerar a coleta')),
    numeroColeta,
  }
}
