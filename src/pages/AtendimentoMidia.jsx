import { useEffect, useState } from 'react'
import { rotuloTipoAnexo, urlAssinadaAnexo } from '../lib/atendimentoAnexos'

function formatarTamanho(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function AtendimentoMidia({ item }) {
  const [url, setUrl] = useState('')
  const [erro, setErro] = useState('')
  const tipo = item.tipo || 'texto'
  const path = item.arquivo_path

  useEffect(() => {
    let active = true
    if (!path) {
      setUrl('')
      return undefined
    }
    setErro('')
    urlAssinadaAnexo(path)
      .then((assinada) => {
        if (active) setUrl(assinada)
      })
      .catch(() => {
        if (active) setErro('Não foi possível abrir o arquivo.')
      })
    return () => {
      active = false
    }
  }, [path])

  if (!path || tipo === 'texto') return null

  const nome = item.arquivo_nome || rotuloTipoAnexo(tipo)

  if (erro) return <p className="atend-midia-erro">{erro}</p>
  if (!url) return <p className="atend-midia-wait">Carregando arquivo…</p>

  if (tipo === 'imagem') {
    return (
      <a className="atend-midia-img" href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={nome} />
      </a>
    )
  }

  const ehAudio = tipo === 'audio' || String(item.arquivo_mime || '').startsWith('audio/')

  if (ehAudio) {
    return (
      <div className="atend-midia-audio-wrap">
        <audio className="atend-midia-audio" controls src={url} preload="metadata">
          Seu navegador não reproduz este áudio.
        </audio>
        <a href={url} target="_blank" rel="noreferrer">
          Ouvir / baixar
        </a>
      </div>
    )
  }

  if (tipo === 'video') {
    return (
      <video className="atend-midia-video" controls src={url} preload="metadata">
        <a href={url} target="_blank" rel="noreferrer">
          Abrir vídeo
        </a>
      </video>
    )
  }

  return (
    <a className="atend-midia-doc" href={url} target="_blank" rel="noreferrer">
      <strong>{nome}</strong>
      <span>
        {rotuloTipoAnexo(tipo)}
        {item.arquivo_tamanho ? ` · ${formatarTamanho(item.arquivo_tamanho)}` : ''}
      </span>
    </a>
  )
}

export default AtendimentoMidia
