import { useCallback, useEffect, useRef, useState } from 'react';
import type { ItemLixeira, Item } from '../../../core/conteudo/cofre.ts';
import type { ArestaGrafo, NoGrafo } from '../../../core/conteudo/ligacoes.ts';
import type { Problema, Quadro } from '../../../core/quadro/quadro.ts';
import type { ConfigRadar, EstadoRadar, ResumoSugestao } from '../../../core/radar/radar.ts';
import type { Tarefa } from '../../../core/render/fila.ts';
import { api, q } from './api.ts';
import { Ajuda } from './componentes/Ajuda.tsx';
import { BarraLateral, type AcaoBarra } from './componentes/BarraLateral.tsx';
import { Branding, type DadosBranding } from './componentes/Branding.tsx';
import { CartaoEditor } from './componentes/CartaoEditor.tsx';
import { Dialogo, type PedidoDialogo } from './componentes/Dialogo.tsx';
import { EditorNota, VerAnexo } from './componentes/EditorNota.tsx';
import { Grafo } from './componentes/Grafo.tsx';
import { Inicio } from './componentes/Inicio.tsx';
import { PainelQuadro } from './componentes/PainelQuadro.tsx';
import { Pecas } from './componentes/Pecas.tsx';
import { Producoes, type Producao } from './componentes/Producoes.tsx';
import { QuadroCanvas } from './componentes/QuadroCanvas.tsx';
import { RoubarIdeias, type ReferenciaTela, type VideoMeu } from './componentes/RoubarIdeias.tsx';
import { achatar, pastaDe } from './logica/arvore.ts';
import { reduzir, type Acao } from './logica/quadro.ts';
import { alternar, selecionarIntervalo } from './logica/selecao.ts';

type Aba = 'inicio' | 'conteudos' | 'grafo' | 'roubar' | 'marca' | 'producoes' | 'pecas' | 'ajuda';
const ABAS: [Aba, string][] = [['inicio', 'Início'], ['conteudos', 'Conteúdos'], ['grafo', 'Grafo'], ['roubar', 'Roubar ideias'],
  ['marca', 'Marca'], ['producoes', 'Produções'], ['pecas', 'Peças'], ['ajuda', 'Ajuda']];

interface Ordem { cenas?: string[]; slides?: string[]; problemas: Problema[] }
interface Aviso { id: number; texto: string; erro?: boolean }

const tipoDoCaminho = (c: string): Item['tipo'] => (c.endsWith('.quadro.json') ? 'quadro' : c.endsWith('.md') ? 'nota' : 'anexo');
const lerLocal = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravarLocal = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento: segue */ } };

