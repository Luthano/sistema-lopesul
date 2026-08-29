import { Link } from 'react-router-dom'
import Reveal from '../components/Reveal'
import { BRAND, mailtoComercial, mailtoOperacional } from '../lib/brand'
import './Home.css'
import './HomeAnimations.css'
import './HubLogistico.css'

const STATS = [
  { value: '900+', label: 'cidades atendidas na malha Lopesul' },
  { value: '12', label: 'estados + DF com cobertura ativa' },
  { value: 'D+1', label: 'prazos ágeis em rotas estratégicas' },
  { value: '3', label: 'redes parceiras integradas à operação' },
]

const PILARES = [
  {
    title: 'Rastreamento em tempo real',
    text: 'Acompanhe a carga do pedido à entrega, com eventos claros e previsibilidade operacional.',
    icon: '/home/entrega.svg',
  },
  {
    title: 'Cotação e coleta no mesmo fluxo',
    text: 'Simule frete, compare ofertas e solicite coleta sem sair da plataforma Lopesul.',
    icon: '/home/eficiencia.svg',
  },
  {
    title: 'Cobertura nacional conectada',
    text: 'Alcance ampliado com a Lopesul e a Envia Rápido — rota direta ou redespacho.',
    icon: '/home/caminhao.svg',
  },
  {
    title: 'Previsibilidade de operação',
    text: 'Rotas, prazos e parceiros alinhados para reduzir incerteza na logística fracionada.',
    icon: '/home/foguete.svg',
  },
]

const PASSOS = [
  {
    step: '01',
    title: 'Integração',
    text: 'Acesse a plataforma Lopesul, cadastre sua conta e libere cotação, rastreio e cobertura.',
  },
  {
    step: '02',
    title: 'Cotação inteligente',
    text: 'Informe origem, destino e volumes. Receba ofertas das transportadoras da malha.',
  },
  {
    step: '03',
    title: 'Coleta programada',
    text: 'Com a cotação aprovada, solicite coleta com documentação e prazo definidos.',
  },
  {
    step: '04',
    title: 'Transporte rastreado',
    text: 'Sua carga segue na malha com acompanhamento e confirmação dos eventos.',
  },
  {
    step: '05',
    title: 'Entrega previsível',
    text: 'Recebimento no destino com prazo alinhado à operação e suporte Lopesul.',
  },
]

const BENEFICIOS = [
  {
    title: 'Malha pronta',
    text: 'Rede de rotas e parceiros já em operação, sem reinventar a logística do zero.',
  },
  {
    title: 'Menos atrito',
    text: 'Cotação, coleta e rastreio no mesmo ambiente — menos ferramentas, mais controle.',
  },
  {
    title: 'Parcerias que escalam',
    text: 'Conexão com transportadoras estratégicas para ampliar alcance e competitividade.',
  },
  {
    title: 'Operação que faz acontecer',
    text: 'Foco em agilidade B2B, com atendimento próximo e visão de negócio.',
  },
]

const PUBLICOS = [
  {
    title: 'Indústria e distribuição',
    text: 'Envios fracionados recorrentes entre filiais, CD e clientes B2B com prazo previsível.',
  },
  {
    title: 'E-commerce e marketplace',
    text: 'Operação omnichannel com cotação rápida, rastreio e cobertura em múltiplos estados.',
  },
  {
    title: 'Atacado e varejo',
    text: 'Reposição de lojas e transferências interestaduais com menos atrito operacional.',
  },
  {
    title: 'Embarcadores em crescimento',
    text: 'Empresas que precisam escalar volume sem montar uma operação logística do zero.',
  },
]

const MODULOS = [
  {
    title: 'Cotação multi-carrier',
    text: 'Compare ofertas da Lopesul e parceiros em uma única consulta, com frete e prazo claros.',
    to: '/cotacao',
    cta: 'Abrir cotação',
  },
  {
    title: 'Rastreamento',
    text: 'Consulte por DANFE ou NF + documento e acompanhe eventos da encomenda.',
    to: '/rastrear',
    cta: 'Rastrear agora',
  },
  {
    title: 'Cidades atendidas',
    text: 'Valide origem e destino, rota direta ou redespacho, antes de embarcar a carga.',
    to: '/cidades-atendidas',
    cta: 'Consultar cobertura',
  },
  {
    title: 'Parceiros de frota',
    text: 'Cadastre veículos e faça parte da rede que move a operação Lopesul.',
    to: '/cadastrar-veiculo',
    cta: 'Cadastrar veículo',
  },
]

