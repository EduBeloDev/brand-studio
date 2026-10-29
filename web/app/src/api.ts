/** Cliente da API do app. Toda chamada que muda algo vai em JSON (o servidor recusa o resto). */

export class ErroApi extends Error {
  status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.status = status;
  }
}

async function pedir<T>(metodo: string, rota: string, corpo?: unknown): Promise<T> {
  const r = await fetch(rota, {
    method: metodo,
    headers: corpo === undefined ? {} : { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const tipo = r.headers.get('content-type') ?? '';
  const dados = tipo.includes('json') ? await r.json() : await r.text();
  if (!r.ok) throw new ErroApi(r.status, (dados as { erro?: string })?.erro ?? `Falhou (${r.status}).`);
  return dados as T;
}

export const api = {
  get: <T>(rota: string) => pedir<T>('GET', rota),
  post: <T>(rota: string, corpo: unknown = {}) => pedir<T>('POST', rota, corpo),
  put: <T>(rota: string, corpo: unknown) => pedir<T>('PUT', rota, corpo),
  async enviar<T>(rota: string, arquivo: File, cabecalhos: Record<string, string> = {}): Promise<T> {
    const r = await fetch(rota, { method: 'POST', body: arquivo, headers: { 'x-nome': encodeURIComponent(arquivo.name), ...cabecalhos } });
    const dados = await r.json();
    if (!r.ok) throw new ErroApi(r.status, dados?.erro ?? `Falhou (${r.status}).`);
    return dados as T;
  },
};

export const urlArquivo = (caminho: string) => `/api/arquivo?caminho=${encodeURIComponent(caminho)}`;
export const q = encodeURIComponent;
