import { useEffect, useRef, useState } from 'react'
import { Mic, Paperclip, Send, Square } from 'lucide-react'
import { ACCEPT_ATENDIMENTO, classificarArquivo, rotuloTipoAnexo, validarArquivo } from '../lib/atendimentoAnexos'

function mimeAudioGravacao() {
  if (typeof MediaRecorder === 'undefined') return ''
  return (
    ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((tipo) =>
      MediaRecorder.isTypeSupported(tipo),
    ) || ''
  )
}

function formatarTempo(segundos) {
  const min = Math.floor(segundos / 60)
  const seg = segundos % 60
  return `${min}:${String(seg).padStart(2, '0')}`
}

function AtendimentoComposer({ onSend, disabled, placeholder }) {
  const [texto, setTexto] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [gravando, setGravando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const inputRef = useRef(null)
  const recRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const manterRef = useRef(false)
  const onSendRef = useRef(onSend)
  onSendRef.current = onSend

  const podeEnviar = Boolean(texto.trim() || arquivo)

  useEffect(() => {
    if (!gravando) return undefined
    const id = setInterval(() => setSegundos((atual) => atual + 1), 1000)
    return () => clearInterval(id)
  }, [gravando])

  useEffect(() => {
    if (gravando && segundos >= 180) encerrarGravacao(true)
  }, [gravando, segundos])

  useEffect(
    () => () => {
      recRef.current?.state === 'recording' && recRef.current.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
    },
    [],
  )

  function escolherArquivo(file) {
    if (!file) return
    try {
      validarArquivo(file)
      setArquivo(file)
      setErro('')
    } catch (error) {
      setArquivo(null)
      setErro(error.message || 'Arquivo não permitido.')
    }
  }

  function limparStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recRef.current = null
  }

  function encerrarGravacao(salvar) {
    manterRef.current = salvar
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.stop()
      return
    }
    limparStream()
    setGravando(false)
    setSegundos(0)
  }

  async function iniciarGravacao() {
    if (disabled || enviando || gravando) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErro('Este navegador não grava áudio. Anexe um arquivo pelo clipe.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = mimeAudioGravacao()
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      rec.onstop = async () => {
        const tipoBruto = rec.mimeType || 'audio/webm'
        const tipo = tipoBruto.split(';')[0].trim() || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: tipo })
        limparStream()
        setGravando(false)
        setSegundos(0)
        if (!manterRef.current) return
        if (blob.size < 400) {
          setErro('Áudio muito curto. Grave de novo.')
          return
        }
        const ext = tipo.includes('mp4') ? 'm4a' : tipo.includes('ogg') ? 'ogg' : 'webm'
        const file = new File([blob], `audio-${Date.now()}.${ext}`, { type })
        setEnviando(true)
        setErro('')
        try {
          await onSendRef.current('', file)
        } catch (error) {
          setErro(error.message || 'Não foi possível enviar o áudio.')
          escolherArquivo(file)
        } finally {
          setEnviando(false)
        }
      }
      streamRef.current = stream
      recRef.current = rec
      rec.start(250)
      setGravando(true)
      setSegundos(0)
      setErro('')
    } catch {
      setErro('Permita o microfone para gravar o áudio.')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!podeEnviar || enviando || disabled || gravando) return
    setEnviando(true)
    setErro('')
    try {
      await onSend(texto.trim(), arquivo)
      setTexto('')
      setArquivo(null)
    } catch (error) {
      setErro(error.message || 'Não foi possível enviar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="atend-composer" onSubmit={handleSubmit}>
      {erro ? (
        <p className="atend-composer-erro" role="alert">
          {erro}
        </p>
      ) : null}
      {arquivo ? (
        <div className="atend-composer-file">
          <span>
            {rotuloTipoAnexo(classificarArquivo(arquivo))} · {arquivo.name}
          </span>
          <button type="button" onClick={() => setArquivo(null)} disabled={enviando || gravando}>
            Remover
          </button>
        </div>
      ) : null}
      <div className="atend-composer-row">
        <input
          ref={inputRef}
          type="file"
          className="visually-hidden"
          accept={ACCEPT_ATENDIMENTO}
          disabled={enviando || disabled || gravando}
          onChange={(event) => {
            escolherArquivo(event.target.files?.[0] || null)
            event.target.value = ''
          }}
        />
        <button
          type="button"
          className="atend-attach"
          disabled={enviando || disabled || gravando}
          aria-label="Anexar arquivo"
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip size={16} strokeWidth={2} />
        </button>
        {gravando ? (
          <div className="atend-rec-field">
            <button type="button" className="atend-rec-cancel" onClick={() => encerrarGravacao(false)}>
              Cancelar
            </button>
            <span>Gravando {formatarTempo(segundos)}</span>
          </div>
        ) : (
          <label className="atend-composer-field">
            <span className="visually-hidden">Mensagem</span>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={placeholder}
              rows={1}
              maxLength={2000}
              disabled={enviando || disabled}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
            />
          </label>
        )}
        {gravando ? (
          <button
            type="button"
            className="atend-send is-rec"
            aria-label="Parar gravação"
            onClick={() => encerrarGravacao(true)}
          >
            <Square size={14} strokeWidth={2.4} />
          </button>
        ) : podeEnviar ? (
          <button type="submit" className="atend-send" disabled={enviando || disabled} aria-label="Enviar mensagem">
            <Send size={16} strokeWidth={2.1} />
          </button>
        ) : (
          <button
            type="button"
            className="atend-send is-mic"
            disabled={enviando || disabled}
            aria-label="Gravar áudio"
            onClick={iniciarGravacao}
          >
            <Mic size={16} strokeWidth={2.1} />
          </button>
        )}
      </div>
    </form>
  )
}

export default AtendimentoComposer
