import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lerEventos, prepararMemoria } from '../core/branding/memoria.ts';
import { IAFalsa } from '../core/ia/ia.ts';
import { dataLocal } from '../core/conteudo/slug.ts';
import { Radar } from '../core/radar/radar.ts';
import type { Motor } from '../core/render/motor.ts';
import { criarServidor } from './api.ts';

let raiz: string;
let saida: string;
let base: string;
let fechar: () => Promise<void>;
let ia: IAFalsa;
const chamadasMotor: string[] = [];

const motorFalso: Motor = {
  async cena(entrada, destino) {
    chamadasMotor.push(`cena:${(entrada as { tela?: string }).tela}`);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, 'png');
    return destino;
  },
  async slides(entrada, pasta) {
    const n = (entrada as { slides: unknown[] }).slides.length;
    chamadasMotor.push(`slides:${n}`);
    await mkdir(pasta, { recursive: true });
    const imagens = [];
    for (let i = 1; i <= n; i++) {
      const img = path.join(pasta, `slide-${String(i).padStart(2, '0')}.png`);
      await writeFile(img, 'png');
      imagens.push(img);
    }
    await writeFile(path.join(pasta, 'carrossel.zip'), 'zip');
    return { imagens, zip: path.join(pasta, 'carrossel.zip') };
  },
  async tecnica(entrada, destino) {
    chamadasMotor.push(`tecnica:${(entrada as { efeito: string }).efeito}`);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, 'mp4');
    return destino;
  },
  async video(entrada, destino, progredir) {
    chamadasMotor.push(`video:${(entrada as { cenas: unknown[] }).cenas.length}`);
    progredir('montando');
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, 'mp4');
    return destino;
  },
};

async function api(metodo: string, rota: string, corpo?: unknown, cabecalhos: Record<string, string> = {}) {
  const r = await fetch(base + rota, {
    method: metodo,
    headers: corpo === undefined ? cabecalhos : { 'Content-Type': 'application/json', ...cabecalhos },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const tipo = r.headers.get('content-type') ?? '';
  return { status: r.status, dados: tipo.includes('json') ? await r.json() : await r.text(), tipo };
}

beforeEach(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), 'api-cofre-'));
  saida = await mkdtemp(path.join(tmpdir(), 'api-saida-'));
  await prepararMemoria(raiz);
  ia = new IAFalsa([]);
  chamadasMotor.length = 0;
  const radar = new Radar({ raiz, ia, agendar: () => () => {} });
  const servidor = criarServidor({ raiz, ia, motor: motorFalso, pastaSaida: saida, radar, limiteUpload: 1024,
    extrairReferencia: async () => ({ tipo: 'imagem', duracao: 0, largura: 10, altura: 10, cortes: [], quadros: [], transcricao: '', palavras: 0, cores: ['#000000'] }) });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  fechar = () => new Promise((ok) => servidor.close(() => ok()));
});
afterEach(async () => {
  await fechar();
  await rm(raiz, { recursive: true, force: true });
  await rm(saida, { recursive: true, force: true });
});

