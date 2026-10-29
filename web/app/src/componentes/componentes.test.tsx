// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '../../../../core/conteudo/cofre.ts';
import { Ajuda } from './Ajuda.tsx';
import { BarraLateral } from './BarraLateral.tsx';
import { Inicio } from './Inicio.tsx';
import { PainelQuadro } from './PainelQuadro.tsx';
import { RoubarIdeias } from './RoubarIdeias.tsx';

afterEach(cleanup);

const itens: Item[] = [
  { nome: 'ideias', caminho: 'ideias', tipo: 'pasta', filhos: [{ nome: 'api.md', caminho: 'ideias/api.md', tipo: 'nota' }] },
  { nome: 'video.quadro.json', caminho: 'video.quadro.json', tipo: 'quadro' },
];

describe('BarraLateral', () => {
  it('mostra a árvore, seleciona e oferece ações em lote', async () => {
    const usuario = userEvent.setup();
    const aoAlternar = vi.fn();
    const aoAcao = vi.fn();
    const aoAbrir = vi.fn();
    const { rerender } = render(<BarraLateral itens={itens} selecao={new Set()} aoAlternar={aoAlternar} aoAbrir={aoAbrir} aoAcao={aoAcao} />);
    expect(screen.getByText('api')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /mover/i })).toBeNull();
    await usuario.click(screen.getByRole('checkbox', { name: /selecionar api/i }));
    expect(aoAlternar).toHaveBeenCalledWith('ideias/api.md', false);
    await usuario.click(screen.getByText('video'));
    expect(aoAbrir).toHaveBeenCalledWith(itens[1]);
    rerender(<BarraLateral itens={itens} selecao={new Set(['ideias/api.md'])} aoAlternar={aoAlternar} aoAbrir={aoAbrir} aoAcao={aoAcao} />);
    await usuario.click(screen.getByRole('button', { name: /excluir \(1\)/i }));
    expect(aoAcao).toHaveBeenCalledWith('excluir', ['ideias/api.md']);
  });

  it('filtra pelo texto digitado', async () => {
    const usuario = userEvent.setup();
    render(<BarraLateral itens={itens} selecao={new Set()} aoAlternar={vi.fn()} aoAbrir={vi.fn()} aoAcao={vi.fn()} />);
    await usuario.type(screen.getByPlaceholderText(/buscar/i), 'video');
    expect(screen.queryByText('api')).toBeNull();
    expect(screen.getByText('video')).toBeTruthy();
  });
});

describe('Inicio', () => {
  const sugestoes = [{ caminho: 'conhecimento/sugestoes/api.md', titulo: 'API é o balcão', formato: 'ambos', status: 'nova', criada: '2026-10-29', origem: 'radar' }];

  it('mostra o modo de aprendizado e deixa pausar', async () => {
    const usuario = userEvent.setup();
    const aoPausar = vi.fn();
    render(<Inicio radar={{ situacao: 'aguardando', ciclosNaSessao: 2, custoHoje: 0.04, proximoEm: '2026-10-29T10:20:00Z', ultimasDescobertas: [] }}
      sugestoes={sugestoes} aoPausar={aoPausar} aoRetomar={vi.fn()} aoAgora={vi.fn()} aoCriarQuadro={vi.fn()} aoDescartar={vi.fn()} />);
    expect(screen.getByText(/aprendendo|aguardando/i)).toBeTruthy();
    expect(screen.getByText(/US\$ 0,04/)).toBeTruthy();
    await usuario.click(screen.getByRole('button', { name: /pausar/i }));
    expect(aoPausar).toHaveBeenCalled();
  });

  it('pausado mostra retomar; sugestão vira vídeo ou carrossel com um clique', async () => {
    const usuario = userEvent.setup();
    const aoRetomar = vi.fn();
    const aoCriarQuadro = vi.fn();
    render(<Inicio radar={{ situacao: 'pausado', ciclosNaSessao: 0, custoHoje: 0, ultimasDescobertas: [] }} sugestoes={sugestoes}
      aoPausar={vi.fn()} aoRetomar={aoRetomar} aoAgora={vi.fn()} aoCriarQuadro={aoCriarQuadro} aoDescartar={vi.fn()} />);
    await usuario.click(screen.getByRole('button', { name: /retomar/i }));
    expect(aoRetomar).toHaveBeenCalled();
    const card = screen.getByText('API é o balcão').closest('article')!;
    await usuario.click(within(card as HTMLElement).getByRole('button', { name: /carrossel/i }));
    expect(aoCriarQuadro).toHaveBeenCalledWith('conhecimento/sugestoes/api.md', 'carrossel');
  });
});

