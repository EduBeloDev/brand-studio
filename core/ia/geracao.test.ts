import { describe, expect, it } from 'vitest';
import { conectar, novoCartao, novoQuadro, ordenarCarrossel, ordenarVideo, type Quadro } from '../quadro/quadro.ts';
import { gerarFala, gerarSlide, montarContexto, quadroDeSugestao } from './geracao.ts';
import { ErroIA, IAFalsa } from './ia.ts';

const contexto = { marca: '# Identidade\nRoxo e amarelo, humor leve.', fontes: [{ caminho: 'ideias/api.md', texto: 'API é o balcão.' }] };

function carrossel(campos: Record<string, string> = {}): Quadro {
  const q = novoQuadro('carrossel', 'Carrossel API');
  const s = { ...novoCartao('slide', 0, 0, campos), id: 's1', instrucoes: 'Explique com uma analogia de restaurante.' };
  return { ...q, instrucoes: 'Público iniciante.', cartoes: [s] };
}

describe('montarContexto', () => {
  it('junta marca e fontes com títulos e respeita o limite', () => {
    const texto = montarContexto(contexto, 10_000);
    expect(texto).toMatch(/Identidade/);
    expect(texto).toMatch(/ideias\/api\.md/);
    expect(montarContexto({ marca: 'x'.repeat(5000), fontes: [{ caminho: 'a', texto: 'y'.repeat(5000) }] }, 1000).length).toBeLessThanOrEqual(1000);
  });
});

describe('regras de escrita', () => {
  it('pede a grafia normal em todo texto (a pronúncia da narração é aplicada pelo app)', async () => {
    const ia = new IAFalsa([JSON.stringify({ modelo: 'capa', campos: { titulo: 'API sem mistério' } })]);
    await gerarSlide(ia, carrossel(), 's1', contexto);
    expect(ia.pedidos[0]!.sistema).toMatch(/grafia normal/);
  });

  it('não fixa o nome de uma marca: a marca vem da memória', async () => {
    const ia = new IAFalsa([JSON.stringify({ modelo: 'capa', campos: { titulo: 'API sem mistério' } })]);
    await gerarSlide(ia, carrossel(), 's1', contexto);
    expect(ia.pedidos[0]!.sistema).toMatch(/memória da marca/);
  });
});

describe('gerarSlide', () => {
  it('a IA escolhe o modelo quando o slide não tem um, e o resultado é validado', async () => {
    const ia = new IAFalsa([JSON.stringify({ modelo: 'comparacao', campos: { titulo: 'API x Cozinha', esquerda_titulo: 'Balcão',
      esquerda_texto: 'Recebe o pedido', direita_titulo: 'Cozinha', direita_texto: 'Prepara' } })]);
    const r = await gerarSlide(ia, carrossel(), 's1', contexto);
    expect(r.modelo).toBe('comparacao');
    expect(r.campos.titulo).toBe('API x Cozinha');
    const p = ia.pedidos[0]!;
    expect(p.prompt).toMatch(/restaurante/);
    expect(p.prompt).toMatch(/Público iniciante/);
    expect(p.prompt).toMatch(/API é o balcão/);
    expect(p.prompt).toMatch(/Roxo e amarelo/);
    expect(p.prompt).toMatch(/mito-verdade/);
    expect(p.web).toBeFalsy();
  });

  it('com modelo escolhido, pede só aquele modelo', async () => {
    const ia = new IAFalsa([JSON.stringify({ modelo: 'capa', campos: { titulo: 'API sem mistério' } })]);
    const r = await gerarSlide(ia, carrossel({ modelo: 'capa' }), 's1', contexto);
    expect(r).toMatchObject({ modelo: 'capa', campos: { titulo: 'API sem mistério' } });
    expect(ia.pedidos[0]!.prompt).toMatch(/modelo "capa"/);
  });

  it('se a IA erra, pede de novo com o erro; se errar outra vez, falha com mensagem clara', async () => {
    const ok = new IAFalsa([JSON.stringify({ modelo: 'capa', campos: {} }), JSON.stringify({ modelo: 'capa', campos: { titulo: 'Agora sim' } })]);
    expect((await gerarSlide(ok, carrossel(), 's1', contexto)).campos.titulo).toBe('Agora sim');
    expect(ok.pedidos[1]!.prompt).toMatch(/obrigat/i);
    const ruim = new IAFalsa(['sem json', 'ainda sem json']);
    await expect(gerarSlide(ruim, carrossel(), 's1', contexto)).rejects.toThrowError(ErroIA);
  });

  it('cartão inexistente ou que não é slide é erro', async () => {
    await expect(gerarSlide(new IAFalsa([]), carrossel(), 'nao', contexto)).rejects.toThrowError(/cartão/);
  });
});

