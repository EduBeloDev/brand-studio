import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  anexar,
  criarNota,
  criarPasta,
  esvaziarLixeira,
  excluir,
  lerBinario,
  lerTexto,
  listarArquivos,
  listarArvore,
  listarLixeira,
  mover,
  renomear,
  restaurar,
  salvarTexto,
  tipoDe,
} from './cofre.ts';

let raiz: string;
const existe = (rel: string) => stat(path.join(raiz, rel)).then(() => true, () => false);

beforeEach(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), 'cofre-'));
});
afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

describe('tipos de arquivo', () => {
  it('reconhece nota, quadro e anexo pelo nome', () => {
    expect(tipoDe('roteiro.md')).toBe('nota');
    expect(tipoDe('video.quadro.json')).toBe('quadro');
    expect(tipoDe('foto.png')).toBe('anexo');
    expect(tipoDe('dados.json')).toBe('anexo');
  });
});

describe('árvore', () => {
  it('lista pastas antes de arquivos, em ordem alfabética, sem itens ocultos', async () => {
    await criarPasta(raiz, 'ideias/api');
    await criarNota(raiz, 'ideias/api/roteiro', '# API');
    await criarNota(raiz, 'ideias/Bloco');
    await criarPasta(raiz, 'branding');
    await mkdir(path.join(raiz, '.estudio'));
    await writeFile(path.join(raiz, '.oculto.md'), 'x');
    const arvore = await listarArvore(raiz);
    expect(arvore.map((i) => i.nome)).toEqual(['branding', 'ideias']);
    const ideias = arvore[1]!;
    expect(ideias.tipo).toBe('pasta');
    expect(ideias.filhos!.map((i) => `${i.tipo}:${i.nome}`)).toEqual(['pasta:api', 'nota:Bloco.md']);
    expect(ideias.filhos![0]!.filhos![0]!.caminho).toBe('ideias/api/roteiro.md');
  });

  it('lista todos os arquivos em sequência, para ligações e grafo', async () => {
    await criarNota(raiz, 'a/b/nota');
    await anexar(raiz, 'a', 'foto.png', new Uint8Array([1, 2]));
    const arquivos = await listarArquivos(raiz);
    expect(arquivos).toEqual([
      { caminho: 'a/b/nota.md', tipo: 'nota' },
      { caminho: 'a/foto.png', tipo: 'anexo' },
    ]);
  });
});

describe('criar, ler e salvar', () => {
  it('cria nota com .md e pastas intermediárias, e não sobrescreve', async () => {
    const caminho = await criarNota(raiz, 'novas/ideia', 'texto');
    expect(caminho).toBe('novas/ideia.md');
    expect(await lerTexto(raiz, caminho)).toBe('texto');
    await expect(criarNota(raiz, 'novas/ideia.md')).rejects.toMatchObject({ codigo: 'ja-existe' });
  });

  it('cria pasta e recusa repetida', async () => {
    expect(await criarPasta(raiz, 'branding/identidade')).toBe('branding/identidade');
    await expect(criarPasta(raiz, 'branding/identidade')).rejects.toMatchObject({ codigo: 'ja-existe' });
  });

  it('salva só notas e quadros que existem', async () => {
    await criarNota(raiz, 'n');
    await salvarTexto(raiz, 'n.md', 'novo');
    expect(await lerTexto(raiz, 'n.md')).toBe('novo');
    await expect(salvarTexto(raiz, 'nao.md', 'x')).rejects.toMatchObject({ codigo: 'nao-encontrado' });
    await anexar(raiz, '', 'img.png', new Uint8Array([1]));
    await expect(salvarTexto(raiz, 'img.png', 'x')).rejects.toMatchObject({ codigo: 'tipo-invalido' });
  });

  it('não lê pasta como texto', async () => {
    await criarPasta(raiz, 'p');
    await expect(lerTexto(raiz, 'p')).rejects.toMatchObject({ codigo: 'tipo-invalido' });
  });
});

describe('renomear', () => {
  it('mantém a extensão e atualiza as ligações [[nome]] nas outras notas', async () => {
    await criarNota(raiz, 'api', '# API');
    await criarNota(raiz, 'roteiro', 'Veja [[api]] e [[api|o balcão]] e [[API#Resumo]].');
    const novo = await renomear(raiz, 'api.md', 'balcao');
    expect(novo).toBe('balcao.md');
    expect(await existe('api.md')).toBe(false);
    expect(await lerTexto(raiz, 'roteiro.md')).toBe('Veja [[balcao]] e [[balcao|o balcão]] e [[balcao#Resumo]].');
  });

  it('atualiza os quadros que usam o arquivo como fonte ou anexo', async () => {
    await anexar(raiz, '', 'foto.png', new Uint8Array([1]));
    const quadro = { versao: 1, tipo: 'video', nome: 'Q', instrucoes: '', legenda: false,
      cartoes: [{ id: 'c1', tipo: 'fala', x: 0, y: 0, instrucoes: '', campos: {}, anexos: ['foto.png'] }],
      conexoes: [], fontes: [{ caminho: 'foto.png', ativo: true }] };
    await writeFile(path.join(raiz, 'q.quadro.json'), JSON.stringify(quadro));
    await renomear(raiz, 'foto.png', 'capa.png');
    const lido = JSON.parse(await lerTexto(raiz, 'q.quadro.json'));
    expect(lido.cartoes[0].anexos).toEqual(['capa.png']);
    expect(lido.fontes[0].caminho).toBe('capa.png');
  });

  it('recusa nome que já existe na pasta', async () => {
    await criarNota(raiz, 'a');
    await criarNota(raiz, 'b');
    await expect(renomear(raiz, 'a.md', 'b')).rejects.toMatchObject({ codigo: 'ja-existe' });
  });
});

