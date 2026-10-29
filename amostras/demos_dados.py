"""Demonstrações genéricas, para qualquer tema, na janela do sistema antigo: código com saída, terminal, lista de
passos e comparação. Recebem lt (segundos desde que a demonstração entrou) e os dados do cartão; com lt grande,
desenham o estado final (usado no carrossel e na prévia).

Também dá acesso às demonstrações desenhadas à mão (demos.py), espalhando as marcas no tempo.
"""
from PIL import ImageDraw

import arte as a
import demos as d
import efeitos as fx


def _linhas(texto, maximo):
    return [l.rstrip() for l in (texto or "").replace("\t", "  ").split("\n")][:maximo]


def codigo(lt, dados):
    saida = (dados.get("saida") or "").strip()
    linhas = _linhas(dados.get("codigo"), 7 if saida else int(dados.get("max_linhas", 7))) or ["// código"]
    tela = d._tela(d.BRANCO)
    dr = ImageDraw.Draw(tela)
    tam = 28 if max(len(l) for l in linhas) <= 44 and len(linhas) * 40 <= d.ALT - 40 else 22
    passo = min(44 if tam == 28 else 36, (d.ALT - 40) // len(linhas))
    total = sum(len(l) for l in linhas)
    n = int(total * min(1.0, lt / 1.6))
    y, xfim, yfim = 32, 64, None
    for i, l in enumerate(linhas):
        dr.text((22, y), str(i + 1), font=a.fonte("mono", tam), fill=d.ESCURO, anchor="lm")
        vis = l[:max(0, n)]
        n -= len(l)
        if vis:
            xfim, yfim = d._codigo(dr, 64, y, vis, tam), y
        y += passo
    if lt < 1.8 and yfim is not None:
        d._cursor(dr, xfim, yfim, tam, lt)
    if dados.get("compacto") and not saida:  # no carrossel, a janela encolhe até o tamanho do código
        tela = tela.crop((0, 0, d.LARG, min(d.ALT, max(150, y + 4))))
        dr = ImageDraw.Draw(tela)
    if saida and lt > 1.8:
        topo = max(y + 6, 210)
        caixa = (14, topo, d.LARG - 14, d.ALT - 12)
        dr.rectangle(caixa, fill=d.PRETO)
        fx.bisel(dr, caixa, "afundado")
        k = int(len(saida) * min(1.0, (lt - 1.8) / 0.6))
        for j, linha in enumerate(saida[:k].split("\n")[:4]):
            dr.text((32, topo + 34 + j * 38), ("> " if j == 0 else "  ") + linha, font=a.fonte("mono", 26), fill=(235, 235, 235), anchor="lm")
        if lt > 2.6:
            a.colar(tela, d._check(5, d.VERDE_CLARO), d.LARG - 110, topo + 14)
    return fx.cromo_janela(tela, dados.get("titulo") or "exemplo - Editor")


def terminal(lt, dados):
    comandos = _linhas(dados.get("codigo"), 4) or ["dir"]
    saida = _linhas(dados.get("saida"), 5)
    tela = d._tela(d.PRETO)
    dr = ImageDraw.Draw(tela)
    f = a.fonte("mono", 26)
    y, t = 36, 0.0
    for cmd in comandos:
        dur = 0.05 * len(cmd) + 0.2
        if lt < t:
            break
        k = int(len(cmd) * min(1.0, (lt - t) / dur))
        dr.text((22, y), "C:\\> " + cmd[:k], font=f, fill=(235, 235, 235), anchor="lm")
        if k < len(cmd) or (lt - t) < dur + 0.2:
            d._cursor(dr, 22 + f.getlength("C:\\> " + cmd[:k]), y, 26, lt, (235, 235, 235))
        y += 40
        t += dur + 0.3
    if lt > t:
        for j, linha in enumerate(saida):
            if lt > t + 0.15 * j:
                dr.text((22, y), linha, font=f, fill=(150, 230, 160), anchor="lm")
                y += 38
    return fx.cromo_janela(tela, dados.get("titulo") or "Prompt de comando", menu=("Arquivo", "Editar", "Ajuda"))


def lista(lt, dados):
    itens = _linhas(dados.get("itens"), 5) or ["passo"]
    tela = d._tela(d.CINZA)
    dr = ImageDraw.Draw(tela)
    altura = min(96, (d.ALT - 30) // len(itens))
    tam = 38 if altura >= 70 and max(len(i) for i in itens) <= 32 else 32 if max(len(i) for i in itens) <= 40 else 28
    for i, item in enumerate(itens):
        t = 0.45 * i
        if lt < t:
            break
        y = 18 + i * altura
        ativo = i == min(len(itens) - 1, int(lt / 0.45))
        if ativo:
            dr.rectangle((14, y, d.LARG - 14, y + altura - 10), fill=d.AZUL)
        caixa = (28, y + altura // 2 - 22, 72, y + altura // 2 + 18)
        d._campo(dr, caixa)
        if lt > t + 0.25:
            a.colar(tela, d._check(4, d.VERDE), caixa[0] + 4, caixa[1] + 6)
        dr.text((96, y + altura // 2 - 4), item, font=a.fonte("corpo", tam), fill=d.BRANCO if ativo else d.PRETO, anchor="lm")
    return fx.cromo_janela(tela, dados.get("titulo") or "passos.exe", menu=("Arquivo", "Exibir", "Ajuda"))


def _lado(texto):
    if ":" in (texto or ""):
        t, corpo = texto.split(":", 1)
        return t.strip(), corpo.strip()
    return (texto or "").strip(), ""


def comparacao(lt, dados):
    tela = d._tela(d.CINZA)
    dr = ImageDraw.Draw(tela)
    meio = d.LARG // 2
    for i, chave in enumerate(("esquerda", "direita")):
        if lt < 0.6 * i:
            continue
        titulo, corpo = _lado(dados.get(chave))
        x0 = 16 if i == 0 else meio + 8
        caixa = (x0, 18, x0 + meio - 24, d.ALT - 18)
        fx.botao(dr, caixa)
        dr.text((x0 + 24, 56), titulo[:22], font=a.fonte("mono", 34 if len(titulo) <= 16 else 30), fill=d.AZUL, anchor="lm")
        if corpo:
            for tam in (42, 38, 34, 30, 26):  # o maior que cabe no quadro
                bloco = a.bloco(corpo, "corpo", tam, meio - 90, d.PRETO, 1.18)
                if bloco.height <= d.ALT - 130:
                    break
            tela.paste(bloco, (x0 + 14, 100), bloco)
    if lt > 0.6:
        dr.ellipse((meio - 34, d.ALT // 2 - 34, meio + 34, d.ALT // 2 + 34), fill=a.AMARELO, outline=d.PRETO, width=3)
        dr.text((meio, d.ALT // 2), "VS", font=a.fonte("titulo", 30), fill=a.BG0, anchor="mm")
    return fx.cromo_janela(tela, dados.get("titulo") or "comparar.exe", menu=("Arquivo", "Exibir", "Ajuda"))


GENERICAS = {"codigo": codigo, "terminal": terminal, "lista": lista, "comparacao": comparacao}
MARCAS_MITOS = {"livro": ["livro", "docs"], "formula": ["formula", "codigo", "js", "resultado"],
                "esteira": ["teclado", "esteira", "entender", "ler", "testar", "corrigir"],
                "erro": ["codigo", "alerta", "correcao", "resultado"], "pcs": ["pcs", "basico", "pesados"]}


def desenhar(nome, lt, dados=None):
    """Painel 912x500 da demonstração `nome` no instante lt (None se não existe)."""
    dados = dados or {}
    if nome in GENERICAS:
        return GENERICAS[nome](lt, dados)
    if nome in d.DEMOS:
        marcas = {m: 0.9 * i for i, m in enumerate(MARCAS_MITOS[nome])}
        return d.DEMOS[nome](lt, marcas)
    return None