describe('gerarFala', () => {
  it('gera fala, texto de tela e expressão, olhando as falas vizinhas', async () => {
    let q = novoQuadro('video', 'V');
    const a = { ...novoCartao('fala', 0, 0, { fala: 'API é o balcão do restaurante.' }), id: 'a' };
    const b = { ...novoCartao('fala', 300, 0), id: 'b', instrucoes: 'Explique o que a cozinha faz.' };
    q = conectar({ ...q, cartoes: [a, b] }, 'a', 'b');
    const ia = new IAFalsa([JSON.stringify({ fala: 'A cozinha prepara o pedido sem você ver.', tela: 'A cozinha *prepara*', expressao: 'ideia' })]);
    const r = await gerarFala(ia, q, 'b', contexto);
    expect(r).toEqual({ fala: 'A cozinha prepara o pedido sem você ver.', tela: 'A cozinha *prepara*', expressao: 'ideia' });
    expect(ia.pedidos[0]!.prompt).toMatch(/balcão do restaurante/);
    expect(ia.pedidos[0]!.prompt).toMatch(/cozinha faz/);
  });

  it('expressão fora do catálogo vira a padrão', async () => {
    const q = { ...novoQuadro('video', 'V'), cartoes: [{ ...novoCartao('fala', 0, 0), id: 'a' }] };
    const ia = new IAFalsa([JSON.stringify({ fala: 'Oi', tela: 'Oi', expressao: 'dançando' })]);
    expect((await gerarFala(ia, q, 'a', contexto)).expressao).toBe('ok');
  });
});

describe('quadroDeSugestao', () => {
  const sugestao = { titulo: 'API é o balcão', texto: 'Explicar API com restaurante.' };

  it('monta um quadro de vídeo pronto para ordenar, com transições e animações presas às falas', async () => {
    const ia = new IAFalsa([JSON.stringify({ nome: 'API é o balcão', instrucoes: 'Tom leve.', cenas: [
      { fala: 'Já pediu comida num restaurante?', tela: 'Já pediu *comida*?', expressao: 'pensativo', transicao: 'dissolucao' },
      { fala: 'A API é o balcão.', tela: 'API = *balcão*', expressao: 'ideia', animacoes: [{ efeito: 'demonstracao', demo: 'codigo',
        codigo: 'fetch("/pedido")', saida: '200 OK' }], transicao: 'glitch' },
      { fala: 'Até a próxima, Marca Teste.', tela: 'Salva e *segue*', expressao: 'joinha' },
    ] })]);
    const q = await quadroDeSugestao(ia, sugestao, 'video', contexto);
    expect(q.tipo).toBe('video');
    expect(q.nome).toBe('API é o balcão');
    const { cenas, problemas } = ordenarVideo(q);
    expect(problemas.filter((p) => p.nivel === 'erro')).toEqual([]);
    expect(cenas.map((c) => c.fala.campos.tela)).toEqual(['Já pediu *comida*?', 'API = *balcão*', 'Salva e *segue*']);
    expect(cenas[0]!.transicao?.campos.efeito).toBe('dissolucao');
    expect(cenas[1]!.animacoes[0]!.campos).toMatchObject({ efeito: 'demonstracao', demo: 'codigo', codigo: 'fetch("/pedido")' });
  });

  it('monta um carrossel com modelos validados e descarta slide inválido', async () => {
    const ia = new IAFalsa([JSON.stringify({ nome: 'API', slides: [
      { modelo: 'capa', campos: { titulo: 'API é o *balcão*' } },
      { modelo: 'inexistente', campos: {} },
      { modelo: 'fechamento', campos: { titulo: 'Até a próxima', selo: 'Marca Teste' } },
    ] })]);
    const q = await quadroDeSugestao(ia, sugestao, 'carrossel', contexto);
    const { slides, problemas } = ordenarCarrossel(q);
    expect(problemas.filter((p) => p.nivel === 'erro')).toEqual([]);
    expect(slides.map((s) => s.campos.modelo)).toEqual(['capa', 'fechamento']);
  });

  it('sem nenhuma cena ou slide válido é erro', async () => {
    await expect(quadroDeSugestao(new IAFalsa([JSON.stringify({ slides: [] })]), sugestao, 'carrossel', contexto)).rejects.toThrowError(ErroIA);
  });
});
