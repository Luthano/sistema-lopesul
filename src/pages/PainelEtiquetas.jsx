import { useMemo, useRef, useState } from 'react'
import {
  criarEtiquetaVazia,
  formatDoc,
  parseNfeXml,
  volumeLabel,
} from '../lib/nfeXml'
import { baixarTexto, gerarZplEtiqueta, gerarZplLote } from '../lib/etiquetaZpl'
import './PainelEtiquetas.css'

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB',
  'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

function Icon({ name }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (name === 'upload') {
    return (
      <svg {...common}>
        <path d="M12 16V5" />
        <path d="m8 8 4-4 4 4" />
        <path d="M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16" />
      </svg>
    )
  }
  if (name === 'gear') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v2.2M12 18.3V20.5M4.9 7.5l1.9 1.1M17.2 15.4l1.9 1.1M3.5 12h2.2M18.3 12H20.5M4.9 16.5l1.9-1.1M17.2 8.6l1.9-1.1" />
      </svg>
    )
  }
  if (name === 'printer') {
    return (
      <svg {...common}>
        <path d="M7 9V4.5h10V9" />
        <path d="M7 15.5H5.5A1.5 1.5 0 0 1 4 14v-3.5A1.5 1.5 0 0 1 5.5 9h13A1.5 1.5 0 0 1 20 10.5V14a1.5 1.5 0 0 1-1.5 1.5H17" />
        <path d="M7 13.5h10V20H7z" />
      </svg>
    )
  }
  if (name === 'download') {
    return (
      <svg {...common}>
        <path d="M12 4v10" />
        <path d="m8 10 4 4 4-4" />
        <path d="M5 18h14" />
      </svg>
    )
  }
  if (name === 'copy') {
    return (
      <svg {...common}>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M5 14V6a2 2 0 0 1 2-2h8" />
      </svg>
    )
  }
  if (name === 'plus') {
    return (
      <svg {...common}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    )
  }
  if (name === 'trash') {
    return (
      <svg {...common}>
        <path d="M5 7h14" />
        <path d="M9 7V5h6v2" />
        <path d="M7.5 7 8.2 19h7.6L16.5 7" />
      </svg>
    )
  }
  if (name === 'file') {
    return (
      <svg {...common}>
        <path d="M8 4h6l4 4v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
        <path d="M13 4v5h5" />
      </svg>
    )
  }
  if (name === 'tag') {
    return (
      <svg {...common}>
        <path d="M3.5 12.5 12 4h6.5V10.5L10.5 20.5 3.5 12.5Z" />
        <circle cx="15.2" cy="8.8" r="1.2" />
      </svg>
    )
  }
  if (name === 'close') {
    return (
      <svg {...common}>
        <path d="m7 7 10 10M17 7 7 17" />
      </svg>
    )
  }
  return null
}

function PreviewEtiqueta({ etiqueta }) {
  const remNome = etiqueta?.rem?.nome || 'REMETENTE NÃO INFORMADO'
  const remDoc = formatDoc(etiqueta?.rem?.doc) || '00.000.000/0000-00'
  const destNome = etiqueta?.dest?.nome || 'NOME DO DESTINATÁRIO'
  const cidadeUf = [etiqueta?.dest?.cidade || 'Cidade', etiqueta?.dest?.uf || 'UF'].join('-')
  const cep = etiqueta?.dest?.cep || '00000-000'
  const nf = etiqueta?.nroNf || '000000'
  const barcodeHint = (etiqueta?.chaveNfe || etiqueta?.nroNf || '0000000010016').slice(-13)

  return (
    <div className="etq-preview-card" aria-label="Pré-visualização da etiqueta">
      <div className="etq-preview-top">
        <span>REM: {remNome}</span>
        <span>CNPJ: {remDoc}</span>
      </div>
      <div className="etq-preview-mid">
        <div className="etq-preview-dest-block">
          <strong className="etq-preview-dest">{destNome}</strong>
          <p>
            {cidadeUf} · CEP {cep}
          </p>
        </div>
        <div className="etq-preview-vol">
          <span>VOL</span>
          <strong>{volumeLabel(etiqueta || criarEtiquetaVazia())}</strong>
        </div>
      </div>
      <div className="etq-preview-bottom">
        <div className="etq-preview-nf-block">
          <strong className="etq-preview-nf">NF: {nf}</strong>
          <div className="etq-barcode" aria-hidden="true" />
          <small>{barcodeHint}</small>
        </div>
        <div className="etq-qr" aria-hidden="true" />
      </div>
    </div>
  )
}

