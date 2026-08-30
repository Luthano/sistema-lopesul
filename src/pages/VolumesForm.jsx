function VolumesForm({ volumes, onChange, totais }) {
  function updateVolume(id, field, value) {
    onChange(volumes.map((v) => (v.id === id ? { ...v, [field]: value } : v)))
  }

  function removeVolume(id) {
    if (volumes.length <= 1) return
    onChange(volumes.filter((v) => v.id !== id))
  }

  function addVolume() {
    onChange([
      ...volumes,
      {
        id: crypto.randomUUID(),
        quantidade: '1',
        peso: '',
        altura: '',
        largura: '',
        comprimento: '',
      },
    ])
  }

  return (
    <section className="form-section">
      <div className="section-heading">
        <span className="section-step">4</span>
        <div>
          <h2>Volumes da carga</h2>
        </div>
      </div>

      <div className="volumes-list">
        {volumes.map((item, index) => (
            <article className="volume-card" key={item.id}>
              <div className="volume-card-head">
                <span className="volume-badge">Volume {index + 1}</span>
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => removeVolume(item.id)}
                  disabled={volumes.length <= 1}
                >
                  Remover
                </button>
              </div>

              <div className="volume-grid">
                <label className="field">
                  <span>Quantidade</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={item.quantidade}
                    onChange={(e) => updateVolume(item.id, 'quantidade', e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Peso unitário (kg)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="0,000"
                    value={item.peso}
                    onChange={(e) => updateVolume(item.id, 'peso', e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Altura (cm)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0"
                    value={item.altura}
                    onChange={(e) => updateVolume(item.id, 'altura', e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Largura (cm)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0"
                    value={item.largura}
                    onChange={(e) => updateVolume(item.id, 'largura', e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Comprimento (cm)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0"
                    value={item.comprimento}
                    onChange={(e) => updateVolume(item.id, 'comprimento', e.target.value)}
                  />
                </label>
              </div>

            </article>
        ))}
      </div>

      <button type="button" className="btn-ghost" onClick={addVolume}>
        + Adicionar volume
      </button>

      <div className="volumes-summary">
        <div>
          <small>Volumes</small>
          <strong>{totais.quantidade}</strong>
        </div>
        <div>
          <small>Peso total</small>
          <strong>{totais.peso} kg</strong>
        </div>
        <div>
          <small>Cubagem total</small>
          <strong>{totais.volume} m³</strong>
        </div>
      </div>
    </section>
  )
}

export default VolumesForm
