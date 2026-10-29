"""Demonstrações visuais desenhadas à mão (livro, fórmula, esteira, erro, PCs): telas e pixel art desenhadas
aqui, dentro de janelas no estilo do sistema antigo (nenhum ícone ou imagem de terceiros; o selo de
JavaScript é um botão com texto, sem logotipo).

Cada demo recebe lt (segundos desde o início da cena) e m (instante de cada marca, em segundos) e
devolve o painel 912x500 com a moldura, ou None antes da primeira marca. Com m vazio, todas as
marcas contam como já passadas: é o estado final, usado no carrossel.
"""
import colorsys
import math
import random
import re

from PIL import Image, ImageDraw, ImageFilter

import arte as a
import efeitos as fx
from efeitos import W98_AZUL as AZUL, W98_BRANCO as BRANCO, W98_CINZA as CINZA
from efeitos import W98_ESCURO as ESCURO, W98_PRETO as PRETO

a.FONTES.setdefault("matematica", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
LARG, ALT = 892, 408          # área de conteúdo; com a moldura, o painel fica com 912x500
VERDE = (0, 140, 0)
VERDE_CLARO = (90, 230, 120)
CORES_CODIGO = {"chave": (0, 0, 192), "texto": (0, 128, 0), "numero": (176, 88, 0), "api": (128, 0, 128)}


def _tela(cor=BRANCO):
    return Image.new("RGB", (LARG, ALT), cor)


def _desde(lt, m, nome):
    """Segundos desde a marca; marca ausente conta como passada há muito tempo."""
    return lt - m.get(nome, -99.0)


def _check(tam=6, cor=VERDE):
    s = Image.new("RGBA", (9, 7), (0, 0, 0, 0))
    ImageDraw.Draw(s).line([(0, 3), (3, 6), (8, 0)], fill=cor + (255,), width=2)
    return fx.ampliar(s, tam)


def _cursor(d, x, y, alto, lt, cor=PRETO):
    """Cursor de texto: barra fina que pisca."""
    if int(lt * 3) % 2 == 0:
        d.rectangle((x + 2, y - alto // 2, x + 4, y + alto // 2), fill=cor)


def _campo(d, caixa, fundo=BRANCO):
    """Campo afundado (caixa de texto, lista, área de resultado)."""
    d.rectangle(caixa, fill=fundo)
    fx.bisel(d, caixa, "afundado")


PALAVRAS_CHAVE = {"for", "let", "const", "var", "function", "return", "if", "else", "while", "await", "async", "def",
                  "import", "from", "class", "new", "true", "false", "null", "None", "True", "False", "in", "of"}


def _codigo(d, x, y, texto, tam=28):
    """Escreve uma linha de código com as cores de um editor de fundo claro."""
    f = a.fonte("mono", tam)
    for tok in re.findall(r'"[^"]*"?|\w+|\s+|[^\w\s]', texto):
        if tok in PALAVRAS_CHAVE:
            cor = CORES_CODIGO["chave"]
        elif tok.startswith('"'):
            cor = CORES_CODIGO["texto"]
        elif tok.isdigit():
            cor = CORES_CODIGO["numero"]
        elif tok in ("console", "log", "ctx", "fillRect", "fetch", "print", "json", "then"):
            cor = CORES_CODIGO["api"]
        else:
            cor = PRETO
        d.text((x, y), tok, font=f, fill=cor, anchor="lm")
        x += f.getlength(tok)
    return x


# ------------------------------------------------------------------ mito 1: decorar

def livro(lt, m):
    t = _desde(lt, m, "livro")
    if t < 0:
        return None
    tela = _tela(CINZA)
    d = ImageDraw.Draw(tela)
    u_docs = _desde(lt, m, "docs")
    if u_docs < 0.3:
        s = Image.new("RGBA", (64, 46), (0, 0, 0, 0))
        ds = ImageDraw.Draw(s)
        ds.rectangle((6, 38, 60, 44), fill=(240, 230, 210, 255), outline=(60, 40, 40, 255))
        ds.rectangle((56, 4, 62, 42), fill=(240, 230, 210, 255), outline=(60, 40, 40, 255))
        for yy in range(6, 42, 3):
            ds.line((57, yy, 61, yy), fill=(196, 184, 166, 255))
        ds.rectangle((2, 2, 58, 40), fill=(190, 40, 150, 255), outline=(60, 10, 50, 255))
        ds.rectangle((2, 2, 8, 40), fill=(120, 20, 100, 255))
        ds.rectangle((14, 14, 52, 27), fill=a.AMARELO + (255,))
        img = fx.ampliar(s, 5)
        ImageDraw.Draw(img).text((165, 102), "TODO O CÓDIGO", font=a.fonte("titulo", 25), fill=a.BG0, anchor="mm")
        queda = 1 - a.ease_out_back(min(1.0, t / 0.5))
        x = (LARG - img.width) // 2
        y = 46 - int(330 * queda) + int(5 * math.sin(lt * 3.2))
        if u_docs < 0:
            a.colar(tela, img, x, y)
            pag = min(9999, 1 + int(t * 900))
            d.text((LARG - 24, ALT - 20), f"pág. {pag:,} de 9.999".replace(",", "."), font=a.fonte("mono", 26),
                   fill=PRETO, anchor="rs")
        else:
            puf = fx.explosao(0.35 + u_docs / 0.3 * 0.6, semente=9, esc=6, clara=False)
            a.colar(tela, puf, LARG // 2 - puf.width // 2, 165 - puf.height // 2)
    if u_docs >= 0.15:
        u = u_docs - 0.15
        _campo(d, (24, 22, LARG - 190, 84))
        lupa = Image.new("RGBA", (9, 9), (0, 0, 0, 0))
        dl = ImageDraw.Draw(lupa)
        dl.ellipse((0, 0, 5, 5), outline=PRETO + (255,))
        dl.line((5, 5, 8, 8), fill=PRETO + (255,))
        a.colar(tela, fx.ampliar(lupa, 4), 38, 35)
        consulta = "ordenar uma lista em JavaScript"
        n = int(len(consulta) * min(1.0, u / 0.9))
        f = a.fonte("mono", 26)
        d.text((86, 53), consulta[:n], font=f, fill=PRETO, anchor="lm")
        if u < 1.3:
            _cursor(d, 86 + f.getlength(consulta[:n]), 53, 28, lt)
        fx.botao(d, (LARG - 176, 22, LARG - 24, 84), "Pesquisar", a.fonte("corpo", 24))
        _campo(d, (24, 98, LARG - 24, ALT - 12))
        linhas = [("array.sort()", "ordena os itens da lista"),
                  ("array.toSorted()", "devolve uma cópia ordenada"),
                  ("[3, 1, 2].sort()", "resultado: [1, 2, 3]")]
        for i, (cod, desc) in enumerate(linhas):
            if u < 1.0 + 0.35 * i:
                break
            y = 108 + i * 92
            selecionada = i == 0
            if selecionada:
                d.rectangle((32, y, LARG - 32, y + 80), fill=AZUL)
            elif i > 0:
                d.line((40, y - 6, LARG - 40, y - 6), fill=(210, 210, 210), width=2)
            d.text((52, y + 40), cod, font=a.fonte("mono", 28), fill=BRANCO if selecionada else AZUL, anchor="lm")
            d.text((LARG - 52, y + 40), desc, font=a.fonte("corpo", 25), fill=BRANCO if selecionada else PRETO, anchor="rm")
    return fx.cromo_janela(tela, "decorar.exe" if u_docs < 0 else "Documentação")


# ------------------------------------------------------------------ mito 2: matemática

_formula = None


def _integral():
    """A integral de Gauss com limites e expoente de verdade (não com '^'), centralizada."""
    global _formula
    if _formula is None:
        g, p, n = a.fonte("matematica", 92), a.fonte("matematica", 30), a.fonte("matematica", 56)
        img = Image.new("RGBA", (LARG + 200, 170), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        base, x = 112, 20
        d.text((x, base + 14), "∫", font=g, fill=PRETO, anchor="ls")
        d.text((x + 40, base - 70), "∞", font=p, fill=PRETO, anchor="ls")
        d.text((x + 44, base + 30), "0", font=p, fill=PRETO, anchor="ls")
        x += 78
        d.text((x, base), "e", font=n, fill=PRETO, anchor="ls")
        x += n.getlength("e") + 2
        d.text((x, base - 32), "−x²", font=p, fill=PRETO, anchor="ls")
        x += p.getlength("−x²") + 14
        d.text((x, base), "dx = √π / 2", font=n, fill=PRETO, anchor="ls")
        img = img.crop(img.getchannel("A").getbbox())
        _formula = Image.new("RGBA", (LARG, 170), (0, 0, 0, 0))
        _formula.alpha_composite(img, ((LARG - img.width) // 2, (170 - img.height) // 2))
    return _formula


def formula(lt, m):
    t = _desde(lt, m, "formula")
    if t < 0:
        return None
    tela = _tela(BRANCO)
    d = ImageDraw.Draw(tela)
    u_cod = _desde(lt, m, "codigo")
    if u_cod < 0.35:
        op = 1.0 if u_cod < 0 else max(0.0, 1 - u_cod / 0.35)
        rnd = random.Random(int(lt * 15))
        a.colar(tela, _integral(), rnd.randint(-4, 4), 120 + rnd.randint(-3, 3), op)
        if u_cod < 0:
            for i, (x, y) in enumerate([(130, 70), (760, 90), (210, 320), (690, 330)]):
                if t > 0.5 + 0.35 * i:
                    d.text((x, y), "?", font=a.fonte("titulo", 70), fill=a.MAGENTA, anchor="mm")
    if u_cod >= 0.2:
        u = u_cod - 0.2
        linhas = ["for (let i = 0; i < 3; i++) {", "  ctx.fillRect(i * 40, 0, 30, 30)", "}"]
        n = int(sum(len(l) for l in linhas) * min(1.0, u / 1.4))
        y, xfim, yfim = 36, 30, None
        for l in linhas:
            vis = l[:max(0, n)]
            n -= len(l)
            if vis:
                xfim, yfim = _codigo(d, 30, y, vis), y
            y += 44
        if u < 1.6 and yfim is not None:
            _cursor(d, xfim, yfim, 30, lt)
        u_res = _desde(lt, m, "resultado")
        if u_res >= 0:
            _campo(d, (24, 178, 560, ALT - 14))
            d.text((42, 200), "resultado", font=a.fonte("mono", 20), fill=ESCURO, anchor="lm")
            for i, cor in enumerate((a.AMARELO, a.MAGENTA, fx.CIANO)):
                if u_res >= 0.3 * i:
                    k = min(1.0, (u_res - 0.3 * i) / 0.15)
                    tam = int(84 * (0.6 + 0.4 * k))
                    cx, cy = 130 + i * 150, 296
                    d.rectangle((cx - tam // 2, cy - tam // 2, cx + tam // 2, cy + tam // 2), fill=cor, outline=PRETO, width=3)
    if _desde(lt, m, "js") >= 0:
        fx.botao(d, (LARG - 262, ALT - 70, LARG - 24, ALT - 16), "{ } JavaScript", a.fonte("mono", 24))
    return fx.cromo_janela(tela, "matematica.txt - Editor" if u_cod < 0 else "exercicio.js - Editor")


# ------------------------------------------------------------------ mito 3: digitar

ETAPAS = [("entender", "entender"), ("ler código", "ler"), ("testar", "testar"), ("corrigir", "corrigir")]


def esteira(lt, m):
    t = _desde(lt, m, "teclado")
    if t < 0:
        return None
    tela = _tela(CINZA)
    d = ImageDraw.Draw(tela)
    u_est = _desde(lt, m, "esteira")
    if u_est < 0.3:
        op = 1.0 if u_est < 0 else 1 - u_est / 0.3
        s = Image.new("RGBA", (114, 34), (0, 0, 0, 0))
        ds = ImageDraw.Draw(s)
        ds.rectangle((0, 0, 113, 33), fill=(150, 150, 150, 255), outline=PRETO + (255,))
        rnd = random.Random(int(lt * 12))
        apertadas = {(rnd.randrange(4), rnd.randrange(14)) for _ in range(5)}
        for r in range(4):
            for c in range(14):
                x0, y0 = 2 + c * 8, 2 + r * 8
                cor = AZUL if (r, c) in apertadas else (232, 232, 232)
                ds.rectangle((x0, y0, x0 + 6, y0 + 6), fill=cor + (255,))
                ds.line((x0, y0 + 6, x0 + 6, y0 + 6), fill=ESCURO + (255,))
                ds.line((x0 + 6, y0, x0 + 6, y0 + 6), fill=ESCURO + (255,))
        teclado = fx.ampliar(s, 7)
        a.colar(tela, teclado, (LARG - teclado.width) // 2, 40, op)
        if u_est < 0:
            d.text((LARG // 2, ALT - 34), f"teclas digitadas: {int(t * 2400):,}".replace(",", "."),
                   font=a.fonte("mono", 26), fill=PRETO, anchor="mm")
    if u_est >= 0:
        d.rectangle((20, 318, LARG - 20, 358), fill=(72, 72, 72), outline=PRETO)
        desloc = int((lt * 140) % 40)
        for x in range(20 - 40 + desloc, LARG - 20, 40):
            x0, x1 = max(22, x), min(LARG - 22, x + 18)
            if x1 > x0:
                d.rectangle((x0, 322, x1, 354), fill=(108, 108, 108))
        for x in range(46, LARG - 20, 90):
            d.ellipse((x - 14, 362, x + 14, 390), fill=(48, 48, 48), outline=PRETO)
        xs = [22 + i * 214 + 98 for i in range(len(ETAPAS))]
        f = a.fonte("corpo", 27)
        for i, (rotulo, marca) in enumerate(ETAPAS):
            ativo = _desde(lt, m, marca) >= 0
            x0 = 22 + i * 214
            fx.botao(d, (x0, 130, x0 + 196, 258), rotulo, f, apertado=ativo,
                     cor=AZUL if ativo else CINZA, cor_texto=BRANCO if ativo else PRETO)
        # pacote de código que anda pela esteira até a etapa que está sendo dita
        px, anterior = -60.0, -60.0
        for i, (_, marca) in enumerate(ETAPAS):
            px += (xs[i] - anterior) * a.ease_out_cubic(min(1.0, max(0.0, _desde(lt, m, marca) / 0.45)))
            anterior = xs[i]
        pac = Image.new("RGBA", (12, 10), (0, 0, 0, 0))
        dp = ImageDraw.Draw(pac)
        dp.rectangle((0, 0, 11, 9), fill=fx.CIANO + (255,), outline=PRETO + (255,))
        dp.point([(3, 3), (2, 4), (3, 5), (8, 3), (9, 4), (8, 5)], fill=PRETO + (255,))
        pacote = fx.ampliar(pac, 5)
        a.colar(tela, pacote, int(px - pacote.width / 2), 266)
    return fx.cromo_janela(tela, "teclado.exe" if u_est < 0 else "rotina.exe")


# ------------------------------------------------------------------ mito 4: erro

def erro(lt, m):
    t = _desde(lt, m, "codigo")
    if t < 0:
        return None
    tela = _tela(BRANCO)
    d = ImageDraw.Draw(tela)
    u_al, u_cor, u_res = _desde(lt, m, "alerta"), _desde(lt, m, "correcao"), _desde(lt, m, "resultado")
    corrigido = u_cor >= 0.5
    linha2 = 'console.log("Oi, " + nome' + (")" if u_cor >= 0.2 else "")
    if u_al >= 0:
        d.rectangle((14, 86, LARG - 14, 134), fill=(205, 240, 205) if corrigido else (255, 210, 210))
    f = a.fonte("mono", 28)
    xfim = 0
    for i, (num, texto) in enumerate((("1", 'const nome = "Ana"'), ("2", linha2))):
        y = 52 + i * 58
        d.text((26, y), num, font=f, fill=ESCURO, anchor="lm")
        xfim = _codigo(d, 70, y, texto)
    if u_al >= 0 and u_cor < 0.2:
        x0 = 70 + f.getlength('console.log("Oi, " + ')
        pts = [(x0 + k * 10, 126 + (4 if k % 2 else 0)) for k in range(int(f.getlength("nome") / 10) + 2)]
        d.line(pts, fill=(200, 0, 0), width=3)
    if 0 <= u_cor < 0.7:
        _cursor(d, xfim, 110, 30, lt)
    console = (14, 168, LARG - 14, ALT - 12)
    d.rectangle(console, fill=PRETO)
    fx.bisel(d, console, "afundado")
    fm = a.fonte("mono", 24)
    d.text((32, 200), "C:\\> node ola.js", font=fm, fill=(192, 192, 192), anchor="lm")
    if u_al >= 0 and not corrigido:
        d.text((32, 248), "SyntaxError: missing ) after argument list", font=fm, fill=(255, 90, 90), anchor="lm")
    elif corrigido and u_res >= 0:
        d.text((32, 252), "Oi, Ana", font=a.fonte("mono", 30), fill=(235, 235, 235), anchor="lm")
        a.colar(tela, _check(5, VERDE_CLARO), 172, 234)
    elif corrigido:
        d.text((32, 248), "...", font=fm, fill=(192, 192, 192), anchor="lm")
    return fx.cromo_janela(tela, "ola.js - Editor")


# ------------------------------------------------------------------ mito 5: computador

def pcs(lt, m):
    t = _desde(lt, m, "pcs")
    if t < 0:
        return None
    tela = _tela(CINZA)
    d = ImageDraw.Draw(tela)
    u_b, u_p = _desde(lt, m, "basico"), _desde(lt, m, "pesados")
    s = Image.new("RGBA", (60, 56), (0, 0, 0, 0))
    ds = ImageDraw.Draw(s)
    ds.rectangle((4, 2, 56, 40), fill=(214, 205, 180, 255), outline=(70, 60, 40, 255))
    ds.rectangle((9, 6, 51, 34), fill=(10, 24, 12, 255))
    ds.rectangle((26, 41, 34, 45), fill=(190, 180, 150, 255))
    ds.rectangle((6, 46, 54, 54), fill=(204, 196, 170, 255), outline=(70, 60, 40, 255))
    simples = fx.ampliar(s, 4)
    if u_b >= 0:
        ms = "> Olá, mundo!"
        n = int(len(ms) * min(1.0, u_b / 0.9))
        ImageDraw.Draw(simples).text((44, 70), ms[:n], font=a.fonte("mono", 21), fill=VERDE_CLARO, anchor="lm")
        if u_b > 1.0:
            a.colar(simples, _check(4, VERDE_CLARO), 150, 92)
    a.colar(tela, simples, 70, 84)
    d.text((70 + simples.width // 2, 346), "computador básico", font=a.fonte("corpo", 27),
           fill=PRETO if u_b >= 0 else ESCURO, anchor="mm")
    tb = Image.new("RGBA", (80, 70), (0, 0, 0, 0))
    dt = ImageDraw.Draw(tb)
    dt.rectangle((2, 4, 58, 44), fill=(20, 20, 26, 255), outline=PRETO + (255,))
    dt.rectangle((6, 8, 54, 40), fill=(10, 10, 16, 255))
    dt.rectangle((24, 45, 36, 51), fill=(40, 40, 50, 255))
    dt.rectangle((62, 6, 78, 66), fill=(24, 22, 30, 255), outline=PRETO + (255,))
    for i in range(5):
        r, g, b = colorsys.hsv_to_rgb((lt * 0.5 + i * 0.2) % 1, 0.8, 1.0)
        dt.rectangle((65, 12 + i * 10, 75, 15 + i * 10), fill=(int(r * 255), int(g * 255), int(b * 255), 255))
    turbo = fx.ampliar(tb, 4)
    ImageDraw.Draw(turbo).text((120, 96), "TURBO", font=a.fonte("titulo", 44), fill=a.AMARELO, anchor="mm")
    raio, op = 0.0, 1.0
    if u_b >= 0:
        k = fx.suave(u_b / 0.8)
        raio, op = 7 * k, 1 - 0.55 * k
    if u_p >= 0:
        k = fx.suave(u_p / 0.6)
        raio, op = raio - 4 * k, op + 0.3 * k
    if raio > 0.3:
        turbo = turbo.filter(ImageFilter.GaussianBlur(raio))
    a.colar(tela, turbo, 520, 56, op)
    return fx.cromo_janela(tela, "setup.txt - Editor")


DEMOS = {"livro": livro, "formula": formula, "esteira": esteira, "erro": erro, "pcs": pcs}
