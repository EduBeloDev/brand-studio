import { CATALOGO } from '../quadro/quadro.ts';

/** Modelos de slide do carrossel. A IA preenche os campos; o motor em Python desenha cada modelo. */

export interface CampoModelo {
  chave: string;
  rotulo: string;
  tipo: 'texto' | 'texto-longo' | 'codigo' | 'lista' | 'demo' | 'expressao';
  obrigatorio: boolean;
  max?: number;
  dica?: string;
}
export interface ModeloSlide {
  id: string;
  nome: string;
  descricao: string;
  campos: CampoModelo[];
}

const destaque = 'Use *asteriscos* para destacar uma palavra em amarelo.';

export const MODELOS: ModeloSlide[] = [
  { id: 'capa', nome: 'Capa', descricao: 'Primeiro slide: promessa clara e personagem.', campos: [
    { chave: 'selo', rotulo: 'Selo', tipo: 'texto', obrigatorio: false, max: 40 },
    { chave: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, max: 90, dica: destaque },
    { chave: 'personagem', rotulo: 'Personagem', tipo: 'expressao', obrigatorio: false }] },
  { id: 'mito-verdade', nome: 'Mito e verdade', descricao: 'Mito rachado em cima, verdade inteira embaixo.', campos: [
    { chave: 'rotulo', rotulo: 'Rótulo', tipo: 'texto', obrigatorio: false, max: 24 },
    { chave: 'mito', rotulo: 'Mito', tipo: 'texto', obrigatorio: true, max: 100 },
    { chave: 'verdade', rotulo: 'Verdade', tipo: 'texto-longo', obrigatorio: true, max: 220, dica: destaque },
    { chave: 'demo', rotulo: 'Demonstração', tipo: 'demo', obrigatorio: false }] },
  { id: 'explicacao', nome: 'Explicação', descricao: 'Título, texto curto e uma demonstração opcional.', campos: [
    { chave: 'rotulo', rotulo: 'Rótulo', tipo: 'texto', obrigatorio: false, max: 24 },
    { chave: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, max: 90, dica: destaque },
    { chave: 'texto', rotulo: 'Texto', tipo: 'texto-longo', obrigatorio: true, max: 240 },
    { chave: 'demo', rotulo: 'Demonstração', tipo: 'demo', obrigatorio: false },
    { chave: 'personagem', rotulo: 'Personagem', tipo: 'expressao', obrigatorio: false }] },
  { id: 'comparacao', nome: 'Comparação', descricao: 'Dois lados lado a lado.', campos: [
    { chave: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, max: 90 },
    { chave: 'esquerda_titulo', rotulo: 'Lado esquerdo: título', tipo: 'texto', obrigatorio: true, max: 30 },
    { chave: 'esquerda_texto', rotulo: 'Lado esquerdo: texto', tipo: 'texto-longo', obrigatorio: true, max: 140 },
    { chave: 'direita_titulo', rotulo: 'Lado direito: título', tipo: 'texto', obrigatorio: true, max: 30 },
    { chave: 'direita_texto', rotulo: 'Lado direito: texto', tipo: 'texto-longo', obrigatorio: true, max: 140 }] },
  { id: 'codigo', nome: 'Código', descricao: 'Um trecho de código numa janela, com explicação.', campos: [
    { chave: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, max: 90 },
    { chave: 'codigo', rotulo: 'Código', tipo: 'codigo', obrigatorio: true, max: 500 },
    { chave: 'explicacao', rotulo: 'Explicação', tipo: 'texto-longo', obrigatorio: false, max: 200 }] },
  { id: 'passos', nome: 'Passos', descricao: 'Lista de até 5 passos.', campos: [
    { chave: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, max: 90 },
    { chave: 'itens', rotulo: 'Passos (um por linha)', tipo: 'lista', obrigatorio: true, max: 5 }] },
  { id: 'fechamento', nome: 'Fechamento', descricao: 'Último slide: chamada e personagem.', campos: [
    { chave: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, max: 90, dica: destaque },
    { chave: 'selo', rotulo: 'Selo', tipo: 'texto', obrigatorio: false, max: 40 },
    { chave: 'personagem', rotulo: 'Personagem', tipo: 'expressao', obrigatorio: false }] },
];

export function modeloPorId(id: string): ModeloSlide | undefined {
  return MODELOS.find((m) => m.id === id);
}

export function esbocoCampos(id: string): Record<string, string> {
  return Object.fromEntries((modeloPorId(id)?.campos ?? []).map((c) => [c.chave, '']));
}

export function validarCampos(id: string, campos: Record<string, unknown>) {
  const modelo = modeloPorId(id);
  if (!modelo) return { ok: false, erros: [`Modelo de slide desconhecido: "${id}".`], campos: {} as Record<string, string> };
  const erros: string[] = [];
  const limpos: Record<string, string> = {};
  for (const c of modelo.campos) {
    let v = String(campos[c.chave] ?? '').trim();
    if (c.tipo === 'lista') {
      const itens = v.split('\n').map((x) => x.trim()).filter(Boolean);
      if (c.max && itens.length > c.max) erros.push(`${c.rotulo}: no máximo ${c.max} itens.`);
      v = itens.join('\n');
    } else if (c.max && v.length > c.max) {
      erros.push(`${c.rotulo}: no máximo ${c.max} caracteres (tem ${v.length}).`);
    }
    if (c.obrigatorio && !v) erros.push(`${c.rotulo} é obrigatório.`);
    if (v && c.tipo === 'demo' && !(CATALOGO.demos as readonly string[]).includes(v)) erros.push(`Demonstração desconhecida: "${v}".`);
    if (v && c.tipo === 'expressao' && !(CATALOGO.expressoes as readonly string[]).includes(v)) {
      erros.push(`Expressão do personagem desconhecida: "${v}".`);
    }
    limpos[c.chave] = v;
  }
  return { ok: erros.length === 0, erros, campos: limpos };
}