function Field({ label, value, onChange, className = '', ...props }) {
  const filled = Boolean(String(value ?? '').trim())
  return (
    <label className={`etq-field ${filled ? 'is-filled' : ''} ${className}`}>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  )
}

function ModalEtiqueta({ etiqueta, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => ({
    ...etiqueta,
    rem: { ...etiqueta.rem },
    dest: { ...etiqueta.dest },
  }))

  function updateRem(field, value) {
    setForm((prev) => ({ ...prev, rem: { ...prev.rem, [field]: value } }))
  }

  function updateDest(field, value) {
    setForm((prev) => ({ ...prev, dest: { ...prev.dest, [field]: value } }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSave({
      ...form,
      nroNf: String(form.nroNf || '').trim(),
      volumeAtual: Math.max(1, Number(form.volumeAtual) || 1),
      volumeTotal: Math.max(1, Number(form.volumeTotal) || 1),
    })
  }

  return (
    <div className="etq-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="etq-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="etq-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="etq-modal-head">
          <div>
            <h3 id="etq-modal-title">{etiqueta.origem === 'manual' && !etiqueta.nroNf ? 'Nova etiqueta' : 'Editar etiqueta'}</h3>
            <p>Ajuste os dados desta etiqueta. As alterações valem apenas para ela.</p>
          </div>
          <button type="button" className="etq-icon-btn is-close" aria-label="Fechar" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>

        <form className="etq-modal-grid" onSubmit={handleSubmit}>
          <div className="etq-modal-form">
            <h4>Dados remetente</h4>
            <Field label="Razão Social / Nome" value={form.rem.nome} onChange={(v) => updateRem('nome', v)} />
            <Field label="CPF ou CNPJ" value={form.rem.doc} onChange={(v) => updateRem('doc', v)} inputMode="numeric" />
            <Field label="CEP" value={form.rem.cep} onChange={(v) => updateRem('cep', v)} inputMode="numeric" />
            <div className="etq-row">
              <Field label="Endereço completo" value={form.rem.endereco} onChange={(v) => updateRem('endereco', v)} className="is-grow" />
              <Field label="Nº" value={form.rem.numero} onChange={(v) => updateRem('numero', v)} />
            </div>
            <Field label="Bairro" value={form.rem.bairro} onChange={(v) => updateRem('bairro', v)} />
            <div className="etq-row">
              <Field label="Cidade" value={form.rem.cidade} onChange={(v) => updateRem('cidade', v)} className="is-grow" />
              <label className={`etq-field ${form.rem.uf ? 'is-filled' : ''}`}>
                <span>UF</span>
                <select value={form.rem.uf} onChange={(event) => updateRem('uf', event.target.value)}>
                  <option value="">UF</option>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Field
              label="Sala, Galpão..."
              value={form.rem.complemento}
              onChange={(v) => updateRem('complemento', v)}
            />

            <h4>Dados destinatário</h4>
            <Field label="Razão Social / Nome" value={form.dest.nome} onChange={(v) => updateDest('nome', v)} />
            <Field label="CPF ou CNPJ" value={form.dest.doc} onChange={(v) => updateDest('doc', v)} inputMode="numeric" />
            <div className="etq-row">
              <Field label="Cidade" value={form.dest.cidade} onChange={(v) => updateDest('cidade', v)} className="is-grow" />
              <label className={`etq-field ${form.dest.uf ? 'is-filled' : ''}`}>
                <span>UF</span>
                <select value={form.dest.uf} onChange={(event) => updateDest('uf', event.target.value)}>
                  <option value="">UF</option>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Field label="CEP" value={form.dest.cep} onChange={(v) => updateDest('cep', v)} inputMode="numeric" />
            <div className="etq-row">
              <Field label="Nº da NF" value={form.nroNf} onChange={(v) => setForm((prev) => ({ ...prev, nroNf: v }))} className="is-grow" />
              <Field
                label="Vol."
                value={form.volumeAtual}
                onChange={(v) => setForm((prev) => ({ ...prev, volumeAtual: v }))}
                inputMode="numeric"
              />
              <Field
                label="Total"
                value={form.volumeTotal}
                onChange={(v) => setForm((prev) => ({ ...prev, volumeTotal: v }))}
                inputMode="numeric"
              />
            </div>

            {onDelete ? (
              <button type="button" className="etq-link-danger" onClick={() => onDelete(form.id)}>
                <Icon name="trash" />
                Excluir etiqueta
              </button>
            ) : null}
          </div>

          <aside className="etq-modal-preview">
            <p className="etq-preview-kicker">Pré-visualização</p>
            <PreviewEtiqueta etiqueta={form} />
            <p className="etq-preview-hint">Atualiza enquanto você edita.</p>
            <div className="etq-modal-actions">
              <button type="button" className="etq-btn is-ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="etq-btn is-solid">
                Salvar etiqueta
              </button>
            </div>
          </aside>
        </form>
      </div>
    </div>
  )
}

function PainelEtiquetas() {
  const inputRef = useRef(null)
  const [etiquetas, setEtiquetas] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [previewId, setPreviewId] = useState('')
  const [editing, setEditing] = useState(null)
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)

  const preview = useMemo(
    () => etiquetas.find((item) => item.id === previewId) || etiquetas[0] || criarEtiquetaVazia(),
    [etiquetas, previewId],
  )

  const allSelected = etiquetas.length > 0 && selectedIds.length === etiquetas.length

  function syncSelection(nextList, preferredId) {
    setEtiquetas(nextList)
    setSelectedIds((prev) => prev.filter((id) => nextList.some((item) => item.id === id)))
    if (preferredId) setPreviewId(preferredId)
    else if (!nextList.some((item) => item.id === previewId)) {
      setPreviewId(nextList[0]?.id || '')
    }
  }

  async function importarArquivos(fileList) {
    const files = Array.from(fileList || []).filter((file) => /\.xml$/i.test(file.name) || file.type.includes('xml'))
    if (!files.length) {
      setErro('Selecione arquivos XML da NF-e.')
      return
    }

    setErro('')
    setInfo('')
    const novas = []
    const falhas = []

    for (const file of files) {
      try {
        const text = await file.text()
        novas.push(...parseNfeXml(text, file.name))
      } catch (error) {
        falhas.push(error.message || file.name)
      }
    }

    if (novas.length) {
      const next = [...novas, ...etiquetas]
      syncSelection(next, novas[0].id)
      setSelectedIds(novas.map((item) => item.id))
      setInfo(`${novas.length} etiqueta(s) importada(s) de ${files.length} XML(s).`)
    }
    if (falhas.length) {
      setErro(falhas.join(' '))
    }
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
    setPreviewId(id)
  }

  function toggleSelectAll() {
    if (allSelected) setSelectedIds([])
    else setSelectedIds(etiquetas.map((item) => item.id))
  }

  function alvoImpressao() {
    if (selectedIds.length) return etiquetas.filter((item) => selectedIds.includes(item.id))
    return etiquetas
  }

  function exportarZpl() {
    const alvo = alvoImpressao()
    if (!alvo.length) {
      setErro('Carregue ou selecione etiquetas para exportar.')
      return
    }
    baixarTexto(gerarZplLote(alvo), `etiquetas-lopesul-${Date.now()}.zpl`)
    setInfo(`${alvo.length} etiqueta(s) exportada(s) em .zpl.`)
    setPrintOpen(false)
  }

  async function copiarZpl() {
    const alvo = alvoImpressao()
    if (!alvo.length) {
      setErro('Carregue ou selecione etiquetas para copiar.')
      return
    }
    try {
      await navigator.clipboard.writeText(gerarZplLote(alvo))
      setInfo('ZPL copiado para a área de transferência.')
    } catch {
      setErro('Não foi possível copiar o ZPL neste navegador.')
    }
  }

  function imprimirBrowser() {
    const alvo = alvoImpressao()
    if (!alvo.length) {
      setErro('Carregue ou selecione etiquetas para imprimir.')
      return
    }
    const html = alvo
      .map((item) => {
        const remNome = item.rem?.nome || 'Remetente'
        const remDoc = formatDoc(item.rem?.doc) || '—'
        const destNome = item.dest?.nome || 'Destinatário'
        const cidadeUf = [item.dest?.cidade || 'Cidade', item.dest?.uf || 'UF'].join('-')
        const cep = item.dest?.cep || '00000-000'
        return `<section style="width:100mm;height:50mm;border:1px solid #111;padding:4mm;box-sizing:border-box;page-break-after:always;font-family:Arial,sans-serif">
          <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:3mm">
            <span>REM: ${remNome}</span><span>CNPJ: ${remDoc}</span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:4mm">
            <div>
              <div style="font-size:16px;font-weight:700">${destNome}</div>
              <div style="font-size:11px;margin:2mm 0">${cidadeUf} · CEP ${cep}</div>
              <div style="font-size:18px;font-weight:700">NF: ${item.nroNf || '—'}</div>
            </div>
            <div style="border:1px solid #111;padding:2mm 3mm;text-align:center;min-width:18mm">
              <div style="font-size:10px">VOL</div>
              <div style="font-size:14px;font-weight:700">${volumeLabel(item)}</div>
            </div>
          </div>
        </section>`
      })
      .join('')

    const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700')
    if (!popup) {
      setErro('Permita pop-ups para imprimir as etiquetas.')
      return
    }
    popup.document.write(`<!doctype html><html><head><title>Etiquetas Lopesul</title></head><body onload="window.print()">${html}</body></html>`)
    popup.document.close()
    setPrintOpen(false)
  }

  function salvarEtiqueta(form) {
    const exists = etiquetas.some((item) => item.id === form.id)
    const next = exists
      ? etiquetas.map((item) => (item.id === form.id ? form : item))
      : [form, ...etiquetas]
    syncSelection(next, form.id)
    setSelectedIds((prev) => (prev.includes(form.id) ? prev : [form.id, ...prev]))
    setEditing(null)
    setInfo('Etiqueta salva.')
  }

  function excluirEtiqueta(id) {
    const next = etiquetas.filter((item) => item.id !== id)
    syncSelection(next, next[0]?.id || '')
    setSelectedIds((prev) => prev.filter((item) => item !== id))
    setEditing(null)
  }

  return (
    <div className="painel-section etq-page">
      <header className="painel-section-head etq-page-head">
        <div>
          <h2>Etiquetas de embarque</h2>
          <p>Importe XMLs da NF-e ou crie etiquetas manuais, com preview e exportação ZPL.</p>
        </div>
      </header>

      {erro ? (
        <p className="auth-alert" role="alert">
          {erro}
        </p>
      ) : null}
      {info ? <p className="auth-info">{info}</p> : null}

      <div className="etq-layout">
        <label
          className={`etq-dropzone etq-block ${dragOver ? 'is-over' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragOver(false)
            importarArquivos(event.dataTransfer.files)
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            multiple
            hidden
            onChange={(event) => {
              importarArquivos(event.target.files)
              event.target.value = ''
            }}
          />
          <span className="etq-drop-icon" aria-hidden="true">
            <Icon name="upload" />
          </span>
          <strong>Arraste os XMLs da NF-e aqui ou clique para selecionar</strong>
          <span className="etq-drop-badge">
            <Icon name="file" />
            Suporta múltiplos arquivos
          </span>
        </label>

        <section className="etq-card etq-block etq-actions">
          <button
            type="button"
            className="etq-btn is-ghost"
            onClick={() => setInfo('Use Exportar (.zpl) e envie o arquivo para a impressora térmica configurada no computador.')}
          >
            <Icon name="gear" />
            Configurar Impressora
          </button>

          <div className="etq-print-wrap">
            <button type="button" className="etq-btn is-primary" onClick={() => setPrintOpen((prev) => !prev)}>
              <Icon name="printer" />
              Imprimir
              <span className="etq-caret" aria-hidden="true">
                ▾
              </span>
            </button>
            {printOpen ? (
              <div className="etq-print-menu">
                <button type="button" onClick={imprimirBrowser}>
                  Imprimir no navegador
                </button>
                <button type="button" onClick={exportarZpl}>
                  Gerar arquivo .zpl e imprimir
                </button>
              </div>
            ) : null}
          </div>

          <div className="etq-export-row">
            <button type="button" className="etq-btn is-ghost" onClick={exportarZpl}>
              <Icon name="download" />
              Exportar (.zpl)
            </button>
            <button type="button" className="etq-icon-btn" aria-label="Copiar ZPL" onClick={copiarZpl}>
              <Icon name="copy" />
            </button>
          </div>

          <button
            type="button"
            className="etq-link"
            onClick={() => setEditing(criarEtiquetaVazia({ origem: 'manual' }))}
          >
            <Icon name="plus" />
            Adicionar manual
          </button>

          <button
            type="button"
            className="etq-link-danger"
            disabled={!etiquetas.length}
            onClick={() => {
              syncSelection([], '')
              setSelectedIds([])
              setInfo('Lista de etiquetas limpa.')
            }}
          >
            <Icon name="trash" />
            Limpar tudo
          </button>
        </section>

        <section className="etq-card etq-block etq-list-card">
          <header className="etq-list-head">
            <label className="etq-check">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} disabled={!etiquetas.length} />
              <span>Etiquetas Carregadas</span>
              <em>{etiquetas.length}</em>
            </label>
          </header>

          {etiquetas.length === 0 ? (
            <div className="etq-empty">
              <span className="etq-empty-icon">
                <Icon name="tag" />
              </span>
              <p>Nenhuma etiqueta carregada. Importe um ou mais XMLs da NF-e, ou adicione uma etiqueta manualmente.</p>
            </div>
          ) : (
            <ul className="etq-list">
              {etiquetas.map((item) => (
                <li key={item.id} className={previewId === item.id ? 'is-active' : ''}>
                  <label className="etq-check">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </label>
                  <button type="button" className="etq-list-main" onClick={() => setPreviewId(item.id)}>
                    <strong>
                      NF {item.nroNf || '—'} · Vol {volumeLabel(item)}
                    </strong>
                    <span>
                      {item.dest?.nome || 'Sem destinatário'}
                      {item.origem === 'manual' ? ' · Manual' : item.arquivo ? ` · ${item.arquivo}` : ''}
                    </span>
                  </button>
                  <button type="button" className="etq-btn is-ghost is-small" onClick={() => setEditing(item)}>
                    Editar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="etq-card etq-block etq-preview-panel">
          <p className="etq-preview-kicker">Pré-visualização (10×5 cm)</p>
          <PreviewEtiqueta etiqueta={preview} />
          <p className="etq-preview-hint">
            As informações no preview são atualizadas em tempo real enquanto você digita.
          </p>
        </section>
      </div>

      {editing ? (
        <ModalEtiqueta
          etiqueta={editing}
          onClose={() => setEditing(null)}
          onSave={salvarEtiqueta}
          onDelete={etiquetas.some((item) => item.id === editing.id) ? excluirEtiqueta : null}
        />
      ) : null}
    </div>
  )
}

export default PainelEtiquetas
