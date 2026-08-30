import { XMLParser } from 'fast-xml-parser'
import { getDefaultCredentials, getCarrier } from './sswCarriers.js'
import { decodeHtmlEntities } from './htmlEntities.js'

const NS = 'urn:sswinfbr.sswCotacao'
const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  parseTagValue: true,
  isArray: (name) => name === 'mercadoria',
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
  return process.env.SSW_COTACAO_URL || 'https://ssw.inf.br/ws/sswCotacao/index.php'
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

  const mercadoriasMatch = decoded.match(/<mercadorias[\s\S]*<\/mercadorias>/i)
  if (mercadoriasMatch) return mercadoriasMatch[0]

  return decoded
}

async function callSsw(method, soapAction, fields) {
  const envelope = buildSoapEnvelope(method, fields)
  const response = await fetch(getEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: soapAction,
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
    cnpjDestinatario: onlyDigits(payload.cnpjDestinatario) || undefined,
    coletar: payload.coletar || undefined,
    entDificil: payload.entDificil || undefined,
    destContribuinte: payload.destContribuinte || undefined,
    qtdePares: payload.qtdePares ? Number(payload.qtdePares) : undefined,
    altura: payload.altura ? Number(payload.altura) : undefined,
    largura: payload.largura ? Number(payload.largura) : undefined,
    comprimento: payload.comprimento ? Number(payload.comprimento) : undefined,
    fatorMultiplicador: payload.fatorMultiplicador
      ? Number(payload.fatorMultiplicador)
      : undefined,
    cnpjRemetente: onlyDigits(payload.cnpjRemetente) || undefined,
  }

  const xml = await callSsw('cotar', `${NS}#cotacao`, fields)
  const parsed = parser.parse(xml)
  const cotacao = parsed.cotacao || parsed

  const erro = Number(cotacao.erro)
  return {
    erro,
    mensagem: decodeHtmlEntities(cotacao.mensagem || ''),
    sucesso: erro === 0 || erro === 1,
    alerta: erro === 1,
    enviado: {
      quantidade: fields.quantidade,
      peso: fields.peso,
      volume: fields.volume,
      valorNF: fields.valorNF,
    },
    pesoCalculo: cotacao.pesoCalculo,
    prazo: cotacao.prazo,
    totalFrete: cotacao.totalFrete,
    tabCalculo: cotacao.tabCalculo,
    detalhamento: {
      fretePeso: cotacao.fretePeso,
      freteValor: cotacao.freteValor,
      despacho: cotacao.despacho,
      cat: cotacao.cat,
      itr: cotacao.itr,
      gris: cotacao.gris,
      pedagio: cotacao.pedagio,
      tas: cotacao.tas,
      adiclocal: cotacao.adiclocal,
      suframa: cotacao.suframa,
      devcannf: cotacao.devcannf,
      reembolso: cotacao.reembolso,
      outros: cotacao.outros,
      coleta: cotacao.coleta,
      entrega: cotacao.entrega,
      adicFrete: cotacao.adicFrete,
      trt: cotacao.trt,
      impostos: cotacao.impostos,
      tar: cotacao.tar,
      pos: cotacao.pos,
      tdc: cotacao.tdc,
      entGeral: cotacao.entGeral,
      agenda: cotacao.agenda,
      paletiz: cotacao.paletiz,
      separa: cotacao.separa,
      capataz: cotacao.capataz,
      veicDedic: cotacao.veicDedic,
      CO2: cotacao.CO2,
      RDC: cotacao.RDC,
      seguroFluvial: cotacao.seguroFluvial,
      redespFluvial: cotacao.redespFluvial,
    },
  }
}

export async function getMercadorias(cnpjPagador, credentialsOrCarrierId) {
  const credentials = resolveCredentials(credentialsOrCarrierId)
  const fields = {
    ...credentials,
    cnpjPagador: onlyDigits(cnpjPagador),
  }

  const xml = await callSsw('getMercadoria', `${NS}#getMercadoria`, fields)
  const parsed = parser.parse(xml)

  if (parsed.cotacao?.erro !== undefined || parsed.erro !== undefined) {
    const erro = Number(parsed.cotacao?.erro ?? parsed.erro)
    const mensagem = parsed.cotacao?.mensagem || parsed.mensagem || 'Erro ao buscar mercadorias'
    return { erro, mensagem, mercadorias: [] }
  }

  const root = parsed.mercadorias || parsed
  let items = root.mercadoria || []
  if (!Array.isArray(items)) items = [items]

  const mercadorias = items
    .filter((item) => item && (item.codigo !== undefined || item.descricao))
    .map((item) => ({
      codigo: Number(item.codigo),
      descricao: String(item.descricao || ''),
    }))

  if (mercadorias.length === 0) {
    mercadorias.push({ codigo: 1, descricao: 'DIVERSOS' })
  }

  return { erro: 0, mensagem: '', mercadorias }
}
