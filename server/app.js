import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import { cotar as cotarSimulacao, getMercadorias } from './sswClient.js'
import { rastrearPorDanfe, rastrearPorDocumento } from './sswTracking.js'
import { cotar as cotarOficial, solicitarColeta } from './sswCotacaoColeta.js'
import { buscarCidadesPorNome, listarCidadesPorUf, listarUfsCobertura } from './coberturaManual.js'
import { sincronizarCoberturaSsw } from './coberturaSsw.js'
import {
  exigirMaster,
  podePersistirCotacao,
  salvarColetaHistorico,
  salvarCotacaoHistorico,
} from './supabase.js'
import {
  listActiveCarriers,
  publicCarrierList,
  resolveCnpjPagador,
} from './sswCarriers.js'
import { decodeHtmlEntities, mensagemSemCobertura } from './htmlEntities.js'
import { salvarVeiculoParceiro, atualizarVeiculoParceiro, listarVeiculosParceiros, reivindicarVeiculosPorEmail } from './veiculosParceiros.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const app = express()

app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/transportadoras', (_req, res) => {
  res.json({ transportadoras: publicCarrierList() })
})

app.post('/api/veiculos', async (req, res) => {
  try {
    const result = await salvarVeiculoParceiro(req, req.body || {})
    return res.status(result.sucesso ? 201 : 400).json(result)
  } catch (error) {
    console.error('Erro cadastro veículo:', error)
    return res.status(500).json({
      sucesso: false,
      mensagem: error.message || 'Erro interno ao cadastrar veículo.',
    })
  }
})

app.get('/api/veiculos', async (req, res) => {
  try {
    const result = await listarVeiculosParceiros(req, { status: req.query.status })
    return res.status(result.sucesso ? 200 : 401).json(result)
  } catch (error) {
    console.error('Erro listar veículos:', error)
    return res.status(500).json({
      sucesso: false,
      mensagem: error.message || 'Erro interno ao listar veículos.',
      veiculos: [],
    })
  }
})

app.patch('/api/veiculos/:id', async (req, res) => {
  try {
    const result = await atualizarVeiculoParceiro(req, req.params.id, req.body || {})
    return res.status(result.sucesso ? 200 : 400).json(result)
  } catch (error) {
    console.error('Erro atualizar veículo:', error)
    return res.status(500).json({
      sucesso: false,
      mensagem: error.message || 'Erro interno ao atualizar veículo.',
    })
  }
})

app.post('/api/veiculos/reivindicar', async (req, res) => {
  try {
    const result = await reivindicarVeiculosPorEmail(req)
    return res.status(result.sucesso ? 200 : 401).json(result)
  } catch (error) {
    console.error('Erro reivindicar veículos:', error)
    return res.status(500).json({
      sucesso: false,
      mensagem: error.message || 'Erro interno ao vincular veículos.',
      vinculados: 0,
    })
  }
})

app.get('/api/mercadorias', async (req, res) => {
  try {
    const { cnpjPagador, transportadoraId } = req.query
    if (!cnpjPagador) {
      return res.status(400).json({ erro: -1, mensagem: 'Informe o CNPJ do pagador', mercadorias: [] })
    }

    const result = await getMercadorias(cnpjPagador, transportadoraId || undefined)
    if (result.erro && result.erro < 0) {
      return res.status(400).json(result)
    }
    return res.json(result)
  } catch (error) {
    console.error('Erro getMercadorias:', error)
    return res.status(500).json({
      erro: -2,
      mensagem: error.message || 'Erro interno ao buscar mercadorias',
      mercadorias: [],
    })
  }
})

app.post('/api/cidades/sincronizar-ssw', async (req, res) => {
  try {
    const auth = await exigirMaster(req)
    if (!auth.ok) {
      return res.status(auth.status).json({ sucesso: false, mensagem: auth.mensagem })
    }

    const substituir = req.body?.substituir !== false
    const result = await sincronizarCoberturaSsw(auth.client, { substituir })
    return res.json(result)
  } catch (error) {
    console.error('Erro sincronizar SSW:', error)
    return res.status(500).json({
      sucesso: false,
      mensagem: error.message || 'Erro ao sincronizar cidades do SSW.',
    })
  }
})