describe('PainelQuadro', () => {
  it('lista problemas e só deixa produzir sem erro', async () => {
    const usuario = userEvent.setup();
    const aoProduzir = vi.fn();
    const { rerender } = render(<PainelQuadro tipo="video" problemas={[{ nivel: 'erro', mensagem: 'Há um ciclo', cartoes: ['a'] }]}
      aoGerarPrevia={vi.fn()} aoProduzir={aoProduzir} />);
    expect(screen.getByText('Há um ciclo')).toBeTruthy();
    expect((screen.getByRole('button', { name: /gerar vídeo/i }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<PainelQuadro tipo="carrossel" problemas={[]} previa="/api/previas/x.png"
      tarefa={{ id: 't', tipo: 'carrossel', titulo: 'C', estado: 'rodando', progresso: 'slide 2 de 5', criadaEm: '' }}
      aoGerarPrevia={vi.fn()} aoProduzir={aoProduzir} />);
    expect(screen.getByText(/slide 2 de 5/)).toBeTruthy();
    expect(screen.getByRole('img', { name: /prévia/i }).getAttribute('src')).toBe('/api/previas/x.png');
    await usuario.click(screen.getByRole('button', { name: /exportar carrossel/i }));
    expect(aoProduzir).toHaveBeenCalled();
  });
});

describe('RoubarIdeias', () => {
  it('explica a regra de referência e envia o arquivo escolhido', async () => {
    const usuario = userEvent.setup();
    const aoEnviar = vi.fn();
    render(<RoubarIdeias referencias={[]} aoEnviar={aoEnviar} />);
    expect(screen.getByText(/não copi/i)).toBeTruthy();
    const arquivo = new File([new Uint8Array([1])], 'meme.png', { type: 'image/png' });
    await usuario.upload(screen.getByLabelText(/escolher arquivo/i), arquivo);
    expect(aoEnviar).toHaveBeenCalledWith(arquivo);
  });

  it('mostra as técnicas e gera a prévia num vídeo meu', async () => {
    const usuario = userEvent.setup();
    const aoPrevia = vi.fn();
    render(<RoubarIdeias aoEnviar={vi.fn()} aoPrevia={aoPrevia} videos={[{ nome: 'mitos.mp4', caminho: 'videos/mitos.mp4' }]}
      referencias={[{ pasta: 'referencias/meme', titulo: 'meme', resumo: 'Meme do erro', tecnicas: [
        { nome: 'Zoom no erro', tipo: 'transicao', como_usar: 'quando o erro aparece', efeito_proximo: 'zoom' }] }]} />);
    await usuario.click(screen.getByRole('button', { name: /ver no meu vídeo/i }));
    expect(aoPrevia).toHaveBeenCalledWith({ efeito: 'zoom', video: 'videos/mitos.mp4' });
  });
});

describe('Ajuda', () => {
  it('busca e abre o passo a passo', async () => {
    const usuario = userEvent.setup();
    render(<Ajuda />);
    await usuario.type(screen.getByPlaceholderText(/dúvida/i), 'lixeira');
    await usuario.click(screen.getAllByRole('button', { name: /lixeira/i })[0]!);
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(2);
  });
});
