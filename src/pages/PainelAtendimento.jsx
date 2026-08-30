import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buscarConversaCliente,
  enviarMensagem,
  formatarHoraMensagem,
  garantirConversaCliente,
  labelSetor,
  listarConversasCliente,
  listarConversasMaster,
  listarMensagens,
  marcarLida,
  SETORES_ATENDIMENTO,
} from '../lib/atendimento'
import { supabase } from '../lib/supabase'
import './PainelAtendimento.css'

function iniciais(nome) {
  const partes = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!partes.length) return 'L'
  return ((partes[0][0] || '') + (partes[1]?.[0] || '')).toUpperCase()
}

function Avatar({ nome }) {
  return (
    <span className="atend-avatar" aria-hidden="true">
      {iniciais(nome)}
    </span>
  )
}

function BotoesSetor({ ativo, onEscolher, naoLidas = {} }) {
  return (
    <div className="atend-setores" role="tablist" aria-label="Setor de atendimento">
      {SETORES_ATENDIMENTO.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={ativo === item.id}
          className={ativo === item.id ? 'is-active' : ''}
          onClick={() => onEscolher(ativo === item.id ? '' : item.id)}
        >
          {item.label}
          {naoLidas[item.id] > 0 ? <span>{naoLidas[item.id]}</span> : null}
        </button>
      ))}
    </div>
  )
}

function ChatThread({ mensagens, userId, vazio }) {
  const fimRef = useRef(null)

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'end' })
  }, [mensagens.length])

  if (!mensagens.length) {
    return <p className="atend-vazio">{vazio}</p>
  }

  return (
    <ul className="atend-msgs">
      {mensagens.map((item) => {
        const propria = item.autor_id === userId
        return (
          <li key={item.id} className={propria ? 'is-own' : 'is-other'}>
            <p>{item.corpo}</p>
            <time dateTime={item.created_at}>{formatarHoraMensagem(item.created_at)}</time>
          </li>
        )
      })}
      <li ref={fimRef} className="atend-msgs-end" aria-hidden="true" />
    </ul>
  )
}

function ChatComposer({ onSend, disabled, placeholder }) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const corpo = texto.trim()
    if (!corpo || enviando || disabled) return
    setEnviando(true)
    try {
      await onSend(corpo)
      setTexto('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="atend-composer" onSubmit={handleSubmit}>
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
      <button
        type="submit"
        className="atend-send"
        disabled={enviando || disabled || !texto.trim()}
        aria-label={enviando ? 'Enviando' : 'Enviar mensagem'}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.4 11.2 20 4.5 12.8 21l-1.8-6.6-6.2-1.8 6.2-1.4 4.4-6.2-7.8 4.6Z" />
        </svg>
      </button>
    </form>
  )
}

