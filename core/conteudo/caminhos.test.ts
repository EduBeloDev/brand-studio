import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ErroConteudo, nomeSeguro, normalizar, resolver } from './caminhos.ts';

describe('normalizar', () => {
  it('aceita caminhos relativos e padroniza barras', () => {
    expect(normalizar('ideias/api/roteiro.md')).toBe('ideias/api/roteiro.md');
    expect(normalizar('/ideias//api/')).toBe('ideias/api');
    expect(normalizar('ideias\\api')).toBe('ideias/api');
    expect(normalizar('./ideias/./api')).toBe('ideias/api');
    expect(normalizar('')).toBe('');
  });

  it('recusa sair da pasta de conteúdo e caracteres perigosos', () => {
    for (const ruim of ['../fora', 'ideias/../../fora', 'a/\0b']) {
      expect(() => normalizar(ruim)).toThrowError(ErroConteudo);
    }
  });
});

describe('resolver', () => {
  it('devolve o caminho absoluto dentro da raiz', () => {
    expect(resolver('/raiz', 'ideias/x.md')).toBe(path.join('/raiz', 'ideias', 'x.md'));
    expect(resolver('/raiz', '')).toBe(path.join('/raiz'));
  });

  it('marca o erro com um código que a API traduz', () => {
    try {
      resolver('/raiz', '../etc/passwd');
      expect.unreachable();
    } catch (erro) {
      expect((erro as ErroConteudo).codigo).toBe('caminho-invalido');
    }
  });
});

describe('nomeSeguro', () => {
  it('limpa espaços e aceita acentos', () => {
    expect(nomeSeguro('  Roteiro da API  ')).toBe('Roteiro da API');
    expect(nomeSeguro('ação.md')).toBe('ação.md');
  });

  it('recusa nomes que viram caminho, ocultos ou vazios', () => {
    for (const ruim of ['', '   ', 'a/b', 'a\\b', '..', '.', '.oculto', 'tab\tnome']) {
      expect(() => nomeSeguro(ruim)).toThrowError(ErroConteudo);
    }
  });
});
