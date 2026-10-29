import { describe, expect, it } from 'vitest';
import { Fila } from './fila.ts';

describe('Fila de tarefas', () => {
  it('roda uma tarefa por vez, na ordem, com progresso e saída', async () => {
    const ordem: string[] = [];
    const fila = new Fila({
      eco: async (entrada, progredir) => {
        const texto = String((entrada as { texto: string }).texto);
        ordem.push(`inicio ${texto}`);
        progredir(`trabalhando em ${texto}`);
        await new Promise((r) => setTimeout(r, 5));
        ordem.push(`fim ${texto}`);
        return `saida-${texto}`;
      },
    });
    const a = fila.adicionar('eco', 'Primeira', { texto: 'a' });
    const b = fila.adicionar('eco', 'Segunda', { texto: 'b' });
    expect(fila.obter(b.id)!.estado).toBe('fila');
    const [ta, tb] = await Promise.all([fila.aguardar(a.id), fila.aguardar(b.id)]);
    expect(ordem).toEqual(['inicio a', 'fim a', 'inicio b', 'fim b']);
    expect(ta).toMatchObject({ estado: 'pronta', saida: 'saida-a', titulo: 'Primeira', progresso: 'trabalhando em a' });
    expect(tb.terminadaEm).toBeTruthy();
    expect(fila.listar().map((t) => t.id)).toEqual([b.id, a.id]);
  });

  it('erro vira estado de erro com a mensagem, e a fila segue', async () => {
    const fila = new Fila({
      falha: async () => { throw new Error('python não achou o Pillow'); },
      ok: async () => 'feito',
    });
    const a = fila.adicionar('falha', 'Ruim', {});
    const b = fila.adicionar('ok', 'Boa', {});
    expect(await fila.aguardar(a.id)).toMatchObject({ estado: 'erro', erro: 'python não achou o Pillow' });
    expect(await fila.aguardar(b.id)).toMatchObject({ estado: 'pronta' });
  });

  it('tipo desconhecido é recusado e id desconhecido não existe', () => {
    const fila = new Fila({});
    expect(() => fila.adicionar('nada', 'x', {})).toThrowError(/tipo/);
    expect(fila.obter('nao')).toBeUndefined();
  });
});
