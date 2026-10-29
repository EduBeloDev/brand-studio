import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MARCA_PADRAO, lerMarca } from './marca.ts';
import { contextoDaMarca, prepararMemoria } from './memoria.ts';

let raiz: string;

beforeEach(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), 'marca-nome-'));
});
afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

describe('lerMarca', () => {
  it('sem arquivo, devolve o nome neutro', async () => {
    expect(await lerMarca(raiz)).toEqual(MARCA_PADRAO);
  });

  it('lê o nome de branding/marca.json', async () => {
    await mkdir(path.join(raiz, 'branding'), { recursive: true });
    await writeFile(path.join(raiz, 'branding', 'marca.json'), JSON.stringify({ nome: 'Marca Teste' }));
    expect((await lerMarca(raiz)).nome).toBe('Marca Teste');
  });

  it('JSON quebrado ou nome vazio caem no padrão', async () => {
    await mkdir(path.join(raiz, 'branding'), { recursive: true });
    await writeFile(path.join(raiz, 'branding', 'marca.json'), '{quebrado');
    expect(await lerMarca(raiz)).toEqual(MARCA_PADRAO);
    await writeFile(path.join(raiz, 'branding', 'marca.json'), JSON.stringify({ nome: '  ' }));
    expect(await lerMarca(raiz)).toEqual(MARCA_PADRAO);
  });

  it('prepararMemoria cria marca.json com o nome neutro e o contexto leva o nome', async () => {
    await prepararMemoria(raiz);
    expect(await lerMarca(raiz)).toEqual(MARCA_PADRAO);
    await writeFile(path.join(raiz, 'branding', 'marca.json'), JSON.stringify({ nome: 'Marca Teste' }));
    expect(await contextoDaMarca(raiz)).toMatch(/Marca Teste/);
  });
});

/**
 * Trava: o nome real da marca mora só no computador (conteudo/branding/marca.json, fora do git). Se ele aparecer em
 * algum arquivo versionado, o teste falha. Num clone sem a marca local, não há o que conferir.
 */
describe('a marca local não vai para o git', () => {
  const projeto = path.join(import.meta.dirname, '..', '..');
  const arquivoMarca = path.join(projeto, 'conteudo', 'branding', 'marca.json');
  const nome = existsSync(arquivoMarca) ? String(JSON.parse(readFileSync(arquivoMarca, 'utf8')).nome ?? '').trim() : '';
  const real = nome && nome !== MARCA_PADRAO.nome;

  it.skipIf(!real)('nenhum arquivo versionado cita o nome da marca', () => {
    let achados = '';
    try {
      achados = execFileSync('git', ['grep', '-I', '-i', '-l', '--cached', '-F', nome], { cwd: projeto, encoding: 'utf8' });
    } catch (e) {
      if ((e as { status?: number }).status !== 1) throw e; // 1 = nada encontrado
    }
    expect(achados.trim().split('\n').filter(Boolean)).toEqual([]);
  });

  it.skipIf(!real)('pastas da marca estão no .gitignore', () => {
    for (const p of ['conteudo/branding/marca.json', 'conteudo/quadros/x.quadro.json', 'amostras/personagem/x.png', 'CLAUDE.local.md']) {
      expect(() => execFileSync('git', ['check-ignore', '-q', p], { cwd: projeto }), p).not.toThrow();
    }
  });
});
