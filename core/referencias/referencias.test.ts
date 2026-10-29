import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prepararMemoria } from '../branding/memoria.ts';
import { lerFrente } from '../conteudo/ligacoes.ts';
import { IAFalsa } from '../ia/ia.ts';
import {
  analisarReferencia,
  classificarMidia,
  extrairMidia,
  gravarAnalise,
  promptAnalise,
  trechoCopiado,
  validarAnalise,
  type Extracao,
} from './referencias.ts';

let raiz: string;
beforeEach(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), 'ref-'));
  await prepararMemoria(raiz);
});
afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

const extracao: Extracao = {
  tipo: 'video', duracao: 30, largura: 1080, altura: 1920, cortes: [2, 4.5, 9, 15], quadros: ['quadro-1.jpg'],
  transcricao: 'hoje eu vou te mostrar o maior erro que todo programador iniciante comete quando sobe o projeto',
  palavras: 18, cores: ['#1a1030', '#ffcc33'],
};

describe('classificação', () => {
  it('reconhece vídeo, áudio, imagem e texto pela extensão', () => {
    expect(classificarMidia('a.MP4')).toBe('video');
    expect(classificarMidia('a.mov')).toBe('video');
    expect(classificarMidia('a.mp3')).toBe('audio');
    expect(classificarMidia('a.ogg')).toBe('audio');
    expect(classificarMidia('a.jpeg')).toBe('imagem');
    expect(classificarMidia('a.txt')).toBe('texto');
    expect(classificarMidia('a.exe')).toBeNull();
  });
});

describe('trava contra cópia', () => {
  it('acha 8 ou mais palavras iguais seguidas, ignorando maiúsculas e pontuação', () => {
    expect(trechoCopiado('Olha: o MAIOR erro que todo programador iniciante comete quando sobe!', extracao.transcricao!)).toBe(true);
    expect(trechoCopiado('Um erro comum de quem começa é subir o projeto sem revisar.', extracao.transcricao!)).toBe(false);
  });
});

describe('prompt de análise', () => {
  it('deixa claro que é referência e não cópia, e manda a marca e os dados extraídos', () => {
    const p = promptAnalise(extracao, '# Marca Teste', 'referencias/x');
    expect(p.sistema).toMatch(/refer[êe]ncia/i);
    expect(p.sistema).toMatch(/não copi/i);
    expect(p.prompt).toMatch(/Marca Teste/);
    expect(p.prompt).toMatch(/quadro-1\.jpg/);
    expect(p.prompt).toMatch(/maior erro/);
    expect(p.leitura).toBe('referencias/x');
  });
});

describe('validarAnalise', () => {
  it('mantém ideias adaptadas e descarta as que copiam a fala original', () => {
    const r = validarAnalise({
      resumo: 'Vídeo de erro comum.', estrutura: { gancho: 'pergunta forte', desenvolvimento: 'lista', fechamento: 'chamada' },
      ritmo: 'corte a cada 3 s', tecnicas: [{ nome: 'zoom no erro', tipo: 'transicao', como_usar: 'zoom quando o erro aparece', efeito_proximo: 'zoom' },
        { nome: 'tela rasgando', tipo: 'transicao', como_usar: 'x', efeito_proximo: 'rasgo' }],
      humor: ['exagero da reação'], ideias: [
        { titulo: 'O erro do deploy', como_adaptar: 'Personagem da marca reage ao deploy quebrado.', formato: 'video', fala_sugerida: 'Subiu sem testar? Bora ver.' },
        { titulo: 'Cópia', como_adaptar: 'x', formato: 'video', fala_sugerida: 'o maior erro que todo programador iniciante comete quando sobe o projeto' },
      ],
    }, extracao);
    expect(r.ideias.map((i) => i.titulo)).toEqual(['O erro do deploy']);
    expect(r.descartadas).toBe(1);
    expect(r.tecnicas[0]).toMatchObject({ tipo: 'transicao', efeito_proximo: 'zoom' });
    expect(r.tecnicas[1]!.efeito_proximo).toBe('dissolucao');
  });
});

