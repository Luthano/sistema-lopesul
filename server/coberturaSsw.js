import { extrairCidadesLopesul, linhasCobertura } from './sswAreas.js'
import { limparCacheCobertura } from './coberturaManual.js'

const LOPESUL_ID = 'lopesul'
const CHUNK = 400

async function upsertEmLotes(client, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const lote = rows.slice(i, i + CHUNK)
    const { error } = await client.from('cobertura_cidades').upsert(lote, {
      onConflict: 'transportadora_id,uf,cidade_norm',
      ignoreDuplicates: false,
    })
    if (error) throw new Error(error.message || 'Falha ao gravar cidades extraídas do SSW.')
  }
}

export async function sincronizarCoberturaSsw(client, { substituir = true } = {}) {
  const extraido = await extrairCidadesLopesul()
  const rows = linhasCobertura(extraido.cidades)

  if (!rows.length) {
    throw new Error('O SSW não retornou cidades atendidas para a Lopesul.')
  }

  if (substituir) {
    const { error } = await client.from('cobertura_cidades').delete().eq('transportadora_id', LOPESUL_ID)
    if (error) throw new Error(error.message || 'Falha ao limpar a cobertura anterior.')
  }

  await upsertEmLotes(client, rows)
  limparCacheCobertura()

  return {
    sucesso: true,
    total: extraido.total,
    porUf: extraido.porUf,
    origens: extraido.origens,
    mensagem: `${extraido.total} cidade(s) da Lopesul sincronizadas a partir do SSW.`,
  }
}
