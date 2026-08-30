/** Dimensões em cm → cubagem em m³ por unidade */
export function cubagemUnidadeM3(alturaCm, larguraCm, comprimentoCm) {
  const a = Number(alturaCm) || 0
  const l = Number(larguraCm) || 0
  const c = Number(comprimentoCm) || 0
  if (!a || !l || !c) return 0
  return (a * l * c) / 1_000_000
}

export function criarVolumeVazio() {
  return {
    id: crypto.randomUUID(),
    quantidade: '1',
    peso: '',
    altura: '',
    largura: '',
    comprimento: '',
  }
}

export function agregarVolumes(volumes) {
  let quantidade = 0
  let peso = 0
  let volume = 0

  for (const item of volumes) {
    const qtd = Math.max(0, Number(item.quantidade) || 0)
    const pesoUn = Number(item.peso) || 0
    const cubUn = cubagemUnidadeM3(item.altura, item.largura, item.comprimento)

    quantidade += qtd
    peso += pesoUn * qtd
    volume += cubUn * qtd
  }

  return {
    quantidade,
    peso: Number(peso.toFixed(3)),
    volume: Number(volume.toFixed(4)),
  }
}

export function volumeLinhaValido(item) {
  return (Number(item.quantidade) || 0) > 0
}

/** Sem A×L×C o SSW calcula pelo valor da NF (peso continua opcional). */
export function temCubagem(volumes) {
  return volumes.some((item) => cubagemUnidadeM3(item.altura, item.largura, item.comprimento) > 0)
}
