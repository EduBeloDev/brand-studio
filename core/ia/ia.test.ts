import { describe, expect, it } from 'vitest';
import { ErroIA, IAFalsa, argumentosClaude, criarClaudeCode, extrairJson, lerSaidaClaude } from './ia.ts';

describe('argumentos do Claude Code', () => {
  it('sem web: nenhuma ferramenta, modo seguro, sem sessão salva e sistema próprio', () => {
    const args = argumentosClaude({ sistema: 'Você escreve slides.', prompt: 'x' });
    expect(args.slice(0, 3)).toEqual(['-p', '--output-format', 'json']);
    expect(args).toEqual(expect.arrayContaining(['--safe-mode', '--no-session-persistence', '--permission-prompts', 'none']));
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(args[args.indexOf('--system-prompt') + 1]).toBe('Você escreve slides.');
    expect(args.join(' ')).not.toMatch(/Bash|Write|Edit|Read/);
  });

  it('com web: só busca e leitura de páginas, e o modelo escolhido', () => {
    const args = argumentosClaude({ sistema: 's', prompt: 'x', web: true, modelo: 'sonnet' });
    const i = args.indexOf('--tools');
    expect(args.slice(i, i + 3)).toEqual(['--tools', 'WebSearch', 'WebFetch']);
    const j = args.indexOf('--allowedTools');
    expect(args.slice(j, j + 3)).toEqual(['--allowedTools', 'WebSearch', 'WebFetch']);
    expect(args[args.indexOf('--model') + 1]).toBe('sonnet');
    expect(args.join(' ')).not.toMatch(/Bash|Write|Edit/);
  });

  it('com leitura: só a ferramenta de ler arquivos, e só na pasta indicada', () => {
    const args = argumentosClaude({ sistema: 's', prompt: 'x', leitura: '/cofre/referencias/x' });
    const i = args.indexOf('--tools');
    expect(args.slice(i, i + 2)).toEqual(['--tools', 'Read']);
    expect(args[args.indexOf('--add-dir') + 1]).toBe('/cofre/referencias/x');
    expect(args.join(' ')).not.toMatch(/Bash|Write|Edit|WebSearch/);
  });
});

describe('leitura da saída', () => {
  it('pega texto, custo e duração', () => {
    const saida = JSON.stringify({ result: '{"a":1}', total_cost_usd: 0.012, duration_ms: 8000, is_error: false });
    expect(lerSaidaClaude(saida)).toEqual({ texto: '{"a":1}', custoUsd: 0.012, duracaoMs: 8000 });
  });

  it('erro da IA ou saída quebrada viram ErroIA', () => {
    expect(() => lerSaidaClaude(JSON.stringify({ is_error: true, result: 'limite de uso' }))).toThrowError(/limite de uso/);
    expect(() => lerSaidaClaude('não é json')).toThrowError(ErroIA);
  });
});

describe('criarClaudeCode', () => {
  it('manda o prompt pela entrada e lê a resposta', async () => {
    const chamadas: { args: string[]; entrada: string }[] = [];
    const ia = criarClaudeCode({
      executar: async (args, entrada) => {
        chamadas.push({ args, entrada });
        return { codigo: 0, stdout: JSON.stringify({ result: 'ok', total_cost_usd: 0.01, duration_ms: 5 }), stderr: '' };
      },
    });
    const r = await ia.gerar({ sistema: 's', prompt: 'olá' });
    expect(r.texto).toBe('ok');
    expect(chamadas[0]!.entrada).toBe('olá');
    expect(chamadas[0]!.args[0]).toBe('-p');
  });

  it('código de saída diferente de zero vira erro com a mensagem', async () => {
    const ia = criarClaudeCode({ executar: async () => ({ codigo: 1, stdout: '', stderr: 'claude: não logado' }) });
    await expect(ia.gerar({ sistema: 's', prompt: 'x' })).rejects.toThrowError(/não logado/);
  });
});

describe('extrairJson', () => {
  it('lê JSON puro, entre cercas e com texto em volta', () => {
    expect(extrairJson('{"a": 1}')).toEqual({ a: 1 });
    expect(extrairJson('Aqui:\n```json\n{"a": [1, {"b": "}"}]}\n```\nfim')).toEqual({ a: [1, { b: '}' }] });
    expect(extrairJson('Claro! {"x": "y"} espero ter ajudado')).toEqual({ x: 'y' });
    expect(extrairJson('[1, 2]')).toEqual([1, 2]);
  });

  it('sem JSON válido vira ErroIA', () => {
    expect(() => extrairJson('nada aqui')).toThrowError(ErroIA);
    expect(() => extrairJson('{"a": }')).toThrowError(ErroIA);
  });
});

describe('IAFalsa', () => {
  it('responde na ordem, guarda os pedidos e reclama quando acaba', async () => {
    const ia = new IAFalsa(['um', { texto: 'dois', custoUsd: 0.5 }]);
    expect((await ia.gerar({ sistema: 's', prompt: 'p1' })).texto).toBe('um');
    expect(await ia.gerar({ sistema: 's', prompt: 'p2', web: true })).toMatchObject({ texto: 'dois', custoUsd: 0.5 });
    expect(ia.pedidos.map((p) => p.prompt)).toEqual(['p1', 'p2']);
    await expect(ia.gerar({ sistema: 's', prompt: 'p3' })).rejects.toThrowError(ErroIA);
  });
});