app.get('/api/cidades', async (req, res) => {
  try {
    const uf = String(req.query.uf || '').trim()
    const cidade = String(req.query.cidade || '').trim()
    const listarUfs = String(req.query.meta || '') === 'ufs'

    if (listarUfs) {
      const result = await listarUfsCobertura()
      return res.json(result)
    }

    if (uf) {
      const result = await listarCidadesPorUf(uf)
      return res.json(result)
    }

    if (cidade) {
      const result = await buscarCidadesPorNome(cidade)
      return res.json(result)
    }

    return res.status(400).json({
      sucesso: false,
      mensagem: 'Informe a UF ou o nome da cidade.',
      cidades: [],
    })
  } catch (error) {
    console.error('Erro cidades:', error)
    return res.status(500).json({
      sucesso: false,
      mensagem: error.message || 'Erro interno ao consultar cidades atendidas',
      cidades: [],
    })
  }
})

app.post('/api/rastreio', async (req, res) => {
  try {
    const body = req.body || {}
    const modo = body.modo === 'documento' ? 'documento' : 'danfe'

    const result = modo === 'documento'
      ? await rastrearPorDocumento({
          documento: body.documento,
          nroNf: body.nroNf,
          senha: body.senha,
        })
      : await rastrearPorDanfe(body.chaveDanfe)

    return res.status(result.sucesso ? 200 : 404).json(result)
  } catch (error) {
    console.error('Erro rastreio:', error)
    return res.status(500).json({
      sucesso: false,
      mensagem: error.message || 'Erro interno ao rastrear encomenda',
      documentos: [],
    })
  }
})