describe('conteúdos', () => {
  it('cria pasta e nota, lista a árvore, lê com ligações e retroligações, e salva', async () => {
    expect((await api('POST', '/api/pastas', { caminho: 'ideias' })).dados).toEqual({ caminho: 'ideias' });
    await api('POST', '/api/notas', { caminho: 'ideias/api', conteudo: 'Ver [[jargao]] e [[nada]].' });
    await api('POST', '/api/notas', { caminho: 'jargao', conteudo: 'Volta para [[api]].' });
    const arvore = await api('GET', '/api/arvore');
    expect(arvore.dados.itens.map((i: { nome: string }) => i.nome)).toEqual(expect.arrayContaining(['branding', 'ideias', 'jargao.md']));
    const nota = await api('GET', '/api/nota?caminho=ideias/api.md');
    expect(nota.dados).toMatchObject({ caminho: 'ideias/api.md', conteudo: 'Ver [[jargao]] e [[nada]].',
      ligacoes: [{ alvo: 'jargao', caminho: 'jargao.md' }, { alvo: 'nada', caminho: null }] });
    const volta = await api('GET', '/api/nota?caminho=jargao.md');
    expect(volta.dados.retroligacoes).toEqual(['ideias/api.md']);
    expect((await api('PUT', '/api/nota', { caminho: 'jargao.md', conteudo: 'novo' })).status).toBe(200);
    expect((await api('GET', '/api/nota?caminho=jargao.md')).dados.conteudo).toBe('novo');
  });

  it('renomeia, move em lote, exclui para a lixeira, restaura e esvazia', async () => {
    await api('POST', '/api/notas', { caminho: 'a' });
    await api('POST', '/api/notas', { caminho: 'b' });
    await api('POST', '/api/pastas', { caminho: 'arquivo' });
    expect((await api('POST', '/api/renomear', { caminho: 'a.md', nome: 'alfa' })).dados).toEqual({ caminho: 'alfa.md' });
    expect((await api('POST', '/api/mover', { caminhos: ['alfa.md', 'b.md'], destino: 'arquivo' })).dados.novos)
      .toEqual({ 'alfa.md': 'arquivo/alfa.md', 'b.md': 'arquivo/b.md' });
    const { dados } = await api('POST', '/api/excluir', { caminhos: ['arquivo/b.md'] });
    expect((await api('GET', '/api/lixeira')).dados.itens).toHaveLength(1);
    expect((await api('POST', '/api/lixeira/restaurar', { id: dados.ids[0] })).dados.caminho).toBe('arquivo/b.md');
    await api('POST', '/api/excluir', { caminhos: ['arquivo/alfa.md'] });
    expect((await api('POST', '/api/lixeira/esvaziar', {})).dados.apagados).toBe(1);
  });

  it('anexa arquivo enviado e devolve com o tipo certo; recusa anexo grande demais', async () => {
    await api('POST', '/api/pastas', { caminho: 'midia' });
    const r = await fetch(`${base}/api/anexos`, { method: 'POST', body: new Uint8Array([137, 80, 78, 71]),
      headers: { 'x-pasta': encodeURIComponent('midia'), 'x-nome': encodeURIComponent('capa ação.png') } });
    expect(await r.json()).toEqual({ caminho: 'midia/capa ação.png' });
    const arq = await fetch(`${base}/api/arquivo?caminho=${encodeURIComponent('midia/capa ação.png')}`);
    expect(arq.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await arq.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
    const grande = await fetch(`${base}/api/anexos`, { method: 'POST', body: new Uint8Array(4096),
      headers: { 'x-pasta': 'midia', 'x-nome': 'g.bin' } });
    expect(grande.status).toBe(413);
  });

  it('grafo devolve nós e arestas', async () => {
    await api('POST', '/api/notas', { caminho: 'x', conteudo: '[[y]]' });
    await api('POST', '/api/notas', { caminho: 'y' });
    const g = (await api('GET', '/api/grafo')).dados;
    expect(g.arestas).toEqual(expect.arrayContaining([{ de: 'x.md', para: 'y.md' }]));
  });

  it('erros têm status e mensagem em português; caminho perigoso é recusado', async () => {
    expect((await api('GET', '/api/nota?caminho=../../etc/passwd')).status).toBe(400);
    expect((await api('GET', '/api/nota?caminho=nao.md')).status).toBe(404);
    await api('POST', '/api/notas', { caminho: 'dup' });
    const dup = await api('POST', '/api/notas', { caminho: 'dup' });
    expect(dup.status).toBe(409);
    expect(dup.dados.erro).toMatch(/existe/);
    expect((await api('GET', '/api/rota-que-nao-existe')).status).toBe(404);
    const semJson = await fetch(`${base}/api/notas`, { method: 'POST', body: 'caminho=x' });
    expect(semJson.status).toBe(415);
    const quebrado = await fetch(`${base}/api/notas`, { method: 'POST', body: '{oi', headers: { 'Content-Type': 'application/json' } });
    expect(quebrado.status).toBe(400);
  });
});

describe('quadros', () => {
  async function criarQuadroVideo() {
    const { dados } = await api('POST', '/api/quadros', { pasta: '', nome: 'API', tipo: 'video' });
    return dados.caminho as string;
  }

  it('cria, lê com a ordem calculada e salva', async () => {
    const caminho = await criarQuadroVideo();
    expect(caminho).toBe('API.quadro.json');
    const { dados } = await api('GET', `/api/quadro?caminho=${caminho}`);
    expect(dados.quadro).toMatchObject({ tipo: 'video', nome: 'API' });
    expect(dados.ordem.problemas[0].mensagem).toMatch(/fala/);
    const quadro = { ...dados.quadro, cartoes: [{ id: 'a', tipo: 'fala', x: 0, y: 0, instrucoes: '', campos: { fala: 'Oi', tela: 'Oi' }, anexos: [] }] };
    const salvo = await api('PUT', '/api/quadro', { caminho, quadro });
    expect(salvo.dados.ordem.cenas).toEqual(['a']);
    expect((await api('PUT', '/api/quadro', { caminho, quadro: { ...quadro, tipo: 'podcast' } })).status).toBe(422);
  });

  it('gera um cartão com a IA, marca os campos gerados e registra edição feita depois', async () => {
    const caminho = await criarQuadroVideo();
    const q = (await api('GET', `/api/quadro?caminho=${caminho}`)).dados.quadro;
    const cartao = { id: 'a', tipo: 'fala', x: 0, y: 0, instrucoes: 'Abrir com pergunta', campos: {}, anexos: [] };
    await api('PUT', '/api/quadro', { caminho, quadro: { ...q, cartoes: [cartao] } });
    ia.respostas.push(JSON.stringify({ fala: 'Já pediu comida?', tela: 'Já pediu *comida*?', expressao: 'pensativo' }));
    const g = await api('POST', '/api/quadro/gerar', { caminho, cartaoId: 'a' });
    expect(g.dados.cartao.campos).toMatchObject({ fala: 'Já pediu comida?', expressao: 'pensativo' });
    expect(g.dados.cartao.geradoPorIA).toEqual(expect.arrayContaining(['fala', 'tela', 'expressao']));
    const editado = { ...g.dados.cartao, campos: { ...g.dados.cartao.campos, tela: 'Bateu fome?' } };
    await api('PUT', '/api/quadro', { caminho, quadro: { ...q, cartoes: [editado] } });
    const eventos = await lerEventos(raiz);
    expect(eventos.find((e) => e.tipo === 'edicao-apos-ia')?.dados).toMatchObject({ campo: 'tela', antes: 'Já pediu *comida*?', depois: 'Bateu fome?' });
    const relido = (await api('GET', `/api/quadro?caminho=${caminho}`)).dados.quadro.cartoes[0];
    expect(relido.geradoPorIA).not.toContain('tela');
  });

  it('erro da IA vira 502 com a mensagem, sem estragar o quadro', async () => {
    const caminho = await criarQuadroVideo();
    const q = (await api('GET', `/api/quadro?caminho=${caminho}`)).dados.quadro;
    await api('PUT', '/api/quadro', { caminho, quadro: { ...q, cartoes: [{ id: 'a', tipo: 'fala', x: 0, y: 0, instrucoes: '', campos: { fala: 'x' }, anexos: [] }] } });
    const r = await api('POST', '/api/quadro/gerar', { caminho, cartaoId: 'a' });
    expect(r.status).toBe(502);
    expect((await api('GET', `/api/quadro?caminho=${caminho}`)).dados.quadro.cartoes[0].campos.fala).toBe('x');
  });

  it('prévia da cena devolve uma imagem servida pela API', async () => {
    const caminho = await criarQuadroVideo();
    const q = (await api('GET', `/api/quadro?caminho=${caminho}`)).dados.quadro;
    await api('PUT', '/api/quadro', { caminho, quadro: { ...q, cartoes: [{ id: 'a', tipo: 'fala', x: 0, y: 0, instrucoes: '', campos: { fala: 'Oi', tela: 'Olá *mundo*' }, anexos: [] }] } });
    const r = await api('POST', '/api/quadro/previa', { caminho, cartaoId: 'a' });
    expect(chamadasMotor).toContain('cena:Olá *mundo*');
    const img = await fetch(base + r.dados.imagem);
    expect(img.status).toBe(200);
  });

  it('produzir vídeo vira tarefa, registra as escolhas na marca e o arquivo fica disponível', async () => {
    const caminho = await criarQuadroVideo();
    const q = (await api('GET', `/api/quadro?caminho=${caminho}`)).dados.quadro;
    await api('PUT', '/api/quadro', { caminho, quadro: { ...q, cartoes: [
      { id: 'a', tipo: 'fala', x: 0, y: 0, instrucoes: '', campos: { fala: 'Oi', tela: 'Oi', expressao: 'joinha' }, anexos: [] },
      { id: 't', tipo: 'transicao', x: 0, y: 0, instrucoes: '', campos: { efeito: 'cacos' }, anexos: [] }],
      conexoes: [{ id: 'c', de: 'a', para: 't' }] } });
    const { dados } = await api('POST', '/api/quadro/produzir', { caminho });
    let tarefa = dados.tarefa;
    for (let i = 0; i < 50 && tarefa.estado !== 'pronta'; i++) {
      await new Promise((r) => setTimeout(r, 20));
      tarefa = (await api('GET', `/api/tarefas/${tarefa.id}`)).dados;
    }
    expect(tarefa.estado).toBe('pronta');
    expect(chamadasMotor).toContain('video:1');
    expect((await fetch(base + tarefa.saida)).status).toBe(200);
    const evento = (await lerEventos(raiz)).find((e) => e.tipo === 'quadro-produzido');
    expect(evento?.dados).toMatchObject({ transicoes: ['cacos'], expressoes: ['joinha'] });
    expect((await api('GET', '/api/tarefas')).dados.tarefas).toHaveLength(1);
  });

  it('não produz quadro com erro de ordem', async () => {
    const caminho = await criarQuadroVideo();
    const q = (await api('GET', `/api/quadro?caminho=${caminho}`)).dados.quadro;
    await api('PUT', '/api/quadro', { caminho, quadro: { ...q, cartoes: [
      { id: 'a', tipo: 'fala', x: 0, y: 0, instrucoes: '', campos: { fala: '1' }, anexos: [] },
      { id: 'b', tipo: 'fala', x: 0, y: 0, instrucoes: '', campos: { fala: '2' }, anexos: [] }],
      conexoes: [{ id: 'c1', de: 'a', para: 'b' }, { id: 'c2', de: 'b', para: 'a' }] } });
    expect((await api('POST', '/api/quadro/produzir', { caminho })).status).toBe(422);
  });
});

describe('sugestões, radar e branding', () => {
  const descoberta = JSON.stringify({ tendencias: [], jargoes: [], sugestoes: [
    { titulo: 'API é o balcão', gancho: 'Já pediu comida?', formato: 'ambos', pontos: ['balcão'], porque_agora: 'sempre', fontes: [] }] });

  it('o estado do radar mostra o custo do dia já gravado, mesmo com o radar desligado', async () => {
    const hoje = dataLocal(new Date());
    await mkdir(path.join(raiz, '.estudio'), { recursive: true });
    await writeFile(path.join(raiz, '.estudio', 'radar.json'), JSON.stringify({ custos: { [hoje]: 0.14 }, ciclos: [], conhecidos: [] }));
    expect((await api('GET', '/api/radar')).dados.estado.custoHoje).toBe(0.14);
  });

  it('radar roda um ciclo agora, pausa e retoma, e a sugestão vira quadro com um clique', async () => {
    ia.respostas.push(descoberta);
    expect((await api('POST', '/api/radar/agora', {})).dados.ciclosNaSessao).toBe(1);
    expect((await api('POST', '/api/radar/pausar', {})).dados.situacao).toBe('pausado');
    const { dados } = await api('GET', '/api/sugestoes');
    expect(dados.sugestoes[0]).toMatchObject({ titulo: 'API é o balcão', status: 'nova' });
    ia.respostas.push(JSON.stringify({ nome: 'API', slides: [{ modelo: 'capa', campos: { titulo: 'API é o *balcão*' } }] }));
    const r = await api('POST', '/api/sugestoes/quadro', { caminho: dados.sugestoes[0].caminho, tipo: 'carrossel' });
    expect(r.dados.caminho).toMatch(/\.quadro\.json$/);
    expect((await api('GET', '/api/sugestoes')).dados.sugestoes[0].status).toBe('usada');
    expect((await lerEventos(raiz)).some((e) => e.tipo === 'sugestao-usada')).toBe(true);
    expect((await api('PUT', '/api/radar/config', { intervaloMin: 30 })).dados.config.intervaloMin).toBe(30);
    expect((await api('PUT', '/api/radar/config', { intervaloMin: -1 })).status).toBe(400);
    expect((await api('GET', '/api/radar')).dados).toMatchObject({ estado: { situacao: 'pausado' } });
  });

  it('descartar sugestão muda o status e vira aprendizado', async () => {
    ia.respostas.push(descoberta);
    await api('POST', '/api/radar/agora', {});
    const s = (await api('GET', '/api/sugestoes')).dados.sugestoes[0];
    await api('POST', '/api/sugestoes/descartar', { caminho: s.caminho });
    expect((await api('GET', '/api/sugestoes')).dados.sugestoes[0].status).toBe('descartada');
  });

  it('branding mostra o perfil e consolida com a IA', async () => {
    const r = await api('GET', '/api/branding');
    expect(r.dados).toMatchObject({ eventos: 0, marca: { nome: 'minha marca' } });
    ia.respostas.push('# Perfil\n- Direto e bem-humorado.');
    expect((await api('POST', '/api/branding/consolidar', {})).dados.perfil).toMatch(/bem-humorado/);
    await api('POST', '/api/branding/evento', { tipo: 'peca-aprovada', dados: { tema: 'API' } });
    expect((await api('GET', '/api/branding')).dados.eventos).toBe(1);
    expect((await api('POST', '/api/branding/evento', { tipo: 'invasao', dados: {} })).status).toBe(400);
  });
});

describe('roubar ideias', () => {
  it('recebe a referência, analisa em tarefa e gera sugestões marcadas', async () => {
    ia.respostas.push(JSON.stringify({ resumo: 'Meme do erro.', estrutura: { gancho: 'g', desenvolvimento: 'd', fechamento: 'f' }, ritmo: 'rápido',
      tecnicas: [], humor: [], ideias: [{ titulo: 'Erro no deploy', como_adaptar: 'Personagem reage.', formato: 'video', fala_sugerida: 'Bora testar?' }] }));
    const r = await fetch(`${base}/api/referencias`, { method: 'POST', body: new Uint8Array([1, 2, 3]),
      headers: { 'x-nome': encodeURIComponent('meme engraçado.png') } });
    const { tarefa, pasta } = await r.json();
    expect(pasta).toMatch(/^referencias\//);
    let t = tarefa;
    for (let i = 0; i < 50 && t.estado !== 'pronta' && t.estado !== 'erro'; i++) {
      await new Promise((ok) => setTimeout(ok, 20));
      t = (await api('GET', `/api/tarefas/${t.id}`)).dados;
    }
    expect(t.estado).toBe('pronta');
    expect((await api('GET', '/api/referencias')).dados.referencias[0]).toMatchObject({ pasta });
    expect((await api('GET', '/api/sugestoes')).dados.sugestoes[0]).toMatchObject({ titulo: 'Erro no deploy', origem: 'referencia' });
    expect(await readFile(path.join(raiz, pasta, 'analise.md'), 'utf8')).toMatch(/referência/i);
  });

  it('lista meus vídeos e gera a prévia da técnica num deles', async () => {
    await mkdir(path.join(saida, 'videos'), { recursive: true });
    await writeFile(path.join(saida, 'videos', 'meu.mp4'), 'mp4');
    const videos = (await api('GET', '/api/videos')).dados.videos;
    expect(videos).toEqual([expect.objectContaining({ nome: 'meu.mp4' })]);
    const r = await api('POST', '/api/referencias/previa', { video: videos[0].caminho, efeito: 'zoom', inicio: 2 });
    expect(chamadasMotor).toContain('tecnica:zoom');
    expect((await fetch(base + r.dados.video)).status).toBe(200);
    expect((await api('POST', '/api/referencias/previa', { video: '../fora.mp4', efeito: 'zoom' })).status).toBe(400);
    expect((await api('POST', '/api/referencias/previa', { video: videos[0].caminho, efeito: 'explodir-tudo' })).status).toBe(400);
  });

  it('recusa formato que não sabe analisar', async () => {
    const r = await fetch(`${base}/api/referencias`, { method: 'POST', body: new Uint8Array([1]), headers: { 'x-nome': 'programa.exe' } });
    expect(r.status).toBe(400);
  });
});
