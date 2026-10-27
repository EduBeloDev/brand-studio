import type { Estacao, KitMarca, Roteiro, Visual } from '../tipos.ts';

/**
 * PROVISÓRIA. Desenha um quadro cinza com o título, só para a linha ter um arquivo visual.
 * A versão real vai montar o template da marca, com logo, fonte e cores exatos. O tamanho
 * 1080×1080 também é provisório: sai da decisão de formatos.
 * Título muito longo passa da borda; o template real resolve a quebra de linha.
 */
export const criarVisual: Estacao<{ roteiro: Roteiro; marca: KitMarca }, Visual> = async ({ roteiro, marca }) => {
  const { principal, fundo, texto } = marca.cores;
  const fonte = escaparXml(marca.fonte);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="${fundo}"/>
  <rect x="60" y="60" width="960" height="960" fill="none" stroke="${principal}" stroke-width="4" stroke-dasharray="16 12"/>
  <text x="540" y="540" text-anchor="middle" dominant-baseline="middle" font-family="${fonte}" font-size="56" fill="${texto}">${escaparXml(roteiro.titulo)}</text>
  <text x="540" y="990" text-anchor="middle" font-family="${fonte}" font-size="28" fill="${principal}">${escaparXml(marca.nome)}</text>
</svg>
`;
  return { arquivo: 'visual.svg', conteudo: svg };
};

/** O tema vem de quem digita; sem isso, um "&" ou "<" no tema quebraria o SVG. */
function escaparXml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
