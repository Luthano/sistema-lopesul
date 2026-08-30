export const TIPOS_CONTA = [
  { id: 'cliente', label: 'Cliente' },
  { id: 'atendimento', label: 'Atendimento' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'comercial', label: 'Comercial' },
  { id: 'agencias', label: 'Agências' },
]

export const TIPOS_EQUIPE = ['atendimento', 'financeiro', 'comercial', 'agencias']

export function labelTipoConta(tipo) {
  return TIPOS_CONTA.find((item) => item.id === tipo)?.label || 'Cliente'
}

export function isEquipeTipo(tipo) {
  return TIPOS_EQUIPE.includes(tipo)
}

/** null = todos os setores; [] = nenhum (cliente). */
export function setoresDaConta(tipo, isMaster) {
  if (isMaster || tipo === 'atendimento') return null
  if (tipo === 'financeiro') return ['financeiro']
  if (tipo === 'comercial') return ['comercial']
  if (tipo === 'agencias') return ['agencias']
  return []
}
