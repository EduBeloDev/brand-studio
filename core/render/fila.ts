/** Fila de tarefas longas (vídeo, carrossel, análise de referência): uma por vez, com progresso visível na tela. */

export type EstadoTarefa = 'fila' | 'rodando' | 'pronta' | 'erro';
export interface Tarefa {
  id: string;
  tipo: string;
  titulo: string;
  estado: EstadoTarefa;
  progresso: string;
  saida?: string;
  erro?: string;
  criadaEm: string;
  terminadaEm?: string;
}
export type Executor = (entrada: unknown, progredir: (texto: string) => void) => Promise<string>;

export class Fila {
  private executores: Record<string, Executor>;
  private tarefas = new Map<string, Tarefa>();
  private entradas = new Map<string, unknown>();
  private pendentes: string[] = [];
  private ocupada = false;
  private esperas = new Map<string, ((t: Tarefa) => void)[]>();

  constructor(executores: Record<string, Executor>) {
    this.executores = executores;
  }

  adicionar(tipo: string, titulo: string, entrada: unknown): Tarefa {
    if (!this.executores[tipo]) throw new Error(`Não conheço esse tipo de tarefa: "${tipo}".`);
    const t: Tarefa = { id: globalThis.crypto.randomUUID(), tipo, titulo, estado: 'fila', progresso: 'na fila', criadaEm: new Date().toISOString() };
    this.tarefas.set(t.id, t);
    this.entradas.set(t.id, entrada);
    this.pendentes.push(t.id);
    void this.processar();
    return { ...t };
  }

  obter(id: string): Tarefa | undefined {
    const t = this.tarefas.get(id);
    return t ? { ...t } : undefined;
  }

  listar(): Tarefa[] {
    return [...this.tarefas.values()].reverse().map((t) => ({ ...t }));
  }

  aguardar(id: string): Promise<Tarefa> {
    const t = this.tarefas.get(id);
    if (!t) return Promise.reject(new Error('Tarefa não encontrada.'));
    if (t.estado === 'pronta' || t.estado === 'erro') return Promise.resolve({ ...t });
    return new Promise((ok) => this.esperas.set(id, [...(this.esperas.get(id) ?? []), ok]));
  }

  private async processar() {
    if (this.ocupada) return;
    this.ocupada = true;
    while (this.pendentes.length) {
      const id = this.pendentes.shift()!;
      const t = this.tarefas.get(id)!;
      t.estado = 'rodando';
      t.progresso = 'começando';
      try {
        t.saida = await this.executores[t.tipo]!(this.entradas.get(id), (texto) => { t.progresso = texto; });
        t.estado = 'pronta';
      } catch (e) {
        t.estado = 'erro';
        t.erro = (e as Error).message;
      }
      t.terminadaEm = new Date().toISOString();
      this.entradas.delete(id);
      for (const ok of this.esperas.get(id) ?? []) ok({ ...t });
      this.esperas.delete(id);
    }
    this.ocupada = false;
  }
}
