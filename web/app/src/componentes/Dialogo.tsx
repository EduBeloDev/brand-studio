import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface PedidoDialogo {
  titulo: string;
  texto?: string;
  campo?: { rotulo: string; valor?: string; placeholder?: string };
  opcoes?: { valor: string; rotulo: string }[];
  confirmar?: string;
  perigo?: boolean;
  resolver: (valor: string | null) => void;
}

/** Caixa de diálogo do app (pergunta com campo, escolha ou confirmação). */
export function Dialogo({ pedido, children }: { pedido: PedidoDialogo | null; children?: ReactNode }) {
  const [valor, setValor] = useState('');
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setValor(pedido?.campo?.valor ?? pedido?.opcoes?.[0]?.valor ?? '');
    setTimeout(() => campo.current?.select(), 0);
  }, [pedido]);
  if (!pedido) return null;
  const fechar = (v: string | null) => pedido.resolver(v);
  return (
    <div className="fundo-dialogo" onMouseDown={(e) => e.target === e.currentTarget && fechar(null)}>
      <form className="dialogo cartao-vidro" role="dialog" aria-label={pedido.titulo}
        onSubmit={(e) => { e.preventDefault(); fechar(pedido.campo || pedido.opcoes ? valor : 'ok'); }}
        onKeyDown={(e) => e.key === 'Escape' && fechar(null)}>
        <h3>{pedido.titulo}</h3>
        {pedido.texto && <p className="suave">{pedido.texto}</p>}
        {pedido.campo && (
          <label className="campo"><span>{pedido.campo.rotulo}</span>
            <input ref={campo} value={valor} placeholder={pedido.campo.placeholder} onChange={(e) => setValor(e.target.value)} autoFocus /></label>
        )}
        {pedido.opcoes && (
          <div className="opcoes-dialogo">
            {pedido.opcoes.map((o) => (
              <label key={o.valor} className={`opcao${valor === o.valor ? ' ativa' : ''}`}>
                <input type="radio" name="opcao" checked={valor === o.valor} onChange={() => setValor(o.valor)} /> {o.rotulo}
              </label>
            ))}
          </div>
        )}
        {children}
        <div className="acoes">
          <button type="button" className="fantasma" onClick={() => fechar(null)}>Cancelar</button>
          <button type="submit" className={pedido.perigo ? 'perigo' : 'principal'} disabled={!!pedido.campo && !valor.trim()}>{pedido.confirmar ?? 'Confirmar'}</button>
        </div>
      </form>
    </div>
  );
}
