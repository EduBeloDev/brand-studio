import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conectar, novoCartao, novoQuadro, ordenarCarrossel, ordenarVideo, type Quadro } from '../quadro/quadro.ts';
import { aplicarPronuncia, criarMotorPython, roteiroParaMotor, slidesParaMotor } from './motor.ts';

const AMOSTRAS = path.join(import.meta.dirname, '..', '..', 'amostras');

async function tamanhoPng(arquivo: string) {
  const b = await readFile(arquivo);
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) };
}

describe('pronúncia', () => {
  const mapa = new Map([['MIT', 'ême í tê'], ['API', 'a pê í'], ['Marca Teste', 'márca tésti']]);

  it('troca palavras inteiras, sem mexer dentro de outras palavras', () => {
    expect(aplicarPronuncia('A licença MIT e a API da Marca Teste.', mapa)).toBe('A licença ême í tê e a a pê í da márca tésti.');
    expect(aplicarPronuncia('APIs e MITIGAR ficam iguais.', mapa)).toBe('APIs e MITIGAR ficam iguais.');
  });
});

describe('conversão para o motor', () => {
  it('leva as cenas com fala para narrar, texto da tela, expressão, transição e animações', () => {
    let q: Quadro = novoQuadro('video', 'V');
    const a = { ...novoCartao('fala', 0, 0, { fala: 'A API é simples.', tela: 'API é *simples*', expressao: 'ideia' }), id: 'a' };
    const b = { ...novoCartao('fala', 300, 0, { fala: 'Tchau.', tela: 'Tchau' }), id: 'b' };
    const t = { ...novoCartao('transicao', 100, 0, { efeito: 'glitch' }), id: 't' };
    const n = { ...novoCartao('animacao', 100, 100, { efeito: 'demonstracao', demo: 'codigo', codigo: 'fetch()', saida: 'ok' }), id: 'n' };
    q = { ...q, legenda: true, cartoes: [a, b, t, n] };
    q = conectar(conectar(conectar(q, 'a', 't'), 't', 'b'), 'a', 'n');
    const r = roteiroParaMotor(q, ordenarVideo(q).cenas, new Map([['API', 'a pê í']]));
    expect(r.legenda).toBe(true);
    expect(r.cenas[0]).toEqual({ fala: 'A a pê í é simples.', legenda: 'A API é simples.', tela: 'API é *simples*', expressao: 'ideia',
      transicao: 'glitch', animacoes: [{ efeito: 'demonstracao', demo: 'codigo', codigo: 'fetch()', saida: 'ok' }] });
    expect(r.cenas[1]).toMatchObject({ expressao: 'ok', transicao: 'dissolucao', animacoes: [] });
  });

  it('leva os slides na ordem com modelo e campos', () => {
    let q: Quadro = novoQuadro('carrossel', 'C');
    const s1 = { ...novoCartao('slide', 0, 0, { modelo: 'capa', titulo: 'Oi' }), id: 's1' };
    const s2 = { ...novoCartao('slide', 300, 0, { modelo: 'fechamento', titulo: 'Tchau', selo: 'Salva' }), id: 's2' };
    q = conectar({ ...q, cartoes: [s2, s1] }, 's1', 's2');
    expect(slidesParaMotor(ordenarCarrossel(q).slides)).toEqual({ slides: [
      { modelo: 'capa', campos: { titulo: 'Oi' } }, { modelo: 'fechamento', campos: { titulo: 'Tchau', selo: 'Salva' } }] });
  });
});

describe('motor em Python (de verdade)', () => {
  let pasta: string;
  const motor = criarMotorPython({ script: path.join(AMOSTRAS, 'estudio_render.py'), cwd: AMOSTRAS });
  beforeAll(async () => {
    pasta = await mkdtemp(path.join(tmpdir(), 'motor-'));
  });
  afterAll(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  it('prévia de cena sai em PNG 1080x1920', async () => {
    const destino = path.join(pasta, 'cena.png');
    const saida = await motor.cena({ tela: 'API é o *balcão*', expressao: 'ideia', animacoes: [
      { efeito: 'demonstracao', demo: 'codigo', codigo: 'fetch("/pedido")', saida: '200 OK' }] }, destino);
    expect(saida).toBe(destino);
    expect(await tamanhoPng(destino)).toEqual({ largura: 1080, altura: 1920 });
  }, 60_000);

  it('slides saem em PNG 1080x1350, com o .zip de todos', async () => {
    const r = await motor.slides({ slides: [
      { modelo: 'capa', campos: { selo: 'Para quem começa', titulo: 'API é o *balcão*', personagem: 'ideia' } },
      { modelo: 'codigo', campos: { titulo: 'Pedindo dados', codigo: 'const r = await fetch("/menu")\nconsole.log(r.status)', explicacao: 'O fetch faz o pedido.' } },
      { modelo: 'fechamento', campos: { titulo: 'Salva e *segue*', selo: 'Marca Teste', personagem: 'joinha' } }] }, path.join(pasta, 'carrossel'));
    expect(r.imagens).toHaveLength(3);
    for (const img of r.imagens) expect(await tamanhoPng(img)).toEqual({ largura: 1080, altura: 1350 });
    const nomes = execFileSync('python3', ['-c', 'import zipfile,sys; print(len(zipfile.ZipFile(sys.argv[1]).namelist()))', r.zip]).toString().trim();
    expect(nomes).toBe('3');
  }, 120_000);

  it('modelo desconhecido volta como erro com mensagem', async () => {
    await expect(motor.slides({ slides: [{ modelo: 'nada', campos: {} }] }, path.join(pasta, 'ruim'))).rejects.toThrowError(/modelo/);
  }, 60_000);

  it('prévia de técnica roubada aplica o efeito num trecho curto de um vídeo existente', async () => {
    const origem = path.join(pasta, 'origem.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=s=1080x1920:d=4:r=30', '-f', 'lavfi', '-i',
      'sine=frequency=330:duration=4', '-shortest', '-pix_fmt', 'yuv420p', origem]);
    const destino = path.join(pasta, 'tecnica.mp4');
    expect(await motor.tecnica({ video: origem, inicio: 1, efeito: 'glitch' }, destino)).toBe(destino);
    const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', destino]).toString());
    expect(dur).toBeGreaterThan(1.5);
    expect(dur).toBeLessThan(5);
  }, 120_000);

  it('vídeo sem voz (rápido) sai em MP4 vertical com áudio de trilha e efeitos', async () => {
    const destino = path.join(pasta, 'video.mp4');
    const progresso: string[] = [];
    const saida = await motor.video({ sem_voz: true, legenda: false, cenas: [
      { fala: 'Primeira cena curta.', legenda: 'Primeira cena curta.', tela: 'Primeira *cena*', expressao: 'ideia', transicao: 'blocos',
        animacoes: [{ efeito: 'bombinha' }] },
      { fala: 'Segunda cena.', legenda: 'Segunda cena.', tela: 'Segunda', expressao: 'joinha', transicao: 'dissolucao',
        animacoes: [{ efeito: 'demonstracao', demo: 'lista', itens: 'entender\ntestar' }] }] }, destino, (t) => progresso.push(t));
    expect(saida).toBe(destino);
    const info = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'csv=p=0', destino]).toString();
    expect(info).toMatch(/video,1080,1920/);
    expect(info).toMatch(/audio/);
    expect(progresso.length).toBeGreaterThan(0);
  }, 300_000);
});
