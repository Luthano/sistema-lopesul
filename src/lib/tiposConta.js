export const TIPOS_CONTA = [
  { id: 'cliente', label: 'Cliente' },
  { id: 'suporte', label: 'Suporte' },
  { id: 'atendimento', label: 'Atendimento' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'comercial', label: 'Comercial' },
  { id: 'agencias', label: 'Agências' },
]

export const TIPOS_EQUIPE = ['suporte', 'atendimento', 'financeiro', 'comercial', 'agencias']

export function labelTipoConta(tipo) {
  return TIPOS_CONTA.find((item) => item.id === tipo)?.label || 'Cliente'
}

export function isEquipeTipo(tipo) {
  return TIPOS_EQUIPE.includes(tipo)
}

export function isPerfilInterno(perfil) {
  const pessoa = Array.isArray(perfil) ? perfil[0] : perfil
  return Boolean(pessoa && (pessoa.role === 'master' || isEquipeTipo(pessoa.tipo_conta)))
}

export function tiposContaDoSetor(setor) {
  if (setor === 'suporte') return ['suporte']
  if (setor === 'administrativo') return ['atendimento']
  if (setor === 'financeiro' || setor === 'comercial' || setor === 'agencias') {
    return [setor]
  }
  return ['suporte']
}

/** null = todos os departamentos na escolha de pessoas. */
export function setoresDaConta() {
  return null
}