app.post('/api/coleta', async (req, res) => {
  try {
    const podeColetar = await podePersistirCotacao(req)
    if (!podeColetar) {
      return res.status(401).json({
        sucesso: false,
        mensagem: 'Entre com uma conta aprovada para solicitar coleta.',
        numeroColeta: '',
      })
    }

    const body = req.body || {}
    const required = ['solicitante', 'limiteColeta', 'cotacao', 'token']
    const missing = required.filter((field) => !body[field] && body[field] !== 0)

    if (missing.length > 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Campos obrigatórios ausentes: ${missing.join(', ')}`,
        numeroColeta: '',
      })
    }

    if (!body.transportadoraId) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Informe a transportadora da cotação escolhida (transportadoraId).',
        numeroColeta: '',
      })
    }

    const result = await solicitarColeta(body)
    if (result.sucesso) {
      await salvarColetaHistorico(req, body, result)
    }
    return res.status(result.sucesso ? 200 : 400).json(result)
  } catch (error) {
    console.error('Erro coleta:', error)
    return res.status(500).json({
      sucesso: false,
      mensagem: error.message || 'Erro interno ao solicitar coleta',
      numeroColeta: '',
    })
  }
})

app.post('/api/cotacao', async (req, res) => {
  try {
    const body = req.body || {}
    const required = ['cnpjPagador', 'cepOrigem', 'cepDestino', 'valorNF', 'quantidade']
    const missing = required.filter((field) => !body[field] && body[field] !== 0)

    if (missing.length > 0) {
      return res.status(400).json({
        erro: -1,
        mensagem: `Campos obrigatórios ausentes: ${missing.join(', ')}`,
        sucesso: false,
        ofertas: [],
      })
    }

    const carriers = listActiveCarriers()
    if (carriers.length === 0) {
      return res.status(500).json({
        erro: -2,
        mensagem: 'Credenciais SSW da Lopesul não configuradas no servidor.',
        sucesso: false,
        ofertas: [],
      })
    }

    const persistir = await podePersistirCotacao(req)
    const cotarFn = persistir ? cotarOficial : cotarSimulacao

    const ofertas = await Promise.all(
      carriers.map(async (carrier) => {
        const cnpjPagador = resolveCnpjPagador(carrier.id, body)
        const payload = { ...body, cnpjPagador }

        try {
          if (!cnpjPagador) {
            return {
              transportadoraId: carrier.id,
              nome: carrier.nome,
              dominio: carrier.dominio,
              sucesso: false,
              erro: -1,
              mensagem: 'CNPJ/CPF pagador não informado para esta transportadora.',
            }
          }

          const result = await cotarFn(payload, carrier.credentials)
          // Montagem explícita: não espalhar o retorno do SSW (evita sobrescrever id/nome)
          const oferta = {
            transportadoraId: carrier.id,
            nome: carrier.nome,
            dominio: carrier.dominio,
            cnpjPagador,
            sucesso: Boolean(result.sucesso),
            erro: result.erro,
            mensagem: decodeHtmlEntities(result.mensagem || ''),
            alerta: Boolean(result.alerta),
            totalFrete: result.totalFrete,
            prazo: result.prazo,
            enviado: result.enviado,
            detalhamento: result.detalhamento,
            simulacao: !persistir,
            numeroCotacao: persistir ? result.numeroCotacao || '' : '',
            token: persistir ? result.token : undefined,
          }

          if (persistir && oferta.sucesso) {
            await salvarCotacaoHistorico(req, { ...payload, transportadoraId: carrier.id }, oferta)
          }

          console.info(
            `[cotacao] ${carrier.nome} (${carrier.dominio})`,
            JSON.stringify({
              sucesso: oferta.sucesso,
              erro: oferta.erro,
              mensagem: oferta.mensagem,
              totalFrete: oferta.totalFrete,
              numeroCotacao: oferta.numeroCotacao || null,
            }),
          )

          return oferta
        } catch (error) {
          console.error(`Erro cotar ${carrier.id}:`, error)
          return {
            transportadoraId: carrier.id,
            nome: carrier.nome,
            dominio: carrier.dominio,
            cnpjPagador,
            sucesso: false,
            erro: -2,
            mensagem: decodeHtmlEntities(error.message) || 'Erro ao cotar nesta transportadora',
          }
        }
      }),
    )

    const ok = ofertas.filter((o) => o.sucesso)
    ok.sort((a, b) => {
      const fa = Number(a.totalFrete)
      const fb = Number(b.totalFrete)
      if (Number.isFinite(fa) && Number.isFinite(fb)) return fa - fb
      return 0
    })
    const fail = ofertas.filter((o) => !o.sucesso)
    const ofertasOrdenadas = [...ok, ...fail]

    const sucesso = ok.length > 0
    const melhor = ok[0] || null

    return res.status(sucesso ? 200 : 400).json({
      sucesso,
      simulacao: !persistir,
      transportadoras: publicCarrierList(),
      mensagem: sucesso
        ? ok.length === 1
          ? `Cotação disponível em ${ok[0].nome}.`
          : `${ok.length} ofertas encontradas.`
        : mensagemSemCobertura(ofertasOrdenadas),
      ofertas: ofertasOrdenadas,
      ...(melhor
        ? {
            erro: melhor.erro,
            alerta: melhor.alerta,
            totalFrete: melhor.totalFrete,
            prazo: melhor.prazo,
            numeroCotacao: melhor.numeroCotacao,
            token: melhor.token,
            enviado: melhor.enviado,
            detalhamento: melhor.detalhamento,
            transportadoraId: melhor.transportadoraId,
            nomeTransportadora: melhor.nome,
          }
        : { erro: -1 }),
    })
  } catch (error) {
    console.error('Erro cotar:', error)
    return res.status(500).json({
      erro: -2,
      mensagem: error.message || 'Erro interno ao cotar frete',
      sucesso: false,
      ofertas: [],
    })
  }
})

export default app