function useMensagens(conversaId) {
  const [mensagens, setMensagens] = useState([])
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!conversaId) {
      setMensagens([])
      return
    }
    const lista = await listarMensagens(conversaId)
    setMensagens(lista)
  }, [conversaId])

  useEffect(() => {
    let active = true
    setErro('')
    if (!conversaId) {
      setMensagens([])
      return undefined
    }

    carregar().catch((error) => {
      if (active) setErro(error.message || 'Não foi possível carregar as mensagens.')
    })

    const channel = supabase
      .channel(`atend-msgs-${conversaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'atendimento_mensagens',
          filter: `conversa_id=eq.${conversaId}`,
        },
        (payload) => {
          const nova = payload.new
          if (!nova?.id) return
          setMensagens((prev) => (prev.some((item) => item.id === nova.id) ? prev : [...prev, nova]))
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [conversaId, carregar])

  return { mensagens, setMensagens, erro, setErro, carregar }
}

function ChatCliente({ user, setor }) {
  const [conversa, setConversa] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const { mensagens, setMensagens, erro: erroMsgs } = useMensagens(conversa?.id)

  useEffect(() => {
    if (!setor) {
      setConversa(null)
      setCarregando(false)
      return undefined
    }

    let active = true
    setCarregando(true)
    setErro('')
    buscarConversaCliente(user.id, setor)
      .then(async (atual) => {
        if (!active) return
        setConversa(atual)
        if (atual?.nao_lidas_cliente) await marcarLida(atual.id, false)
      })
      .catch((error) => {
        if (active) setErro(error.message || 'Não foi possível abrir o atendimento.')
      })
      .finally(() => {
        if (active) setCarregando(false)
      })
    return () => {
      active = false
    }
  }, [user.id, setor])

  useEffect(() => {
    if (!conversa?.id || !mensagens.length) return undefined
    marcarLida(conversa.id, false).catch(() => {})
    return undefined
  }, [conversa?.id, mensagens.length])

  async function handleSend(corpo) {
    if (!setor) return
    setErro('')
    const atual = conversa || (await garantirConversaCliente(user.id, setor))
    if (!conversa) setConversa(atual)
    const salva = await enviarMensagem({
      conversaId: atual.id,
      autorId: user.id,
      papel: 'cliente',
      corpo,
    })
    setMensagens((prev) => (prev.some((item) => item.id === salva.id) ? prev : [...prev, salva]))
  }

  return (
    <section className="atend-chat">
      <header className="atend-chat-head">
        <Avatar nome={setor ? labelSetor(setor) : 'Lopesul'} />
        <div>
          <h2>{setor ? labelSetor(setor) : 'Lopesul'}</h2>
          <p>{setor ? 'Online · responda quando quiser' : 'Escolha um setor para começar'}</p>
        </div>
      </header>
      {(erro || erroMsgs) && (
        <p className="auth-alert" role="alert">
          {erro || erroMsgs}
        </p>
      )}
      <div className="atend-chat-body">
        {!setor ? (
          <p className="atend-vazio">Selecione Financeiro, Agências ou Administrativo.</p>
        ) : carregando ? (
          <p className="atend-vazio">Carregando conversa…</p>
        ) : (
          <ChatThread
            mensagens={mensagens}
            userId={user.id}
            vazio={`Envie uma mensagem para o setor ${labelSetor(setor)}.`}
          />
        )}
      </div>
      <ChatComposer
        onSend={handleSend}
        disabled={!setor || carregando}
        placeholder={setor ? `Escreva para ${labelSetor(setor)}` : 'Escolha um setor para escrever'}
      />
    </section>
  )
}

function perfilConversa(item) {
  const perfil = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
  return perfil || {}
}

function nomeCliente(item) {
  const perfil = perfilConversa(item)
  return perfil.nome_completo || perfil.email || 'Cliente'
}

function ChatMaster({ user, setor, onSetor }) {
  const [conversas, setConversas] = useState([])
  const [selecionadaId, setSelecionadaId] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const { mensagens, setMensagens, erro: erroMsgs } = useMensagens(selecionadaId)
  const fila = setor ? conversas.filter((item) => item.setor === setor) : conversas
  const selecionada = conversas.find((item) => item.id === selecionadaId) || null

  const carregarFila = useCallback(async () => {
    const lista = await listarConversasMaster()
    setConversas(lista)
  }, [])

  useEffect(() => {
    let active = true
    setCarregando(true)
    carregarFila()
      .catch((error) => {
        if (active) setErro(error.message || 'Não foi possível carregar as conversas.')
      })
      .finally(() => {
        if (active) setCarregando(false)
      })

    const channel = supabase
      .channel('atend-fila-master')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'atendimento_conversas' },
        () => {
          carregarFila().catch(() => {})
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [carregarFila])

  useEffect(() => {
    if (!selecionadaId) return undefined
    marcarLida(selecionadaId, true).catch(() => {})
    return undefined
  }, [selecionadaId, mensagens.length])

  async function handleSend(corpo) {
    if (!selecionadaId) return
    setErro('')
    const salva = await enviarMensagem({
      conversaId: selecionadaId,
      autorId: user.id,
      papel: 'atendente',
      corpo,
    })
    setMensagens((prev) => (prev.some((item) => item.id === salva.id) ? prev : [...prev, salva]))
  }

  return (
    <section className="atend-master">
      <aside className="atend-fila">
        {erro && (
          <p className="auth-alert" role="alert">
            {erro}
          </p>
        )}
        {carregando ? (
          <p className="atend-vazio">Buscando fila…</p>
        ) : fila.length === 0 ? (
          <p className="atend-vazio">
            {setor ? `Nenhuma conversa em ${labelSetor(setor)}.` : 'Nenhuma conversa ainda.'}
          </p>
        ) : (
          <ul className="atend-fila-lista">
            {fila.map((item) => {
              const nome = nomeCliente(item)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.id === selecionadaId ? 'is-active' : ''}
                    onClick={() => {
                      setSelecionadaId(item.id)
                      onSetor?.(item.setor)
                    }}
                  >
                    <Avatar nome={nome} />
                    <span className="atend-fila-copy">
                      <strong>
                        {nome}
                        <time>{formatarHoraMensagem(item.ultima_mensagem_at)}</time>
                      </strong>
                      <small>
                        {labelSetor(item.setor)}
                        {item.preview ? ` · ${item.preview}` : ''}
                      </small>
                    </span>
                    {item.nao_lidas_master > 0 ? <span className="atend-unread">{item.nao_lidas_master}</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      <div className="atend-chat">
        {selecionada ? (
          <>
            <header className="atend-chat-head">
              <Avatar nome={nomeCliente(selecionada)} />
              <div>
                <h2>{nomeCliente(selecionada)}</h2>
                <p>
                  {labelSetor(selecionada.setor)}
                  {perfilConversa(selecionada).email ? ` · ${perfilConversa(selecionada).email}` : ''}
                </p>
              </div>
            </header>
            {erroMsgs && (
              <p className="auth-alert" role="alert">
                {erroMsgs}
              </p>
            )}
            <div className="atend-chat-body">
              <ChatThread
                mensagens={mensagens}
                userId={user.id}
                vazio="Aguardando a primeira mensagem deste cliente."
              />
            </div>
            <ChatComposer onSend={handleSend} placeholder="Responder ao cliente" />
          </>
        ) : (
          <div className="atend-vazio-painel">
            <Avatar nome="Lopesul" />
            <p>Selecione uma conversa à esquerda para responder.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function PainelAtendimento({ isMaster, user }) {
  const [setor, setSetor] = useState('')
  const [naoLidas, setNaoLidas] = useState({})

  const atualizarNaoLidas = useCallback(async () => {
    if (isMaster) {
      const lista = await listarConversasMaster()
      const mapa = {}
      for (const item of lista) {
        mapa[item.setor] = (mapa[item.setor] || 0) + (item.nao_lidas_master || 0)
      }
      setNaoLidas(mapa)
      return
    }
    const lista = await listarConversasCliente(user.id)
    const mapa = {}
    for (const item of lista) {
      mapa[item.setor] = item.nao_lidas_cliente || 0
    }
    setNaoLidas(mapa)
  }, [isMaster, user.id])

  useEffect(() => {
    atualizarNaoLidas().catch(() => {})
    const channel = supabase
      .channel(`atend-setores-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'atendimento_conversas' },
        () => {
          atualizarNaoLidas().catch(() => {})
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [atualizarNaoLidas, user.id])

  return (
    <div className="painel-section atend-page">
      <div className="atend-app">
        <BotoesSetor ativo={setor} onEscolher={setSetor} naoLidas={naoLidas} />
        {isMaster ? (
          <ChatMaster user={user} setor={setor} onSetor={setSetor} />
        ) : (
          <ChatCliente user={user} setor={setor} />
        )}
      </div>
    </div>
  )
}

export default PainelAtendimento
