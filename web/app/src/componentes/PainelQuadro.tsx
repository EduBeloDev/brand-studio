import type { ReactNode } from 'react';
import type { Fonte, Problema, TipoQuadro } from '../../../../core/quadro/quadro.ts';
import type { Tarefa } from '../../../../core/render/fila.ts';

interface Props {
  tipo: TipoQuadro;
  problemas: Problema[];
  previa?: string;
  carregandoPrevia?: boolean;
  tarefa?: Tarefa;
  fontes?: Fonte[];
  aoGerarPrevia: () => void;
  aoProduzir: () => void;
  aoFonte?: (caminho: string, ativo: boolean) => void;
  aoTirarFonte?: (caminho: string) => void;
  aoMarcar?: (cartoes: string[]) => void;
  children?: ReactNode;
}

export function PainelQuadro({ tipo, problemas, previa, carregandoPrevia, tarefa, fontes = [], aoGerarPrevia, aoProduzir, aoFonte, aoTirarFonte, aoMarcar, children }: Props) {
  const erros = problemas.filter((p) => p.nivel === 'erro');
  return (
    <aside className="painel-quadro">
      {children}
      <section className="bloco-painel">
        <div className="linha-titulo">
          <h3>Prévia</h3>
          <button type="button" className="mini fantasma" onClick={aoGerarPrevia}>Atualizar prévia</button>
        </div>
        <div className={`moldura-previa ${tipo}${carregandoPrevia ? ' carregando' : ''}`}>
          {previa ? <img src={previa} alt={tipo === 'video' ? 'Prévia da cena' : 'Prévia do slide'} /> : <p className="suave">Clique num cartão para ver a prévia.</p>}
        </div>
      </section>
      <section className="bloco-painel">
        <h3>Conferência</h3>
        {!problemas.length && <p className="ok-texto">Tudo certo para produzir.</p>}
        <ul className="problemas">
          {problemas.map((p, i) => (
            <li key={i} className={p.nivel}>
              <button type="button" className="ligacao" onClick={() => aoMarcar?.(p.cartoes)}>{p.mensagem}</button>
            </li>
          ))}
        </ul>
        <button type="button" className="principal" disabled={erros.length > 0} onClick={aoProduzir}>
          {tipo === 'video' ? 'Gerar vídeo' : 'Exportar carrossel'}
        </button>
        {tarefa && (
          <p className={`tarefa-linha estado-${tarefa.estado}`}>
            {tarefa.estado === 'pronta' ? <a href={tarefa.saida} target="_blank" rel="noreferrer">Pronto: abrir</a>
              : tarefa.estado === 'erro' ? tarefa.erro : tarefa.progresso}
          </p>
        )}
      </section>
      {(fontes.length > 0 || aoFonte) && (
        <section className="bloco-painel">
          <h3>Fontes</h3>
          {!fontes.length && <p className="suave">Selecione notas na barra lateral e clique em "Usar como fonte".</p>}
          <ul className="fontes">
            {fontes.map((f) => (
              <li key={f.caminho}>
                <label><input type="checkbox" checked={f.ativo} onChange={(e) => aoFonte?.(f.caminho, e.target.checked)} /> {f.caminho.replace(/\.md$/, '')}</label>
                <button type="button" className="mini fantasma" aria-label={`Tirar ${f.caminho}`} onClick={() => aoTirarFonte?.(f.caminho)}>×</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