describe('gravarAnalise', () => {
  it('escreve a análise, as técnicas e as sugestões marcadas como vindas de referência', async () => {
    const analise = validarAnalise({ resumo: 'Resumo.', estrutura: { gancho: 'g', desenvolvimento: 'd', fechamento: 'f' }, ritmo: 'rápido',
      tecnicas: [{ nome: 'Zoom no erro', tipo: 'transicao', como_usar: 'quando o erro aparece' }], humor: [],
      ideias: [{ titulo: 'Deploy sem teste', como_adaptar: 'Personagem reage.', formato: 'carrossel', fala_sugerida: 'Bora testar?' }] }, extracao);
    const r = await gravarAnalise(raiz, 'referencias/video-erro', analise, extracao, new Date('2026-10-29T10:00:00'));
    const nota = await readFile(path.join(raiz, 'referencias/video-erro/analise.md'), 'utf8');
    expect(lerFrente(nota).dados).toMatchObject({ tipo: 'referencia', midia: 'video' });
    expect(nota).toMatch(/Só referência/i);
    expect(nota).toMatch(/\[\[zoom-no-erro\]\]/);
    const tecnica = await readFile(path.join(raiz, 'conhecimento/tecnicas/zoom-no-erro.md'), 'utf8');
    expect(tecnica).toMatch(/sugestão/i);
    const sugestao = await readFile(path.join(raiz, 'conhecimento/sugestoes/deploy-sem-teste.md'), 'utf8');
    expect(lerFrente(sugestao).dados).toMatchObject({ origem: 'referencia', formato: 'carrossel' });
    expect(r.criadas.length).toBe(3);
  });
});

describe('extração real com ffmpeg', () => {
  it('lê duração, tamanho, cortes e quadros-chave de um vídeo gerado na hora', async () => {
    const video = path.join(raiz, 'teste.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=320x240:d=1', '-f', 'lavfi', '-i',
      'color=c=blue:s=320x240:d=1', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]',
      '-map', '[v]', '-map', '2:a', '-shortest', video]);
    const pasta = path.join(raiz, 'extracao');
    const e = await extrairMidia(video, pasta, { transcrever: async () => ({ texto: '', palavras: 0 }) });
    expect(e.tipo).toBe('video');
    expect(e.duracao).toBeGreaterThan(1.8);
    expect(e).toMatchObject({ largura: 320, altura: 240 });
    expect(e.cortes.some((t) => t > 0.8 && t < 1.2)).toBe(true);
    expect(e.quadros.length).toBeGreaterThanOrEqual(2);
    expect(e.cores.length).toBeGreaterThan(0);
  }, 60_000);
});

describe('analisarReferencia', () => {
  it('extrai, chama a IA com leitura só da pasta e grava tudo', async () => {
    const ia = new IAFalsa([JSON.stringify({ resumo: 'r', estrutura: { gancho: 'g', desenvolvimento: 'd', fechamento: 'f' }, ritmo: 'x',
      tecnicas: [], humor: [], ideias: [{ titulo: 'Ideia', como_adaptar: 'Adaptar.', formato: 'video', fala_sugerida: 'Nova fala.' }] })]);
    const r = await analisarReferencia(raiz, 'referencias/img/original.png', ia, {
      extrair: async () => ({ ...extracao, tipo: 'imagem', duracao: 0, cortes: [], transcricao: '', palavras: 0 }),
      agora: new Date('2026-10-29T10:00:00'),
    });
    expect(ia.pedidos[0]!.leitura).toBe('referencias/img');
    expect(r.analise).toBe('referencias/img/analise.md');
    expect(r.sugestoes).toEqual(['conhecimento/sugestoes/ideia.md']);
  });
});
