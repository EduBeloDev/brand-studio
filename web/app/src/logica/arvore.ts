import type { Item } from '../../../../core/conteudo/cofre.ts';

export interface ItemPlano extends Item {
  nivel: number;
}

export function achatar(itens: Item[], nivel = 0, abertas?: Set<string>): ItemPlano[] {
  const r: ItemPlano[] = [];
  for (const i of itens) {
    r.push({ ...i, nivel });
    if (i.filhos && (!abertas || abertas.has(i.caminho))) r.push(...achatar(i.filhos, nivel + 1, abertas));
  }
  return r;
}

export const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Mantém o que casa com o texto e as pastas do caminho até lá. Texto vazio devolve a própria árvore. */
export function filtrar(itens: Item[], texto: string): Item[] {
  const t = semAcento(texto.trim());
  if (!t) return itens;
  const r: Item[] = [];
  for (const i of itens) {
    const filhos = i.filhos ? filtrar(i.filhos, texto) : [];
    if (filhos.length) r.push({ ...i, filhos });
    else if (semAcento(i.nome).includes(t)) r.push(i.filhos ? { ...i, filhos: [] } : i);
  }
  return r;
}

export function ancestrais(caminho: string): string[] {
  const partes = caminho.split('/');
  return partes.slice(0, -1).map((_, i) => partes.slice(0, i + 1).join('/'));
}

export function pastaDe(caminho: string): string {
  const i = caminho.lastIndexOf('/');
  return i < 0 ? '' : caminho.slice(0, i);
}

/** Nome para mostrar: sem .md e sem .quadro.json. */
export const nomeVisivel = (nome: string) => nome.replace(/\.quadro\.json$/, '').replace(/\.md$/, '');