export function App() {
  const [aba, setAba] = useState<Aba>('inicio');
  const [tema, setTema] = useState(() => lerLocal('tema') ?? 'dark');
  const [arvore, setArvore] = useState<Item[]>([]);
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const ultimoClique = useRef<string | null>(null);
  const [aberto, setAberto] = useState<{ caminho: string; tipo: Item['tipo'] } | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [dialogo, setDialogo] = useState<PedidoDialogo | null>(null);
  const [lixeira, setLixeira] = useState<ItemLixeira[] | null>(null);

  const [quadro, setQuadro] = useState<Quadro | null>(null);
  const [ordem, setOrdem] = useState<Ordem>({ problemas: [] });
  const [cartaoSel, setCartaoSel] = useState<string | undefined>();
  const [marcados, setMarcados] = useState<string[]>([]);
  const [previa, setPrevia] = useState<string | undefined>();
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [tarefaQuadro, setTarefaQuadro] = useState<string | undefined>();
  const quadroRef = useRef<Quadro | null>(null);
  const caminhoQuadro = useRef<string | null>(null);
  const salvarTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const salvando = useRef<Promise<void>>(Promise.resolve());
  const sujo = useRef(false);

  const [radar, setRadar] = useState<EstadoRadar>({ situacao: 'parado', ciclosNaSessao: 0, custoHoje: 0, ultimasDescobertas: [] });
  const [configRadar, setConfigRadar] = useState<ConfigRadar | undefined>();
  const [sugestoes, setSugestoes] = useState<ResumoSugestao[]>([]);
  const [ocupado, setOcupado] = useState<string | undefined>();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [grafo, setGrafo] = useState<{ nos: NoGrafo[]; arestas: ArestaGrafo[] }>({ nos: [], arestas: [] });
  const [referencias, setReferencias] = useState<ReferenciaTela[]>([]);
  const [videos, setVideos] = useState<VideoMeu[]>([]);
  const [previaTecnica, setPreviaTecnica] = useState<{ url: string; efeito: string } | undefined>();
  const [branding, setBranding] = useState<DadosBranding | null>(null);
  const [producoes, setProducoes] = useState<Producao[]>([]);
  const [avaliadas, setAvaliadas] = useState<Record<string, boolean>>(() => JSON.parse(lerLocal('avaliadas') ?? '{}'));

  // ---------- avisos e diálogos
  const avisar = useCallback((texto: string, erro = false) => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, texto, erro }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), erro ? 7000 : 3500);
  }, []);
  const erro = useCallback((m: string) => avisar(m, true), [avisar]);
  const perguntar = (p: Omit<PedidoDialogo, 'resolver'>) => new Promise<string | null>((ok) => setDialogo({ ...p, resolver: (v) => { setDialogo(null); ok(v); } }));

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    gravarLocal('tema', tema);
  }, [tema]);

  // ---------- carregamentos
  const carregarArvore = useCallback(() => api.get<{ itens: Item[] }>('/api/arvore').then((r) => setArvore(r.itens)).catch((e) => erro(e.message)), [erro]);
  const carregarSugestoes = useCallback(() => api.get<{ sugestoes: ResumoSugestao[] }>('/api/sugestoes').then((r) => setSugestoes(r.sugestoes)).catch(() => {}), []);
  const carregarRadar = useCallback(() => api.get<{ estado: EstadoRadar; config: ConfigRadar }>('/api/radar')
    .then((r) => { setRadar(r.estado); setConfigRadar(r.config); }).catch(() => {}), []);
  const carregarReferencias = useCallback(() => Promise.all([
    api.get<{ referencias: ReferenciaTela[] }>('/api/referencias').then((r) => setReferencias(r.referencias)),
    api.get<{ videos: VideoMeu[] }>('/api/videos').then((r) => setVideos(r.videos)),
  ]).catch(() => {}), []);
  const carregarProducoes = useCallback(() => api.get<{ itens: Producao[] }>('/api/producoes').then((r) => setProducoes(r.itens)).catch(() => {}), []);

  useEffect(() => {
    void carregarArvore();
    void carregarSugestoes();
    void carregarRadar();
  }, [carregarArvore, carregarSugestoes, carregarRadar]);

  // o nome da marca mora só no computador (conteudo/branding/marca.json)
  const [nomeMarca, setNomeMarca] = useState('');
  useEffect(() => {
    api.get<DadosBranding>('/api/branding').then((d) => {
      const nome = d.marca?.nome ?? '';
      setNomeMarca(nome);
      if (nome) document.title = `${nome} · estúdio`;
    }).catch(() => {});
  }, []);

  // o radar roda no servidor: a tela só acompanha
  const descobertasVistas = useRef('');
  useEffect(() => {
    const t = setInterval(() => void carregarRadar(), radar.situacao === 'rodando' ? 3000 : 10000);
    return () => clearInterval(t);
  }, [carregarRadar, radar.situacao]);
  useEffect(() => {
    const chave = radar.ultimasDescobertas.join('|');
    if (chave && chave !== descobertasVistas.current) {
      if (descobertasVistas.current) avisar(`O radar trouxe ${radar.ultimasDescobertas.length} nota(s) novas.`);
      descobertasVistas.current = chave;
      void carregarSugestoes();
      void carregarArvore();
    }
  }, [radar.ultimasDescobertas, carregarSugestoes, carregarArvore, avisar]);

  useEffect(() => {
    if (aba === 'grafo') api.get<{ nos: NoGrafo[]; arestas: ArestaGrafo[] }>('/api/grafo').then(setGrafo).catch((e) => erro(e.message));
    if (aba === 'roubar') void carregarReferencias();
    if (aba === 'marca') api.get<DadosBranding>('/api/branding').then(setBranding).catch((e) => erro(e.message));
    if (aba === 'producoes') void carregarProducoes();
  }, [aba, erro, carregarReferencias, carregarProducoes]);

  // ---------- tarefas em segundo plano
  const ativas = tarefas.some((t) => t.estado === 'fila' || t.estado === 'rodando');
  const estadosVistos = useRef(new Map<string, string>());
  useEffect(() => {
    const buscar = () => api.get<{ tarefas: Tarefa[] }>('/api/tarefas').then((r) => {
      for (const t of r.tarefas) {
        const antes = estadosVistos.current.get(t.id);
        if (antes && antes !== t.estado && (t.estado === 'pronta' || t.estado === 'erro')) {
          if (t.estado === 'pronta') avisar(`${t.titulo}: pronto.`); else erro(`${t.titulo}: ${t.erro}`);
          void carregarProducoes();
          if (t.tipo === 'referencia') { void carregarReferencias(); void carregarSugestoes(); void carregarArvore(); }
        }
        estadosVistos.current.set(t.id, t.estado);
      }
      setTarefas(r.tarefas);
    }).catch(() => {});
    void buscar();
    if (!ativas) return;
    const t = setInterval(buscar, 1500);
    return () => clearInterval(t);
  }, [ativas, avisar, erro, carregarProducoes, carregarReferencias, carregarSugestoes, carregarArvore]);
  const seguirTarefa = (t: Tarefa) => { estadosVistos.current.set(t.id, t.estado); setTarefas((ts) => [t, ...ts.filter((x) => x.id !== t.id)]); };

  // ---------- quadro: edição com salvamento automático
  const salvarAgora = useCallback(async () => {
    clearTimeout(salvarTimer.current);
    if (!sujo.current || !quadroRef.current || !caminhoQuadro.current) return salvando.current;
    sujo.current = false;
    const caminho = caminhoQuadro.current;
    const enviado = quadroRef.current;
    salvando.current = salvando.current.then(async () => {
      try {
        const r = await api.put<{ quadro: Quadro; ordem: Ordem }>('/api/quadro', { caminho, quadro: enviado });
        if (caminhoQuadro.current === caminho) setOrdem(r.ordem);
      } catch (e) {
        erro((e as Error).message);
      }
    });
    return salvando.current;
  }, [erro]);

  const atualizarPrevia = useCallback(async (id?: string) => {
    const alvo = id ?? cartaoSel;
    if (!alvo || !caminhoQuadro.current) return;
    await salvarAgora();
    setCarregandoPrevia(true);
    try {
      const r = await api.post<{ imagem: string }>('/api/quadro/previa', { caminho: caminhoQuadro.current, cartaoId: alvo });
      setPrevia(r.imagem);
    } catch (e) {
      if ((e as { status?: number }).status !== 404) erro((e as Error).message);
    } finally {
      setCarregandoPrevia(false);
    }
  }, [cartaoSel, salvarAgora, erro]);

  const previaTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const agir = useCallback((a: Acao) => {
    const atual = quadroRef.current;
    if (!atual) return;
    const novo = reduzir(atual, a);
    if (novo === atual) return;
    quadroRef.current = novo;
    setQuadro(novo);
    sujo.current = true;
    clearTimeout(salvarTimer.current);
    salvarTimer.current = setTimeout(() => void salvarAgora(), 600);
    if (a.tipo === 'campo' || a.tipo === 'gerado') {
      clearTimeout(previaTimer.current);
      previaTimer.current = setTimeout(() => void atualizarPrevia(), 1200);
    }
  }, [salvarAgora, atualizarPrevia]);

  const abrirQuadro = useCallback(async (caminho: string) => {
    await salvarAgora();
    const r = await api.get<{ quadro: Quadro; ordem: Ordem }>(`/api/quadro?caminho=${q(caminho)}`);
    caminhoQuadro.current = caminho;
    quadroRef.current = r.quadro;
    setQuadro(r.quadro);
    setOrdem(r.ordem);
    setCartaoSel(undefined);
    setPrevia(undefined);
    setMarcados([]);
    setTarefaQuadro(undefined);
  }, [salvarAgora]);

  const abrir = useCallback(async (caminho: string) => {
    const tipo = tipoDoCaminho(caminho);
    try {
      if (tipo === 'quadro') await abrirQuadro(caminho);
      else { await salvarAgora(); caminhoQuadro.current = null; quadroRef.current = null; setQuadro(null); }
      setAberto({ caminho, tipo });
      setAba('conteudos');
    } catch (e) {
      erro((e as Error).message);
    }
  }, [abrirQuadro, salvarAgora, erro]);

  const selecionarCartao = (id?: string) => {
    setCartaoSel(id);
    setMarcados([]);
    if (id) void atualizarPrevia(id);
  };

  const gerarCartao = async () => {
    if (!cartaoSel || !caminhoQuadro.current) return;
    await salvarAgora();
    setGerando(true);
    try {
      const r = await api.post<{ quadro: Quadro; ordem: Ordem }>('/api/quadro/gerar', { caminho: caminhoQuadro.current, cartaoId: cartaoSel });
      quadroRef.current = r.quadro;
      setQuadro(r.quadro);
      setOrdem(r.ordem);
      avisar('A IA preencheu o cartão. Edite à vontade: suas correções viram aprendizado.');
      void atualizarPrevia(cartaoSel);
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setGerando(false);
    }
  };

  const produzir = async () => {
    if (!caminhoQuadro.current) return;
    await salvarAgora();
    try {
      const r = await api.post<{ tarefa: Tarefa }>('/api/quadro/produzir', { caminho: caminhoQuadro.current });
      seguirTarefa(r.tarefa);
      setTarefaQuadro(r.tarefa.id);
      avisar(quadroRef.current?.tipo === 'video' ? 'Vídeo na fila. Pode continuar usando o app.' : 'Carrossel na fila.');
    } catch (e) {
      erro((e as Error).message);
    }
  };

  // ---------- barra lateral
  const pastaAlvo = (caminhos: string[]) => {
    const um = caminhos.length === 1 ? achatar(arvore).find((i) => i.caminho === caminhos[0]) : undefined;
    if (um?.tipo === 'pasta') return um.caminho;
    return aberto ? pastaDe(aberto.caminho) : '';
  };
  const comPasta = (pasta: string, nome: string) => (pasta && !nome.includes('/') ? `${pasta}/${nome}` : nome);

  const acaoBarra = async (acao: AcaoBarra, caminhos: string[]) => {
    try {
      if (acao === 'limpar') return setSelecao(new Set());
      if (acao === 'lixeira') return setLixeira((await api.get<{ itens: ItemLixeira[] }>('/api/lixeira')).itens);
      if (acao === 'nova-nota' || acao === 'nova-pasta') {
        const pasta = pastaAlvo(caminhos);
        const nome = await perguntar({ titulo: acao === 'nova-nota' ? 'Nova nota' : 'Nova pasta', texto: pasta ? `Dentro de ${pasta}/` : 'Na raiz dos conteúdos',
          campo: { rotulo: 'Nome', placeholder: acao === 'nova-nota' ? 'ex.: ideia sobre APIs' : 'ex.: roteiros' }, confirmar: 'Criar' });
        if (!nome) return;
        const r = await api.post<{ caminho: string }>(acao === 'nova-nota' ? '/api/notas' : '/api/pastas', { caminho: comPasta(pasta, nome.trim()) });
        await carregarArvore();
        if (acao === 'nova-nota') await abrir(r.caminho);
        return;
      }
      if (acao === 'novo-quadro') {
        const tipo = await perguntar({ titulo: 'Novo quadro', opcoes: [{ valor: 'video', rotulo: 'Vídeo (falas, transições e animações)' },
          { valor: 'carrossel', rotulo: 'Carrossel do Instagram (até 10 slides)' }], confirmar: 'Continuar' });
        if (!tipo) return;
        const nome = await perguntar({ titulo: 'Nome do quadro', campo: { rotulo: 'Nome', placeholder: 'ex.: API é o balcão' }, confirmar: 'Criar' });
        if (!nome) return;
        const r = await api.post<{ caminho: string }>('/api/quadros', { pasta: pastaAlvo(caminhos) || 'quadros', nome: nome.trim(), tipo });
        await carregarArvore();
        return abrir(r.caminho);
      }
      if (acao === 'renomear') {
        const atual = caminhos[0]!.split('/').pop()!.replace(/\.quadro\.json$|\.md$/, '');
        const nome = await perguntar({ titulo: 'Renomear', campo: { rotulo: 'Novo nome', valor: atual }, confirmar: 'Renomear' });
        if (!nome || nome === atual) return;
        const r = await api.post<{ caminho: string }>('/api/renomear', { caminho: caminhos[0], nome: nome.trim() });
        if (aberto?.caminho === caminhos[0]) await abrir(r.caminho);
        setSelecao(new Set([r.caminho]));
        return carregarArvore();
      }
      if (acao === 'mover') {
        const pastas = ['', ...achatar(arvore).filter((i) => i.tipo === 'pasta' && !caminhos.some((c) => i.caminho === c || i.caminho.startsWith(c + '/'))).map((i) => i.caminho)];
        const destino = await perguntar({ titulo: `Mover ${caminhos.length} item(ns) para`, opcoes: pastas.map((p) => ({ valor: p || '.', rotulo: p || '(raiz)' })), confirmar: 'Mover' });
        if (destino === null) return;
        const r = await api.post<{ novos: Record<string, string> }>('/api/mover', { caminhos, destino: destino === '.' ? '' : destino });
        if (aberto && r.novos[aberto.caminho]) await abrir(r.novos[aberto.caminho]!);
        setSelecao(new Set());
        avisar('Movido.');
        return carregarArvore();
      }
      if (acao === 'excluir') {
        const ok = await perguntar({ titulo: `Excluir ${caminhos.length} item(ns)?`, texto: 'Vai para a lixeira: dá para restaurar depois.', confirmar: 'Excluir', perigo: true });
        if (!ok) return;
        await api.post('/api/excluir', { caminhos });
        if (aberto && caminhos.some((c) => aberto.caminho === c || aberto.caminho.startsWith(c + '/'))) { setAberto(null); setQuadro(null); caminhoQuadro.current = null; }
        setSelecao(new Set());
        avisar('Enviado para a lixeira.');
        return carregarArvore();
      }
      if (acao === 'fonte') {
        const notas = achatar(arvore).filter((i) => i.tipo === 'nota' && caminhos.some((c) => i.caminho === c || i.caminho.startsWith(c + '/')));
        for (const n of notas) agir({ tipo: 'fonte', caminho: n.caminho });
        avisar(`${notas.length} nota(s) ligada(s) como fonte do quadro.`);
      }
    } catch (e) {
      erro((e as Error).message);
    }
  };

  const anexarArquivos = async (arquivos: File[], pasta: string) => {
    const destino = pasta || (aberto ? pastaDe(aberto.caminho) : '');
    for (const f of arquivos) {
      try {
        const r = await api.enviar<{ caminho: string }>('/api/anexos', f, { 'x-pasta': encodeURIComponent(destino) });
        avisar(`Anexado: ${r.caminho}`);
      } catch (e) {
        erro((e as Error).message);
      }
    }
    void carregarArvore();
  };

  const criarPendente = async (alvo: string) => {
    const ok = await perguntar({ titulo: `Criar a nota "${alvo}"?`, texto: 'Essa ligação ainda não tem nota.', confirmar: 'Criar' });
    if (!ok) return;
    try {
      const r = await api.post<{ caminho: string }>('/api/notas', { caminho: comPasta(aberto ? pastaDe(aberto.caminho) : '', alvo), conteudo: `# ${alvo}\n\n` });
      await carregarArvore();
      await abrir(r.caminho);
    } catch (e) {
      erro((e as Error).message);
    }
  };

  // ---------- início
  const criarDeSugestao = async (caminho: string, tipo: 'video' | 'carrossel') => {
    setOcupado(caminho);
    try {
      const r = await api.post<{ caminho: string }>('/api/sugestoes/quadro', { caminho, tipo });
      await Promise.all([carregarArvore(), carregarSugestoes()]);
      await abrir(r.caminho);
      avisar('Quadro montado pela IA. Confira as cenas e a prévia.');
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setOcupado(undefined);
    }
  };

  const cartaoAtual = quadro?.cartoes.find((c) => c.id === cartaoSel);
  const tarefaAtual = tarefas.find((t) => t.id === tarefaQuadro);
  const ordemIds = ordem.cenas ?? ordem.slides ?? [];
  const tarefasAtivas = tarefas.filter((t) => t.estado === 'fila' || t.estado === 'rodando');

  return (
    <div className="app">
      <header className="topo-app">
        <div className="logo"><span className="quadradinho" />{nomeMarca} <span className="suave">estúdio</span></div>
        <nav className="abas" aria-label="Seções">
          {ABAS.map(([id, nome]) => (
            <button key={id} type="button" className={`aba${aba === id ? ' ativa' : ''}`} aria-current={aba === id} onClick={() => setAba(id)}>
              {nome}{id === 'inicio' && sugestoes.some((s) => s.status === 'nova') ? <span className="contador">{sugestoes.filter((s) => s.status === 'nova').length}</span> : null}
            </button>
          ))}
        </nav>
        <button type="button" className="mini fantasma" onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}>{tema === 'dark' ? 'Tema claro' : 'Tema escuro'}</button>
      </header>
      <div className="corpo">
        <BarraLateral itens={arvore} selecao={selecao} aberto={aberto?.caminho} quadroAberto={!!quadro}
          aoAlternar={(c, shift) => {
            const lista = achatar(arvore).map((i) => i.caminho);
            setSelecao((s) => (shift && ultimoClique.current ? selecionarIntervalo(s, lista, ultimoClique.current, c) : alternar(s, c)));
            ultimoClique.current = c;
          }}
          aoAbrir={(i) => void abrir(i.caminho)} aoAcao={(a, c) => void acaoBarra(a, c)} aoSoltarArquivos={(f, p) => void anexarArquivos(f, p)} />
        <main className={`principal-area aba-${aba}`}>
          {aba === 'inicio' && (
            <Inicio radar={radar} sugestoes={sugestoes} config={configRadar} ocupado={ocupado}
              aoPausar={() => api.post<EstadoRadar>('/api/radar/pausar').then(setRadar).catch((e) => erro(e.message))}
              aoRetomar={() => api.post<EstadoRadar>('/api/radar/retomar').then(setRadar).catch((e) => erro(e.message))}
              aoAgora={async () => {
                setOcupado('radar');
                try { setRadar(await api.post<EstadoRadar>('/api/radar/agora')); await carregarSugestoes(); } catch (e) { erro((e as Error).message); } finally { setOcupado(undefined); }
              }}
              aoCriarQuadro={(c, t) => void criarDeSugestao(c, t)}
              aoDescartar={(c) => api.post('/api/sugestoes/descartar', { caminho: c }).then(carregarSugestoes).catch((e) => erro(e.message))}
              aoAbrir={(c) => void abrir(c)}
              aoConfig={(p) => api.put<{ config: ConfigRadar }>('/api/radar/config', p).then((r) => setConfigRadar(r.config)).catch((e) => erro(e.message))} />
          )}
          {aba === 'conteudos' && !aberto && (
            <div className="pagina vazio-grande">
              <h2>Seus conteúdos</h2>
              <p className="suave">Abra uma nota, um quadro ou um anexo na barra lateral, ou crie um novo com "+ Nota" e "+ Quadro".</p>
            </div>
          )}
          {aba === 'conteudos' && aberto?.tipo === 'nota' && (
            <EditorNota caminho={aberto.caminho} aoAbrir={(c) => void abrir(c)} aoCriarPendente={(a) => void criarPendente(a)} aoErro={erro} />
          )}
          {aba === 'conteudos' && aberto?.tipo === 'anexo' && <VerAnexo caminho={aberto.caminho} />}
          {aba === 'conteudos' && aberto?.tipo === 'quadro' && quadro && (
            <div className="area-quadro">
              <div className="quadro-centro">
                <header className="cabeca-quadro">
                  <input className="nome-quadro" value={quadro.nome} aria-label="Nome do quadro" onChange={(e) => agir({ tipo: 'quadro', campo: 'nome', valor: e.target.value })} />
                  <span className="selo">{quadro.tipo === 'video' ? 'Vídeo 1080x1920' : 'Carrossel 1080x1350'}</span>
                  {quadro.tipo === 'video' && (
                    <label className="mini-check"><input type="checkbox" checked={quadro.legenda} onChange={(e) => agir({ tipo: 'quadro', campo: 'legenda', valor: e.target.checked })} /> Legenda da fala</label>
                  )}
                  <input className="instrucoes-quadro" value={quadro.instrucoes} placeholder="Instruções gerais (tom, público, intenção)" aria-label="Instruções do quadro"
                    onChange={(e) => agir({ tipo: 'quadro', campo: 'instrucoes', valor: e.target.value })} />
                </header>
                <QuadroCanvas quadro={quadro} ordem={ordemIds} selecionado={cartaoSel} marcados={marcados} aoAcao={agir} aoSelecionar={selecionarCartao} />
              </div>
              <PainelQuadro tipo={quadro.tipo} problemas={ordem.problemas} previa={previa} carregandoPrevia={carregandoPrevia} tarefa={tarefaAtual}
                fontes={quadro.fontes} aoGerarPrevia={() => void atualizarPrevia()} aoProduzir={() => void produzir()}
                aoFonte={(c, ativo) => agir({ tipo: 'fonte', caminho: c, ativo })} aoTirarFonte={(c) => agir({ tipo: 'tirar-fonte', caminho: c })}
                aoMarcar={(ids) => { setMarcados(ids); if (ids[0]) setCartaoSel(ids[0]); }}>
                {cartaoAtual
                  ? <CartaoEditor key={cartaoAtual.id} cartao={cartaoAtual} gerando={gerando} aoGerar={() => void gerarCartao()}
                    aoCampo={(k, v) => agir({ tipo: 'campo', id: cartaoAtual.id, chave: k, valor: v })}
                    aoInstrucoes={(v) => agir({ tipo: 'instrucoes', id: cartaoAtual.id, valor: v })}
                    aoRemover={() => { agir({ tipo: 'remover', id: cartaoAtual.id }); setCartaoSel(undefined); setPrevia(undefined); }} />
                  : <section className="bloco-painel"><p className="suave">Selecione um cartão para editar. Use os botões acima do quadro para adicionar.</p></section>}
              </PainelQuadro>
            </div>
          )}
          {aba === 'grafo' && <Grafo dados={grafo} atual={aberto?.caminho} aoAbrir={(id) => void abrir(id)} />}
          {aba === 'roubar' && (
            <RoubarIdeias referencias={referencias} videos={videos} previa={previaTecnica} ocupado={ocupado === 'roubar'} aoAbrir={(c) => void abrir(c)}
              aoEnviar={async (f) => {
                setOcupado('roubar');
                try {
                  const r = await api.enviar<{ tarefa: Tarefa }>('/api/referencias', f);
                  seguirTarefa(r.tarefa);
                  avisar('Referência recebida. A análise roda em segundo plano.');
                  await carregarReferencias();
                } catch (e) { erro((e as Error).message); } finally { setOcupado(undefined); }
              }}
              aoPrevia={async (p) => {
                setOcupado('roubar');
                try {
                  const r = await api.post<{ video: string }>('/api/referencias/previa', p);
                  setPreviaTecnica({ url: r.video, efeito: p.efeito });
                } catch (e) { erro((e as Error).message); } finally { setOcupado(undefined); }
              }} />
          )}
          {aba === 'marca' && (
            <Branding dados={branding} consolidando={ocupado === 'marca'} aoAbrir={(c) => void abrir(c)}
              aoConsolidar={async () => {
                setOcupado('marca');
                try { await api.post('/api/branding/consolidar'); setBranding(await api.get<DadosBranding>('/api/branding')); avisar('Perfil da marca atualizado.'); }
                catch (e) { erro((e as Error).message); } finally { setOcupado(undefined); }
              }} />
          )}
          {aba === 'producoes' && (
            <Producoes itens={producoes} avaliadas={avaliadas} aoAvaliar={async (p, ok) => {
              try {
                await api.post('/api/branding/evento', { tipo: ok ? 'peca-aprovada' : 'peca-rejeitada', dados: { tema: p.nome, tipo: p.tipo } });
                const novas = { ...avaliadas, [p.url]: ok };
                setAvaliadas(novas);
                gravarLocal('avaliadas', JSON.stringify(novas));
                avisar(ok ? 'Aprovada: vira referência da marca.' : 'Rejeitada: a marca aprende com isso.');
              } catch (e) { erro((e as Error).message); }
            }} />
          )}
          {aba === 'pecas' && <Pecas aoErro={erro} />}
          {aba === 'ajuda' && <Ajuda />}
        </main>
      </div>

      {tarefasAtivas.length > 0 && (
        <div className="tarefas-flutuante" role="status">
          {tarefasAtivas.map((t) => <div key={t.id} className="tarefa"><span className="girando" aria-hidden /> <strong>{t.titulo}</strong> <span className="suave">{t.progresso}</span></div>)}
        </div>
      )}
      <div className="avisos" aria-live="polite">{avisos.map((a) => <div key={a.id} className={`aviso${a.erro ? ' erro' : ''}`}>{a.texto}</div>)}</div>
      <Dialogo pedido={dialogo} />
      {lixeira && (
        <div className="fundo-dialogo" onMouseDown={(e) => e.target === e.currentTarget && setLixeira(null)}>
          <div className="dialogo cartao-vidro" role="dialog" aria-label="Lixeira">
            <h3>Lixeira</h3>
            {!lixeira.length && <p className="suave">Vazia.</p>}
            <ul className="lista-lixeira">
              {lixeira.map((i) => (
                <li key={i.id}><span>{i.origem}</span> <span className="suave">{new Date(i.quando).toLocaleString('pt-BR')}</span>
                  <button type="button" className="mini" onClick={async () => {
                    try { const r = await api.post<{ caminho: string }>('/api/lixeira/restaurar', { id: i.id }); avisar(`Restaurado: ${r.caminho}`);
                      setLixeira((await api.get<{ itens: ItemLixeira[] }>('/api/lixeira')).itens); void carregarArvore(); } catch (e) { erro((e as Error).message); }
                  }}>Restaurar</button>
                </li>
              ))}
            </ul>
            <div className="acoes">
              <button type="button" className="fantasma" onClick={() => setLixeira(null)}>Fechar</button>
              {lixeira.length > 0 && <button type="button" className="perigo" onClick={async () => {
                const ok = await perguntar({ titulo: 'Esvaziar a lixeira?', texto: 'Apaga de vez. Não dá para desfazer.', confirmar: 'Esvaziar', perigo: true });
                if (!ok) return;
                await api.post('/api/lixeira/esvaziar');
                setLixeira([]);
              }}>Esvaziar lixeira</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
