import { MODELOS, modeloPorId } from '../../../../core/carrossel/modelos.ts';
import { CATALOGO, NOMES_TIPO, type Cartao } from '../../../../core/quadro/quadro.ts';

/** Formulário do cartão selecionado: campos do tipo, instruções e geração com IA. */

const NOMES: Record<string, string> = {
  dissolucao: 'Dissolução', desmontagem: 'Desmontagem em pixels', blocos: 'Blocos de pixels', glitch: 'Glitch colorido', zoom: 'Zoom de impacto',
  cacos: 'Quebra em cacos', demonstracao: 'Demonstração', bombinha: 'Bombinha (explode o texto)', personagem: 'Troca de expressão',
  destaque: 'Destaque (brilho e estrelas)', som: 'Efeito sonoro', codigo: 'Código com saída', terminal: 'Terminal', lista: 'Lista de passos',
  comparacao: 'Comparação lado a lado', livro: 'Livro x documentação', formula: 'Fórmula x código', esteira: 'Esteira de etapas',
  erro: 'Erro e correção', pcs: 'Computadores',
};
export const nomeDe = (v: string) => NOMES[v] ?? v.replace('_', ' ');

interface Props {
  cartao: Cartao;
  aoCampo: (chave: string, valor: string) => void;
  aoInstrucoes: (valor: string) => void;
  aoGerar?: () => void;
  aoRemover: () => void;
  gerando?: boolean;
}

function Escolha({ rotulo, valor, opcoes, aoMudar, vazio }: { rotulo: string; valor: string; opcoes: readonly string[]; aoMudar: (v: string) => void; vazio?: string }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      <select value={valor} onChange={(e) => aoMudar(e.target.value)}>
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => <option key={o} value={o}>{nomeDe(o)}</option>)}
      </select>
    </label>
  );
}

function Texto({ rotulo, valor, aoMudar, longo, max, ia, dica }: { rotulo: string; valor: string; aoMudar: (v: string) => void; longo?: boolean; max?: number; ia?: boolean; dica?: string }) {
  return (
    <label className={`campo${ia ? ' da-ia' : ''}`}>
      <span>{rotulo}{ia && <em className="marca-ia" title="Preenchido pela IA">IA</em>}{max ? <small className="suave"> {valor.length}/{max}</small> : null}</span>
      {longo ? <textarea value={valor} rows={3} onChange={(e) => aoMudar(e.target.value)} /> : <input value={valor} onChange={(e) => aoMudar(e.target.value)} />}
      {dica && <small className="suave">{dica}</small>}
    </label>
  );
}