const IMPACTOS = [
  { value: '1 plataforma', label: 'para cotar, coletar e rastrear' },
  { value: 'Menos retrabalho', label: 'entre comercial, operação e cliente' },
  { value: 'Mais visibilidade', label: 'em cada etapa do embarque' },
]

const DEPOIMENTOS = [
  {
    quote:
      'Centralizar cotação e rastreio na Lopesul reduziu o tempo de resposta do nosso time comercial.',
    author: 'Operação B2B',
    role: 'Distribuição interestadual',
  },
  {
    quote:
      'A consulta de cobertura antes do embarque evitou retrabalho e deu previsibilidade para o cliente final.',
    author: 'Embarcador regional',
    role: 'Indústria e atacado',
  },
]

const FAQ = [
  {
    q: 'O que é o Hub logístico Lopesul?',
    a: 'É a vitrine da malha Lopesul: cotação, coleta, rastreio, cobertura e parcerias em um fluxo pensado para logística fracionada interestadual.',
  },
  {
    q: 'Preciso ter conta para cotar?',
    a: 'Sim. Com conta aprovada você libera cotação oficial, histórico e solicitação de coleta pela plataforma.',
  },
  {
    q: 'Como funciona a cobertura com parceiros?',
    a: 'A Lopesul consulta a malha própria e parceiras. Em alguns trechos a rota pode ser direta; em outros, redespacho entre redes.',
  },
  {
    q: 'Consigo acompanhar a carga depois da cotação?',
    a: 'Sim. Pelo rastreamento você consulta DANFE ou NF + documento e visualiza os eventos disponíveis.',
  },
  {
    q: 'Como falo com o comercial?',
    a: `Pelo e-mail ${BRAND.emailComercial} ou pelos canais de atendimento do painel e do site.`,
  },
]

