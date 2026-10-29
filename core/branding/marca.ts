import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Nome da marca. Mora em conteudo/branding/marca.json, que fica só no computador (fora do git): o código não cita
 * nenhuma marca. Sem o arquivo, ou com ele quebrado, vale o nome neutro.
 */

export interface Marca {
  nome: string;
}

export const MARCA_PADRAO: Marca = { nome: 'minha marca' };
export const ARQUIVO_MARCA = 'branding/marca.json';

export async function lerMarca(raiz: string): Promise<Marca> {
  try {
    const d = JSON.parse(await readFile(path.join(raiz, ...ARQUIVO_MARCA.split('/')), 'utf8')) as Partial<Marca>;
    const nome = typeof d?.nome === 'string' ? d.nome.trim() : '';
    return nome ? { nome } : { ...MARCA_PADRAO };
  } catch {
    return { ...MARCA_PADRAO };
  }
}