export function CartaoEditor({ cartao: c, aoCampo, aoInstrucoes, aoGerar, aoRemover, gerando }: Props) {
  const v = (k: string) => c.campos[k] ?? '';
  const ia = (k: string) => c.geradoPorIA?.includes(k);
  const ef = v('efeito');
  return (
    <section className={`bloco-painel cartao-editor tipo-${c.tipo}`}>
      <div className="linha-titulo">
        <h3>{NOMES_TIPO[c.tipo]}</h3>
        <button type="button" className="mini fantasma perigo" onClick={aoRemover}>Remover</button>
      </div>
      {c.tipo === 'fala' && (
        <>
          <Texto rotulo="Fala (narração)" valor={v('fala')} aoMudar={(x) => aoCampo('fala', x)} longo ia={ia('fala')} />
          <Texto rotulo="Texto da tela" valor={v('tela')} aoMudar={(x) => aoCampo('tela', x)} max={60} ia={ia('tela')} dica="Use *asteriscos* para destacar em amarelo." />
          <Escolha rotulo="Expressão do personagem" valor={v('expressao') || 'ok'} opcoes={CATALOGO.expressoes} aoMudar={(x) => aoCampo('expressao', x)} />
        </>
      )}
      {c.tipo === 'transicao' && <Escolha rotulo="Efeito" valor={ef || 'dissolucao'} opcoes={CATALOGO.transicoes} aoMudar={(x) => aoCampo('efeito', x)} />}
      {c.tipo === 'animacao' && (
        <>
          <Escolha rotulo="Efeito" valor={ef} opcoes={CATALOGO.animacoes} aoMudar={(x) => aoCampo('efeito', x)} vazio="Escolha..." />
          {ef === 'demonstracao' && (
            <>
              <Escolha rotulo="Demonstração" valor={v('demo')} opcoes={CATALOGO.demos} aoMudar={(x) => aoCampo('demo', x)} vazio="Escolha..." />
              {['codigo', 'terminal'].includes(v('demo')) && (
                <>
                  <Texto rotulo={v('demo') === 'terminal' ? 'Comandos (um por linha)' : 'Código'} valor={v('codigo')} aoMudar={(x) => aoCampo('codigo', x)} longo />
                  <Texto rotulo="Saída" valor={v('saida')} aoMudar={(x) => aoCampo('saida', x)} longo />
                </>
              )}
              {v('demo') === 'lista' && <Texto rotulo="Itens (um por linha)" valor={v('itens')} aoMudar={(x) => aoCampo('itens', x)} longo />}
              {v('demo') === 'comparacao' && (
                <>
                  <Texto rotulo="Esquerda (Título: texto)" valor={v('esquerda')} aoMudar={(x) => aoCampo('esquerda', x)} />
                  <Texto rotulo="Direita (Título: texto)" valor={v('direita')} aoMudar={(x) => aoCampo('direita', x)} />
                </>
              )}
            </>
          )}
          {ef === 'bombinha' && <Texto rotulo="Depois da explosão (texto que entra)" valor={v('detalhe')} aoMudar={(x) => aoCampo('detalhe', x)} dica="Vazio: o texto só explode." />}
          {ef === 'personagem' && <Escolha rotulo="Nova expressão" valor={v('detalhe')} opcoes={CATALOGO.expressoes} aoMudar={(x) => aoCampo('detalhe', x)} vazio="Escolha..." />}
          {ef === 'som' && <Escolha rotulo="Som" valor={v('detalhe')} opcoes={CATALOGO.sons} aoMudar={(x) => aoCampo('detalhe', x)} vazio="Escolha..." />}
          {ef && <Texto rotulo="Gatilho (palavra da fala)" valor={v('gatilho')} aoMudar={(x) => aoCampo('gatilho', x)} dica="Opcional: a animação acontece quando a voz diz esta palavra." />}
        </>
      )}
      {c.tipo === 'slide' && (
        <>
          <Escolha rotulo="Modelo" valor={v('modelo')} opcoes={MODELOS.map((m) => m.id)} aoMudar={(x) => aoCampo('modelo', x)} vazio="A IA escolhe" />
          {modeloPorId(v('modelo'))?.campos.map((campo) => campo.tipo === 'demo' || campo.tipo === 'expressao'
            ? <Escolha key={campo.chave} rotulo={campo.rotulo} valor={v(campo.chave)} aoMudar={(x) => aoCampo(campo.chave, x)} vazio="Nenhuma"
              opcoes={campo.tipo === 'demo' ? CATALOGO.demos : CATALOGO.expressoes} />
            : <Texto key={campo.chave} rotulo={`${campo.rotulo}${campo.obrigatorio ? ' *' : ''}`} valor={v(campo.chave)} aoMudar={(x) => aoCampo(campo.chave, x)}
              longo={campo.tipo !== 'texto'} max={campo.tipo === 'lista' ? undefined : campo.max} ia={ia(campo.chave)} dica={campo.dica} />)}
          {['lista', 'comparacao', 'codigo', 'terminal'].includes(v('demo')) && v('modelo') !== 'codigo' && (
            <p className="suave">A demonstração usa os campos "itens", "esquerda"/"direita" ou "codigo"/"saida": peça para a IA preencher.</p>
          )}
        </>
      )}
      <Texto rotulo="Instruções para a IA" valor={c.instrucoes} aoMudar={aoInstrucoes} longo />
      {aoGerar && (c.tipo === 'fala' || c.tipo === 'slide') && (
        <button type="button" className="principal ia" onClick={aoGerar} disabled={gerando}>{gerando ? 'A IA está escrevendo...' : 'Gerar com IA'}</button>
      )}
    </section>
  );
}