describe('mover', () => {
  it('move vários itens, ganha sufixo quando o nome já existe e devolve os novos caminhos', async () => {
    await criarPasta(raiz, 'destino');
    await criarNota(raiz, 'destino/nota');
    await criarNota(raiz, 'nota');
    await criarPasta(raiz, 'pasta');
    const novos = await mover(raiz, ['nota.md', 'pasta'], 'destino');
    expect(novos).toEqual({ 'nota.md': 'destino/nota (2).md', pasta: 'destino/pasta' });
    expect(await existe('destino/nota (2).md')).toBe(true);
  });

  it('não deixa mover uma pasta para dentro dela mesma', async () => {
    await criarPasta(raiz, 'a/b');
    await expect(mover(raiz, ['a'], 'a/b')).rejects.toMatchObject({ codigo: 'destino-invalido' });
  });

  it('move para a raiz com destino vazio e recusa destino que não é pasta', async () => {
    await criarNota(raiz, 'p/n');
    expect(await mover(raiz, ['p/n.md'], '')).toEqual({ 'p/n.md': 'n.md' });
    await expect(mover(raiz, ['n.md'], 'n.md')).rejects.toMatchObject({ codigo: 'destino-invalido' });
  });

  it('atualiza caminhos dentro dos quadros', async () => {
    await criarPasta(raiz, 'arquivo');
    await criarNota(raiz, 'fonte');
    await writeFile(path.join(raiz, 'q.quadro.json'), JSON.stringify({ versao: 1, tipo: 'carrossel', nome: 'Q',
      instrucoes: '', legenda: false, cartoes: [], conexoes: [], fontes: [{ caminho: 'fonte.md', ativo: true }] }));
    await mover(raiz, ['fonte.md'], 'arquivo');
    expect(JSON.parse(await lerTexto(raiz, 'q.quadro.json')).fontes[0].caminho).toBe('arquivo/fonte.md');
  });
});

describe('lixeira', () => {
  it('excluir manda para a lixeira com a origem anotada, e restaurar devolve', async () => {
    await criarNota(raiz, 'ideias/x', 'conteúdo');
    const [id] = await excluir(raiz, ['ideias/x.md']);
    expect(await existe('ideias/x.md')).toBe(false);
    const itens = await listarLixeira(raiz);
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ id, nome: 'x.md', origem: 'ideias/x.md', tipo: 'nota' });
    expect(await restaurar(raiz, id!)).toBe('ideias/x.md');
    expect(await lerTexto(raiz, 'ideias/x.md')).toBe('conteúdo');
    expect(await listarLixeira(raiz)).toHaveLength(0);
  });

  it('restaurar recria a pasta de origem e ganha sufixo se o nome voltou a existir', async () => {
    await criarNota(raiz, 'p/n');
    const [id] = await excluir(raiz, ['p']);
    await criarNota(raiz, 'p/n');
    expect(await restaurar(raiz, id!)).toBe('p (2)');
  });

  it('esvaziar apaga de vez só o que está na lixeira', async () => {
    await criarNota(raiz, 'a');
    await criarNota(raiz, 'b');
    await excluir(raiz, ['a.md']);
    expect(await esvaziarLixeira(raiz)).toBe(1);
    expect(await listarLixeira(raiz)).toHaveLength(0);
    expect(await existe('b.md')).toBe(true);
  });

  it('erro claro ao restaurar id desconhecido', async () => {
    await expect(restaurar(raiz, 'nao-existe')).rejects.toMatchObject({ codigo: 'nao-encontrado' });
  });
});

describe('anexos', () => {
  it('guarda o arquivo na pasta, limpa o nome e não sobrescreve', async () => {
    await criarPasta(raiz, 'ideias');
    const a = await anexar(raiz, 'ideias', '../../evil/foto.png', new Uint8Array([7, 8, 9]));
    expect(a).toBe('ideias/foto.png');
    const b = await anexar(raiz, 'ideias', 'foto.png', new Uint8Array([1]));
    expect(b).toBe('ideias/foto (2).png');
    expect([...(await lerBinario(raiz, a))]).toEqual([7, 8, 9]);
    expect([...(await readFile(path.join(raiz, b)))]).toEqual([1]);
  });

  it('recusa anexar fora de uma pasta existente', async () => {
    await expect(anexar(raiz, 'nao-existe', 'a.png', new Uint8Array([1]))).rejects.toMatchObject({ codigo: 'nao-encontrado' });
  });
});
