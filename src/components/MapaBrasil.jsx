import { useEffect, useRef } from 'react'
import mapaSvg from '../assets/mapa-brasil.svg?raw'
import { UF_MAPA_HREF } from '../lib/ufsAtendidas'
import './MapaBrasil.css'

const COR_SELECIONADO = '#48d5ff'
const COR_CIRCLE_SELECIONADO = '#48d5ff'

function aplicarSelecao(root, selectedUf) {
  if (!root) return

  const selected = String(selectedUf || '').toUpperCase()

  root.querySelectorAll('a[href^="#"]').forEach((link) => {
    const slug = link.getAttribute('href')?.replace(/^#/, '')
    const uf = UF_MAPA_HREF[slug]
    const isSelected = Boolean(uf && uf === selected)

    link.classList.toggle('is-selected', isSelected)

    link.querySelectorAll('path').forEach((path) => {
      const cor = path.classList.contains('circle')
        ? isSelected
          ? COR_CIRCLE_SELECIONADO
          : ''
        : isSelected
          ? COR_SELECIONADO
          : ''

      if (cor) {
        path.style.setProperty('fill', cor, 'important')
      } else {
        path.style.removeProperty('fill')
      }
    })
  })
}

function MapaBrasil({ onSelectUf, selectedUf = '' }) {
  const ref = useRef(null)
  const onSelectUfRef = useRef(onSelectUf)
  const selectedUfRef = useRef(selectedUf)

  useEffect(() => {
    onSelectUfRef.current = onSelectUf
  }, [onSelectUf])

  useEffect(() => {
    selectedUfRef.current = selectedUf
    aplicarSelecao(ref.current, selectedUf)
  }, [selectedUf])

  useEffect(() => {
    const root = ref.current
    if (!root) return undefined

    root.innerHTML = mapaSvg

    function onClick(event) {
      const link = event.target.closest('a')
      if (!link) return

      event.preventDefault()
      const slug = link.getAttribute('href')?.replace(/^#/, '')
      const uf = UF_MAPA_HREF[slug]
      if (uf) onSelectUfRef.current?.(uf)
    }

    root.addEventListener('click', onClick)
    aplicarSelecao(root, selectedUfRef.current)

    return () => {
      root.removeEventListener('click', onClick)
    }
  }, [])

  return (
    <div
      className="mapa-brasil"
      data-selected={String(selectedUf || '').toUpperCase()}
      ref={ref}
      aria-label="Mapa do Brasil — clique em um estado para consultar as cidades"
      role="img"
    />
  )
}

export default MapaBrasil
