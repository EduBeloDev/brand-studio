/** Seleção da barra lateral: um conjunto de caminhos. Selecionar uma pasta seleciona o que está dentro dela. */

export function alternar(s: Set<string>, caminho: string): Set<string> {
  const novo = new Set(s);
  if (novo.has(caminho)) novo.delete(caminho);
  else novo.add(caminho);
  return novo;
}

export function estaSelecionado(s: Set<string>, caminho: string): boolean {
  if (s.has(caminho)) return true;
  for (const c of s) if (caminho.startsWith(c + '/')) return true;
  return false;
}

/** Shift + clique: seleciona tudo entre o último clicado e o atual, na ordem da lista visível. */
export function selecionarIntervalo(s: Set<string>, lista: string[], de: string, ate: string): Set<string> {
  const i = lista.indexOf(de);
  const j = lista.indexOf(ate);
  if (i < 0 || j < 0) return alternar(s, ate);
  const novo = new Set(s);
  for (const c of lista.slice(Math.min(i, j), Math.max(i, j) + 1)) novo.add(c);
  return novo;
}

/** Para mover ou excluir em lote: tira quem já está dentro de uma pasta selecionada. */
export function raizesDaSelecao(s: Set<string>): string[] {
  const todos = [...s].sort();
  return todos.filter((c) => !todos.some((o) => o !== c && c.startsWith(o + '/')));
}
