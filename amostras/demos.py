"""Demonstrações visuais curtas do vídeo B e do carrossel de mitos: telas e pixel art desenhadas
aqui (nenhum ícone ou imagem de terceiros; o selo de JavaScript é um rótulo próprio, sem logotipo).

Cada demo recebe lt (segundos desde o início da cena) e m (instante de cada marca, em segundos) e
devolve o painel 912x500 com moldura de janela retrô, ou None antes da primeira marca. Com m vazio,
todas as marcas contam como já passadas: é o estado final, usado no carrossel.
"""
import colorsys
import math
import random
import re

from PIL import Image, ImageDraw, ImageFilter

import arte as a
import efeitos as fx

a.FONTES.setdefault("matematica", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
LARG, ALT = 900, 430
VERDE = (60, 220, 140)
VERMELHO = (255, 90, 120)
FUNDO_TELA = (22, 12, 40)


def _tela():
    img = Image.new("RGB", (LARG, ALT), FUNDO_TELA)
    d = ImageDraw.Draw(img)
    for y in range(12, ALT, 24):
        for x in range(12, LARG, 24):
            d.point((x, y), fill=(44, 30, 74))
    return img


def _desde(lt, m, nome):
    """Segundos desde a marca; marca ausente conta como passada há muito tempo."""
    return lt - m.get(nome, -99.0)


def _check(tam=6, cor=VERDE):
    s = Image.new("RGBA", (9, 7), (0, 0, 0, 0))
    ImageDraw.Draw(s).line([(0, 3), (3, 6), (8, 0)], fill=cor + (255,), width=2)
    return fx.ampliar(s, tam)


def _cursor(d, x, y, alto, lt):
    if int(lt * 4) % 2 == 0:
        d.rectangle((x + 2, y - alto // 2, x + 14, y + alto // 2), fill=a.AMARELO)


PALAVRAS_CHAVE = {"for", "let", "const"}


def _codigo(d, x, y, texto, tam=30):
    """Escreve uma linha de código com cores simples (palavras-chave, números, textos)."""
    f = a.fonte("mono", tam)
    for tok in re.findall(r'"[^"]*"?|\w+|\s+|[^\w\s]', texto):
        if tok in PALAVRAS_CHAVE:
            cor = a.MAGENTA
        elif tok.startswith('"'):
            cor = VERDE
        elif tok.isdigit():
            cor = a.AMARELO
        elif tok in ("console", "log", "ctx", "fillRect"):
            cor = fx.CIANO
        else:
            cor = a.TEXTO
        d.text((x, y), tok, font=f, fill=cor, anchor="lm")
        x += f.getlength(tok)
    return x


# ------------------------------------------------------------------ mito 1: decorar

def livro(lt, m):
    t = _desde(lt, m, "livro")
    if t < 0:
        return None
    tela = _tela()
    d = ImageDraw.Draw(tela)
    u_docs = _desde(lt, m, "docs")
    if u_docs < 0.3:
        s = Image.new("RGBA", (64, 46), (0, 0, 0, 0))
        ds = ImageDraw.Draw(s)
        ds.rectangle((6, 38, 60, 44), fill=(240, 230, 210, 255))
        ds.rectangle((56, 4, 62, 42), fill=(240, 230, 210, 255))
        for yy in range(6, 42, 3):
            ds.line((57, yy, 61, yy), fill=(196, 184, 166, 255))
        ds.rectangle((2, 2, 58, 40), fill=(190, 40, 150, 255), outline=(60, 10, 50, 255))
        ds.rectangle((2, 2, 8, 40), fill=(120, 20, 100, 255))
        ds.rectangle((14, 14, 52, 27), fill=a.AMARELO + (255,))
        img = fx.ampliar(s, 5)
        ImageDraw.Draw(img).text((165, 102), "TODO O CÓDIGO", font=a.fonte("titulo", 25), fill=a.BG0, anchor="mm")
        queda = 1 - a.ease_out_back(min(1.0, t / 0.5))
        x = (LARG - img.width) // 2
        y = 60 - int(330 * queda) + int(5 * math.sin(lt * 3.2))
        if u_docs < 0:
            a.colar(tela, img, x, y)
            pag = min(9999, 1 + int(t * 900))
            d.text((LARG - 30, ALT - 26), f"pág. {pag:,} de 9.999".replace(",", "."), font=a.fonte("mono", 26),
                   fill=a.SUAVE, anchor="rs")
        else:
            puf = fx.explosao(0.35 + u_docs / 0.3 * 0.6, semente=9, esc=6, clara=False)
            a.colar(tela, puf, LARG // 2 - puf.width // 2, 175 - puf.height // 2)
    if u_docs >= 0.15:
        u = u_docs - 0.15
        d.rounded_rectangle((36, 26, LARG - 36, 96), 18, fill=(40, 26, 70), outline=a.ROXO, width=3)
        lupa = Image.new("RGBA", (9, 9), (0, 0, 0, 0))
        dl = ImageDraw.Draw(lupa)
        dl.ellipse((0, 0, 5, 5), outline=a.TEXTO + (255,))
        dl.line((5, 5, 8, 8), fill=a.TEXTO + (255,))
        a.colar(tela, fx.ampliar(lupa, 4), 56, 43)
        consulta = "ordenar uma lista em JavaScript"
        n = int(len(consulta) * min(1.0, u / 0.9))
        f = a.fonte("mono", 28)
        d.text((110, 61), consulta[:n], font=f, fill=a.TEXTO, anchor="lm")
        if u < 1.3:
            _cursor(d, 110 + f.getlength(consulta[:n]), 61, 30, lt)
        linhas = [("array.sort()", "ordena os itens da lista"),
                  ("array.toSorted()", "devolve uma cópia ordenada"),
                  ("[3, 1, 2].sort()", "resultado: [1, 2, 3]")]
        for i, (cod, desc) in enumerate(linhas):
            if u < 1.0 + 0.35 * i:
                break
            y = 122 + i * 98
            d.rounded_rectangle((36, y, LARG - 36, y + 82), 16, fill=(34, 22, 60), outline=(90, 60, 150), width=2)
            d.text((60, y + 41), cod, font=a.fonte("mono", 30), fill=a.AMARELO, anchor="lm")
            d.text((LARG - 60, y + 41), desc, font=a.fonte("corpo", 27), fill=a.TEXTO, anchor="rm")
    return fx.cromo_janela(tela, "decorar.exe" if u_docs < 0 else "documentacao.html")


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
        d.text((x, base + 14), "∫", font=g, fill=a.TEXTO, anchor="ls")
        d.text((x + 40, base - 70), "∞", font=p, fill=a.TEXTO, anchor="ls")
        d.text((x + 44, base + 30), "0", font=p, fill=a.TEXTO, anchor="ls")
        x += 78
        d.text((x, base), "e", font=n, fill=a.TEXTO, anchor="ls")
        x += n.getlength("e") + 2
        d.text((x, base - 32), "−x²", font=p, fill=a.TEXTO, anchor="ls")
        x += p.getlength("−x²") + 14
        d.text((x, base), "dx = √π / 2", font=n, fill=a.TEXTO, anchor="ls")
        img = img.crop(img.getchannel("A").getbbox())
        _formula = Image.new("RGBA", (LARG, 170), (0, 0, 0, 0))
        _formula.alpha_composite(img, ((LARG - img.width) // 2, (170 - img.height) // 2))
    return _formula


def formula(lt, m):
    t = _desde(lt, m, "formula")
    if t < 0:
        return None
    tela = _tela()
    d = ImageDraw.Draw(tela)
    u_cod = _desde(lt, m, "codigo")
    if u_cod < 0.35:
        op = 1.0 if u_cod < 0 else max(0.0, 1 - u_cod / 0.35)
        rnd = random.Random(int(lt * 15))
        a.colar(tela, _integral(), rnd.randint(-4, 4), 130 + rnd.randint(-3, 3), op)
        if u_cod < 0:
            for i, (x, y) in enumerate([(130, 80), (770, 100), (210, 320), (700, 330)]):
                if t > 0.5 + 0.35 * i:
                    d.text((x, y), "?", font=a.fonte("titulo", 70), fill=a.MAGENTA, anchor="mm")
    if u_cod >= 0.2:
        u = u_cod - 0.2
        linhas = ["for (let i = 0; i < 3; i++) {", "  ctx.fillRect(i * 40, 0, 30, 30)", "}"]
        n = int(sum(len(l) for l in linhas) * min(1.0, u / 1.4))
        y, xfim, yfim = 44, 40, None
        for l in linhas:
            vis = l[:max(0, n)]
            n -= len(l)
            if vis:
                xfim, yfim = _codigo(d, 40, y, vis), y
            y += 46
        if u < 1.6 and yfim is not None:
            _cursor(d, xfim, yfim, 30, lt)
        u_res = _desde(lt, m, "resultado")
        if u_res >= 0:
            d.rounded_rectangle((40, 200, 560, 400), 14, outline=(90, 60, 150), width=2, fill=(30, 18, 52))
            d.text((58, 222), "resultado", font=a.fonte("mono", 22), fill=a.SUAVE, anchor="lm")
            for i, cor in enumerate((a.AMARELO, a.MAGENTA, fx.CIANO)):
                if u_res >= 0.3 * i:
                    k = min(1.0, (u_res - 0.3 * i) / 0.15)
                    tam = int(84 * (0.6 + 0.4 * k))
                    cx, cy = 140 + i * 150, 310
                    d.rectangle((cx - tam // 2, cy - tam // 2, cx + tam // 2, cy + tam // 2), fill=cor)
    if _desde(lt, m, "js") >= 0:
        selo = a.pilula("{ } JavaScript", 24, a.TEXTO, a.AMARELO)
        a.colar(tela, selo, LARG - selo.width - 24, ALT - selo.height - 20)
    return fx.cromo_janela(tela, "matematica.txt" if u_cod < 0 else "exercicio.js")


# ------------------------------------------------------------------ mito 3: digitar

ETAPAS = [("entender", "entender"), ("ler código", "ler"), ("testar", "testar"), ("corrigir", "corrigir")]


def esteira(lt, m):
    t = _desde(lt, m, "teclado")
    if t < 0:
        return None
    tela = _tela()
    d = ImageDraw.Draw(tela)
    u_est = _desde(lt, m, "esteira")
    if u_est < 0.3:
        op = 1.0 if u_est < 0 else 1 - u_est / 0.3
        s = Image.new("RGBA", (114, 34), (0, 0, 0, 0))
        ds = ImageDraw.Draw(s)
        rnd = random.Random(int(lt * 12))
        apertadas = {(rnd.randrange(4), rnd.randrange(14)) for _ in range(5)}
        for r in range(4):
            for c in range(14):
                x0, y0 = 2 + c * 8, 2 + r * 8
                cor = a.AMARELO if (r, c) in apertadas else (70, 52, 110)
                ds.rectangle((x0, y0, x0 + 6, y0 + 6), fill=cor + (255,))
                ds.line((x0, y0, x0 + 6, y0), fill=(116, 96, 168, 255))
        teclado = fx.ampliar(s, 7)
        a.colar(tela, teclado, (LARG - teclado.width) // 2, 90, op)
        if u_est < 0:
            d.text((LARG // 2, ALT - 40), f"teclas digitadas: {int(t * 2400):,}".replace(",", "."),
                   font=a.fonte("mono", 28), fill=a.SUAVE, anchor="mm")
    if u_est >= 0:
        d.rectangle((20, 330, LARG - 20, 370), fill=(40, 30, 64))
        desloc = int((lt * 140) % 40)
        for x in range(20 - 40 + desloc, LARG - 20, 40):
            x0, x1 = max(20, x), min(LARG - 20, x + 18)
            if x1 > x0:
                d.rectangle((x0, 334, x1, 366), fill=(66, 50, 104))
        for x in range(46, LARG - 20, 90):
            d.ellipse((x - 14, 374, x + 14, 402), fill=(30, 22, 50), outline=(90, 70, 140))
        xs = [28 + i * 214 + 98 for i in range(len(ETAPAS))]
        for i, (rotulo, marca) in enumerate(ETAPAS):
            ativo = _desde(lt, m, marca) >= 0
            x0 = 28 + i * 214
            d.rounded_rectangle((x0, 140, x0 + 196, 268), 18, fill=a.AMARELO if ativo else (44, 30, 74),
                                outline=a.ROXO, width=3)
            d.text((x0 + 98, 204), rotulo, font=a.fonte("corpo", 28), fill=a.BG0 if ativo else a.SUAVE, anchor="mm")
        # pacote de código que anda pela esteira até a etapa que está sendo dita
        px = -60.0
        anterior = -60.0
        for i, (_, marca) in enumerate(ETAPAS):
            px += (xs[i] - anterior) * a.ease_out_cubic(min(1.0, max(0.0, _desde(lt, m, marca) / 0.45)))
            anterior = xs[i]
        pac =Image.new("RGBA", (12, 10), (0, 0, 0, 0))
        dp = ImageDraw.Draw(pac)
        dp.rectangle((0, 0, 11, 9), fill=fx.CIANO + (255,), outline=(10, 40, 50, 255))
        dp.point([(3, 3), (2, 4), (3, 5), (8, 3), (9, 4), (8, 5)], fill=(10, 40, 50, 255))
        pacote = fx.ampliar(pac, 5)
        a.colar(tela, pacote, int(px - pacote.width / 2), 278)
    return fx.cromo_janela(tela, "teclado.exe" if u_est < 0 else "rotina.exe")


# ------------------------------------------------------------------ mito 4: erro

def erro(lt, m):
    t = _desde(lt, m, "codigo")
    if t < 0:
        return None
    tela = _tela()
    d = ImageDraw.Draw(tela)
    u_al, u_cor, u_res = _desde(lt, m, "alerta"), _desde(lt, m, "correcao"), _desde(lt, m, "resultado")
    corrigido = u_cor >= 0.5
    linha2 = 'console.log("Oi, " + nome' + (")" if u_cor >= 0.2 else "")
    if u_al >= 0:
        d.rectangle((20, 96, LARG - 20, 146), fill=(40, 150, 100) if corrigido else (150, 30, 70))
    f = a.fonte("mono", 30)
    for i, (num, texto) in enumerate((("1", 'const nome = "Ana"'), ("2", linha2))):
        y = 60 + i * 61
        d.text((34, y), num, font=f, fill=a.SUAVE, anchor="lm")
        xfim = _codigo(d, 80, y, texto)
    if u_al >= 0 and u_cor < 0.2:
        x0 = 80 + f.getlength('console.log("Oi, " + ')
        pts = [(x0 + k * 10, 138 + (4 if k % 2 else 0)) for k in range(int(f.getlength("nome") / 10) + 2)]
        d.line(pts, fill=VERMELHO, width=3)
    if 0 <= u_cor < 0.7:
        _cursor(d, xfim, 121, 30, lt)
    d.rounded_rectangle((20, 220, LARG - 20, ALT - 20), 14, fill=(14, 8, 26), outline=(90, 60, 150), width=2)
    d.text((40, 244), "console", font=a.fonte("mono", 22), fill=a.SUAVE, anchor="lm")
    if u_al >= 0 and not corrigido:
        d.text((40, 310), "SyntaxError: missing ) after argument list", font=a.fonte("mono", 25), fill=VERMELHO, anchor="lm")
    elif corrigido and u_res >= 0:
        d.text((40, 310), "> Oi, Ana", font=a.fonte("mono", 32), fill=a.TEXTO, anchor="lm")
        a.colar(tela, _check(6), 230, 290)
    elif corrigido:
        d.text((40, 310), "executando...", font=a.fonte("mono", 26), fill=a.SUAVE, anchor="lm")
    return fx.cromo_janela(tela, "ola.js")


# ------------------------------------------------------------------ mito 5: computador

def pcs(lt, m):
    t = _desde(lt, m, "pcs")
    if t < 0:
        return None
    tela = _tela()
    d = ImageDraw.Draw(tela)
    u_b, u_p = _desde(lt, m, "basico"), _desde(lt, m, "pesados")
    s = Image.new("RGBA", (60, 56), (0, 0, 0, 0))
    ds = ImageDraw.Draw(s)
    ds.rectangle((4, 2, 56, 40), fill=(150, 140, 186, 255), outline=(40, 30, 60, 255))
    ds.rectangle((9, 6, 51, 34), fill=(16, 28, 30, 255))
    ds.rectangle((26, 41, 34, 45), fill=(120, 110, 150, 255))
    ds.rectangle((6, 46, 54, 54), fill=(130, 120, 166, 255), outline=(40, 30, 60, 255))
    simples = fx.ampliar(s, 4)
    if u_b >= 0:
        ms = "> Olá, mundo!"
        n = int(len(ms) * min(1.0, u_b / 0.9))
        ImageDraw.Draw(simples).text((44, 70), ms[:n], font=a.fonte("mono", 21), fill=VERDE, anchor="lm")
        if u_b > 1.0:
            a.colar(simples, _check(4), 150, 92)
    a.colar(tela, simples, 70, 100)
    d.text((70 + simples.width // 2, 360), "computador básico", font=a.fonte("corpo", 27),
           fill=a.TEXTO if u_b >= 0 else a.SUAVE, anchor="mm")
    tb = Image.new("RGBA", (80, 70), (0, 0, 0, 0))
    dt = ImageDraw.Draw(tb)
    dt.rectangle((2, 4, 58, 44), fill=(20, 20, 26, 255), outline=(90, 70, 140, 255))
    dt.rectangle((6, 8, 54, 40), fill=(10, 10, 16, 255))
    dt.rectangle((24, 45, 36, 51), fill=(40, 40, 50, 255))
    dt.rectangle((62, 6, 78, 66), fill=(24, 22, 30, 255), outline=(90, 70, 140, 255))
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
    a.colar(tela, turbo, 520, 70, op)
    return fx.cromo_janela(tela, "setup.txt")


DEMOS = {"livro": livro, "formula": formula, "esteira": esteira, "erro": erro, "pcs": pcs}
