/** Extrai texto de valores vindos do XML/SSW (string, número ou objeto do parser). */
export function toPlainText(value) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(toPlainText).filter(Boolean).join(' ').trim()
  }
  if (typeof value === 'object') {
    if (value['#text'] != null) return toPlainText(value['#text'])
    if (value._ != null) return toPlainText(value._)
    if (value.mensagem != null) return toPlainText(value.mensagem)
    if (value.text != null) return toPlainText(value.text)
    // Tag vazia ou só atributos → sem mensagem útil
    const keys = Object.keys(value).filter((k) => !k.startsWith('@_'))
    if (keys.length === 0) return ''
    return keys.map((k) => toPlainText(value[k])).filter(Boolean).join(' ').trim()
  }
  return ''
}

/** Decodifica entidades HTML comuns nas respostas do SSW (pt-BR). */
export function decodeHtmlEntities(value) {
  return toPlainText(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&aacute;/gi, 'á')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&agrave;/gi, 'à')
    .replace(/&acirc;/gi, 'â')
    .replace(/&atilde;/gi, 'ã')
    .replace(/&Atilde;/g, 'Ã')
    .replace(/&eacute;/gi, 'é')
    .replace(/&Eacute;/g, 'É')
    .replace(/&ecirc;/gi, 'ê')
    .replace(/&iacute;/gi, 'í')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&ocirc;/gi, 'ô')
    .replace(/&otilde;/gi, 'õ')
    .replace(/&Otilde;/g, 'Õ')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&uuml;/gi, 'ü')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&ordm;/gi, 'º')
    .replace(/&ordf;/gi, 'ª')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .trim()
}

export function mensagemSemCobertura(ofertas = []) {
  const falhas = ofertas.filter((o) => !o.sucesso)
  if (falhas.length === 0) return 'A Lopesul não retornou cotação.'

  const textos = falhas.map((o) => ({
    nome: o.nome || 'Transportadora',
    mensagem: decodeHtmlEntities(o.mensagem) || 'sem cobertura',
  }))

  const destinoNaoAtendido = textos.every((o) =>
    /cidade\s+destino\s+n[aã]o\s+atendida/i.test(o.mensagem),
  )
  if (destinoNaoAtendido) {
    return 'A Lopesul não atende o CEP de destino informado. Confira o CEP ou consulte Cidades atendidas.'
  }

  const origemNaoAtendida = textos.every((o) =>
    /cidade\s+origem\s+n[aã]o\s+atendida/i.test(o.mensagem),
  )
  if (origemNaoAtendida) {
    return 'A Lopesul não atende o CEP de origem informado. Confira o CEP de coleta.'
  }

  // Se todas ficaram vazias (objeto sem texto), mensagem genérica
  if (textos.every((o) => !o.mensagem || o.mensagem === 'sem cobertura')) {
    return 'A Lopesul não retornou cotação para esta rota. Verifique CEPs, CNPJ pagador e tente novamente.'
  }

  return textos.map((o) => `${o.nome}: ${o.mensagem}`).join(' | ')
}