function HubLogistico() {
  return (
    <div className="landing hub-landing">
      <section className="landing-hero hub-hero">
        <img
          className="landing-hero-bg"
          src="/home/banner-site-4.png"
          alt=""
          aria-hidden="true"
        />
        <div className="landing-hero-overlay hub-hero-overlay" />
        <div className="landing-hero-content">
          <img className="landing-hero-logo" src={BRAND.logo} alt={BRAND.name} />
          <h1>Hub logístico interestadual com velocidade e controle</h1>
          <p className="landing-hero-lead">
            Conectamos cotação, coleta, rastreio e cobertura em uma malha pensada para
            empresas que precisam de previsibilidade — com a operação Lopesul e parceiros
            estratégicos.
          </p>
          <div className="landing-hero-actions">
            <Link to="/cotacao" className="landing-cta">
              Fazer cotação
            </Link>
            <a href={mailtoComercial()} className="landing-cta landing-cta-outline">
              Falar com o time
            </a>
          </div>
        </div>
      </section>

      <section className="landing-section hub-problem">
        <div className="landing-wrap hub-problem-grid">
          <Reveal>
            <p className="landing-eyebrow">O desafio</p>
            <h2>O gargalo que custa caro na logística interestadual</h2>
            <p className="landing-lead">
              Empresas com alto volume enfrentam prazos longos, falta de rastreabilidade e
              custo elevado. O Hub logístico Lopesul organiza a malha para reduzir esse atrito —
              do pedido à entrega.
            </p>
          </Reveal>
          <div className="hub-stats">
            {STATS.map((item, index) => (
              <Reveal key={item.label} delay={index * 60} as="article" className="hub-stat">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="hub-urgency">
        <div className="landing-wrap hub-urgency-inner">
          <Reveal>
            <h2>Seu cliente espera previsibilidade. Sua operação precisa de velocidade.</h2>
            <p>
              Enquanto a logística tradicional alonga prazos e multiplica ferramentas, o Hub
              Lopesul concentra cotação, cobertura e rastreio em um só lugar.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <a href={mailtoComercial()} className="landing-cta">
              Falar com um especialista
            </a>
          </Reveal>
        </div>
      </section>

      <section className="landing-section hub-pillars-section">
        <div className="landing-wrap">
          <Reveal className="landing-section-head">
            <p className="landing-eyebrow">Malha conectada</p>
            <h2>Escala nacional com operação acelerada</h2>
            <p className="landing-lead">
              A Lopesul orquestra rotas, parceiros e tecnologia para entregar logística
              fracionada com mais previsibilidade.
            </p>
          </Reveal>
          <div className="hub-pillars">
            {PILARES.map((item, index) => (
              <Reveal key={item.title} delay={index * 70} as="article" className="hub-pillar">
                <img src={item.icon} alt="" />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120} className="hub-inline-cta">
            <Link to="/cidades-atendidas" className="landing-cta landing-cta-navy">
              Ver cobertura
            </Link>
            <Link to="/cotacao" className="landing-cta">
              Calcular frete
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="landing-section hub-story">
        <div className="landing-wrap hub-story-grid">
          <Reveal className="hub-story-visual">
            <img src="/home/banner-caixa.png" alt="Operação logística Lopesul" />
          </Reveal>
          <Reveal delay={80} className="hub-story-copy">
            <p className="landing-eyebrow">Operação real</p>
            <h2>Uma malha que une velocidade local e alcance interestadual</h2>
            <p>
              Do Sul ao Centro-Oeste e além, a Lopesul conecta coletas ágeis, rotas estratégicas
              e parceiros de transporte para manter sua carga em movimento — com menos
              incerteza e mais controle.
            </p>
            <ul className="hub-story-list">
              <li>Coletas em polos como Cascavel, Maringá e Londrina</li>
              <li>Cobertura ampliada por redes parceiras em dezenas de UFs</li>
              <li>Fluxo digital para cotar, embarcar e acompanhar</li>
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="landing-section hub-benefits">
        <div className="landing-wrap hub-benefits-grid">
          <Reveal className="hub-benefits-copy">
            <p className="landing-eyebrow light">Eficiência</p>
            <h2>Sua operação lucra. A malha trabalha a favor.</h2>
            <p>
              Menos retrabalho, mais visibilidade e uma rede que já circula — com a Lopesul no
              centro da conexão logística.
            </p>
            <a href={mailtoComercial()} className="landing-cta">
              Falar com um especialista
            </a>
          </Reveal>
          <div className="hub-benefits-list">
            {BENEFICIOS.map((item, index) => (
              <Reveal key={item.title} delay={index * 50} as="article" className="hub-benefit">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section hub-audience">
        <div className="landing-wrap">
          <Reveal className="landing-section-head">
            <p className="landing-eyebrow">Para quem é</p>
            <h2>Feito para empresas que vivem de prazo e volume</h2>
            <p className="landing-lead">
              Do embarcador regional à operação multiestado, o Hub apoia quem precisa
              decidir rápido e entregar com previsibilidade.
            </p>
          </Reveal>
          <div className="hub-audience-grid">
            {PUBLICOS.map((item, index) => (
              <Reveal key={item.title} delay={index * 60} as="article" className="hub-audience-card">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section hub-modules">
        <div className="landing-wrap">
          <Reveal className="landing-section-head">
            <p className="landing-eyebrow">Na prática</p>
            <h2>Tudo o que você precisa, no mesmo ecossistema</h2>
            <p className="landing-lead">
              Cada módulo do Hub conecta uma etapa da operação — sem espalhar a logística
              em dezenas de ferramentas.
            </p>
          </Reveal>
          <div className="hub-modules-grid">
            {MODULOS.map((item, index) => (
              <Reveal key={item.title} delay={index * 60} as="article" className="hub-module">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <Link to={item.to} className="hub-module-link">
                  {item.cta}
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section hub-steps-section">
        <div className="landing-wrap">
          <Reveal className="landing-section-head">
            <p className="landing-eyebrow">Como funciona</p>
            <h2>Do pedido à entrega, em um fluxo claro</h2>
            <p className="landing-lead">
              Integração rápida com a sua operação. A Lopesul cuida da conexão logística.
            </p>
          </Reveal>
          <ol className="hub-steps">
            {PASSOS.map((item, index) => (
              <Reveal key={item.step} delay={index * 60} as="li" className="hub-step">
                <span className="hub-step-num">{item.step}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
          <Reveal delay={100} className="hub-inline-cta">
            <Link to="/cotacao" className="landing-cta">
              Começar agora
            </Link>
            <a href={mailtoComercial()} className="landing-cta landing-cta-navy">
              Agendar conversa
            </a>
          </Reveal>
        </div>
      </section>

      <section className="landing-section hub-impact">
        <div className="landing-wrap hub-impact-inner">
          <Reveal>
            <p className="landing-eyebrow light">Resultado</p>
            <h2>Menos atrito operacional. Mais velocidade de resposta.</h2>
          </Reveal>
          <div className="hub-impact-grid">
            {IMPACTOS.map((item, index) => (
              <Reveal key={item.label} delay={index * 70} as="article" className="hub-impact-item">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section hub-quotes">
        <div className="landing-wrap">
          <Reveal className="landing-section-head">
            <p className="landing-eyebrow">Prova de valor</p>
            <h2>O que a operação ganha na prática</h2>
          </Reveal>
          <div className="hub-quotes-grid">
            {DEPOIMENTOS.map((item, index) => (
              <Reveal key={item.author} delay={index * 80} as="blockquote" className="hub-quote">
                <p>“{item.quote}”</p>
                <footer>
                  <strong>{item.author}</strong>
                  <span>{item.role}</span>
                </footer>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-partners">
        <Reveal className="landing-wrap landing-partners-inner">
          <p className="landing-eyebrow">Parcerias</p>
          <h2>Hub conectado a transportadoras que ampliam sua cobertura</h2>
          <p className="landing-lead">
            A Lopesul une forças com parceiros como a Envia Rápido para oferecer
            rotas estratégicas e alcance nacional.
          </p>
          <div className="landing-partner-logos">
            <img src="/home/logo-envia-rapido.png" alt="Envia Rápido" />
          </div>
        </Reveal>
      </section>

      <section className="landing-section hub-faq">
        <div className="landing-wrap hub-faq-grid">
          <Reveal>
            <p className="landing-eyebrow">Dúvidas</p>
            <h2>Perguntas frequentes</h2>
            <p className="landing-lead">
              Respostas rápidas sobre o Hub. Se precisar de algo específico, fale com o
              comercial.
            </p>
          </Reveal>
          <div className="hub-faq-list">
            {FAQ.map((item, index) => (
              <Reveal key={item.q} delay={index * 40} as="details" className="hub-faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section hub-contact">
        <div className="landing-wrap hub-contact-grid">
          <Reveal>
            <p className="landing-eyebrow">Próximo passo</p>
            <h2>Vamos desenhar a melhor rota para o seu volume</h2>
            <p className="landing-lead">
              Conte sobre origem, destino e frequência de embarque. O time Lopesul indica o
              melhor caminho na malha.
            </p>
          </Reveal>
          <div className="hub-contact-cards">
            <Reveal as="a" href={mailtoComercial()} className="hub-contact-card">
              <strong>Comercial</strong>
              <span>{BRAND.emailComercial}</span>
            </Reveal>
            <Reveal as="a" href={mailtoOperacional()} delay={60} className="hub-contact-card">
              <strong>Operacional</strong>
              <span>{BRAND.emailOperacional}</span>
            </Reveal>
            <Reveal as={Link} to="/painel" delay={120} className="hub-contact-card">
              <strong>Painel do cliente</strong>
              <span>Acompanhe cotações e histórico</span>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="landing-banner-cta">
        <img className="landing-banner-cta-bg" src="/home/banner-blog.png" alt="" aria-hidden="true" />
        <div className="landing-wrap landing-banner-cta-inner">
          <h2>Reduza atrito e acelere sua logística interestadual</h2>
          <div className="hub-banner-actions">
            <Link to="/cotacao" className="landing-cta">
              Fazer cotação
            </Link>
            <a href={mailtoComercial()} className="landing-cta landing-cta-outline">
              Falar com o time
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}

export default HubLogistico
