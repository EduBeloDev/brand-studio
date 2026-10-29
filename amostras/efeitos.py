"""Efeitos do motor: pixel art (bombinha, explosão, estrelinhas), texto que surge em pixels,
destruição em blocos, transições e efeitos sonoros. Tudo é desenhado ou sintetizado aqui, sem
material de terceiros.

Pixel art: cada sprite é desenhado numa tela pequena e ampliado sem suavizar (NEAREST), o mesmo
tratamento dado ao personagem.
"""
import array
import math
import random
import wave

from PIL import Image, ImageChops, ImageDraw

import arte as a

SR = 44100
CIANO = (60, 240, 255)


def suave(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def entrada(t):
    """Aceleração (para coisas que caem ou encolhem)."""
    t = min(max(t, 0.0), 1.0)
    return t * t * t


def ampliar(img, esc):
    return img.resize((img.width * esc, img.height * esc), Image.NEAREST)


# ------------------------------------------------------------------ sprites

def bomba(quadro=0, esc=6):
    """Bombinha 8-bit: esfera sombreada em tons (luz vindo de cima à esquerda), contorno, brilho,
    tampa metálica inclinada, pavio trançado e faísca animada ('quadro')."""
    n = 26
    s = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    px = s.load()
    cx, cy, r = 11.0, 15.0, 9.2
    luz = (-0.55, -0.62, 0.56)
    tons = [(22, 18, 38), (40, 34, 66), (62, 54, 98), (98, 88, 146), (168, 158, 214)]
    contorno = (8, 6, 14)
    for y in range(n):
        for x in range(n):
            dx, dy = (x + 0.5 - cx) / r, (y + 0.5 - cy) / r
            dd = dx * dx + dy * dy
            if dd > 1:
                continue
            if dd > (1 - 1.15 / r) ** 2:
                px[x, y] = contorno + (255,)
                continue
            nz = math.sqrt(1 - dd)
            i = dx * luz[0] + dy * luz[1] + nz * luz[2]
            k = 0 if i < 0.05 else 1 if i < 0.38 else 2 if i < 0.68 else 3 if i < 0.9 else 4
            if k == 0 and dx > 0.35 and dy > 0.35:   # luz refletida na borda de baixo
                k = 1
            px[x, y] = tons[k] + (255,)
    for x, y in ((6, 10), (7, 10), (6, 11)):          # brilho
        px[x, y] = (236, 232, 255, 255)
    d = ImageDraw.Draw(s)
    tampa = [(14, 4), (19, 7), (17, 10), (12, 7)]
    d.polygon(tampa, fill=(150, 150, 168, 255), outline=contorno + (255,))
    d.line([(14, 5), (18, 7)], fill=(210, 210, 224, 255))
    pavio = [(17, 4), (17, 3), (18, 3), (18, 2), (19, 2), (20, 1), (21, 1), (22, 1)]
    for k, (x, y) in enumerate(pavio):
        px[x, y] = ((222, 190, 132, 255) if k % 2 == 0 else (160, 124, 78, 255))
    faiscas = [
        [((23, 0), (255, 250, 220)), ((24, 1), (255, 236, 120)), ((22, 0), (255, 150, 40)), ((23, 2), (255, 150, 40)),
         ((25, 0), (255, 61, 202))],
        [((23, 1), (255, 250, 220)), ((23, 0), (255, 236, 120)), ((24, 2), (255, 236, 120)), ((22, 2), (255, 150, 40)),
         ((25, 1), (255, 150, 40)), ((21, 0), (255, 61, 202))],
        [((23, 0), (255, 236, 120)), ((24, 0), (255, 150, 40)), ((22, 1), (255, 236, 120)), ((25, 2), (255, 61, 202))],
    ]
    for (x, y), cor in faiscas[quadro % 3]:
        if 0 <= x < n and 0 <= y < n:
            px[x, y] = cor + (255,)
    return ampliar(s, esc)


def explosao(u, semente=3, esc=8, clara=True):
    """Explosão em pixel art; u vai de 0 (estouro) a 1 (fim). clara=False tira o núcleo branco."""
    n = 64
    s = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(s)
    c = n / 2
    e = a.ease_out_cubic(min(1.0, u / 0.55))
    fade = 1.0 if u < 0.5 else max(0.0, 1 - (u - 0.5) / 0.5)
    rnd = random.Random(semente)
    if u > 0.18:
        for _ in range(9):
            ang = rnd.uniform(0, 2 * math.pi)
            r = (9 + 17 * e) * rnd.uniform(0.55, 1.0)
            x, y = c + r * math.cos(ang), c + r * math.sin(ang) - 8 * u
            rr = 2.5 + 5 * u
            d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=(86, 66, 120, int(190 * fade)))
    if u < 0.62:
        r2 = 3 + 19 * e
        d.ellipse((c - r2, c - r2, c + r2, c + r2), fill=(255, 128, 48, int(255 * fade)))
        r1 = r2 * (0.72 - 0.4 * u)
        d.ellipse((c - r1, c - r1, c + r1, c + r1), fill=(255, 220, 90, int(255 * fade)))
        r0 = r1 * (0.6 - 0.6 * u)
        if r0 > 1:
            nucleo = (255, 250, 225) if clara else (255, 196, 80)
            d.ellipse((c - r0, c - r0, c + r0, c + r0), fill=nucleo + (int(255 * fade),))
    for _ in range(20):
        ang = rnd.uniform(0, 2 * math.pi)
        r = (5 + 27 * e) * rnd.uniform(0.75, 1.15)
        x, y = int(c + r * math.cos(ang)), int(c + r * math.sin(ang) + 10 * u * u)
        cor = rnd.choice([(255, 240, 140), (255, 61, 202), (255, 150, 40), (180, 90, 255)])
        d.rectangle((x, y, x + 1, y + 1), fill=cor + (int(255 * fade),))
    return ampliar(s, esc)


def estrela(fase, esc=6):
    """Estrelinha 8-bit que pisca (fase de 0 a 1)."""
    s = Image.new("RGBA", (7, 7), (0, 0, 0, 0))
    d = ImageDraw.Draw(s)
    cor = (255, 240, 140, 255)
    if fase % 1 < 0.5:
        d.point([(3, 2), (2, 3), (3, 3), (4, 3), (3, 4)], fill=cor)
    else:
        d.point([(3, 0), (3, 1), (3, 2), (0, 3), (1, 3), (2, 3), (3, 3), (4, 3), (5, 3), (6, 3), (3, 4), (3, 5), (3, 6)], fill=cor)
    return ampliar(s, esc)


# ------------------------------------------------------------------ texto e destruição

class Digitavel:
    """Imagem de texto que surge em blocos de pixel, da esquerda para a direita e linha a linha,
    como se fosse digitada, com um cursor amarelo na ponta."""

    def __init__(self, img, linhas=1, bloco=8, passos=48, semente=1):
        self.img = img
        self.bloco = bloco
        self.passos = passos
        w, h = img.size
        alfa = img.getchannel("A")
        rnd = random.Random(semente)
        alt = h / max(linhas, 1)
        blocos = []
        for y in range(0, h, bloco):
            for x in range(0, w, bloco):
                if alfa.crop((x, y, min(x + bloco, w), min(y + bloco, h))).getbbox():
                    linha = min(linhas - 1, int((y + bloco / 2) // alt))
                    blocos.append((linha + x / w + rnd.uniform(-0.025, 0.025), x, y))
        blocos.sort()
        self.mascaras, self.cursores = [], []
        m = Image.new("L", (w, h), 0)
        d = ImageDraw.Draw(m)
        feitos = 0
        for k in range(passos + 1):
            alvo = round(len(blocos) * k / passos)
            while feitos < alvo:
                _, x, y = blocos[feitos]
                d.rectangle((x, y, x + bloco - 1, y + bloco - 1), fill=255)
                feitos += 1
            self.mascaras.append(ImageChops.multiply(alfa, m))
            self.cursores.append(blocos[feitos - 1][1:] if feitos else None)

    def quadro(self, p):
        k = max(0, min(self.passos, round(p * self.passos)))
        if k >= self.passos:
            return self.img
        out = self.img.copy()
        out.putalpha(self.mascaras[k])
        cur = self.cursores[k]
        if cur:
            x, y = cur
            ImageDraw.Draw(out).rectangle((x + self.bloco, y, x + 2 * self.bloco - 1, y + 3 * self.bloco - 1),
                                          fill=a.AMARELO + (255,))
        return out


class Destrutivel:
    """Imagem que se desfaz em blocos quando a bombinha explode; os blocos voam a partir do impacto."""

    def __init__(self, img, impacto, bloco=14, semente=5):
        rnd = random.Random(semente)
        self.img = img
        alfa = img.getchannel("A")
        ix, iy = impacto
        self.blocos = []
        for y in range(0, img.height, bloco):
            for x in range(0, img.width, bloco):
                caixa = (x, y, min(x + bloco, img.width), min(y + bloco, img.height))
                if not alfa.crop(caixa).getbbox():
                    continue
                dx, dy = x + bloco / 2 - ix, y + bloco / 2 - iy
                dist = math.hypot(dx, dy) or 1
                vel = rnd.uniform(500, 1300) * (0.6 + 0.4 * math.exp(-dist / 400))
                vx = dx / dist * vel + rnd.uniform(-120, 120)
                vy = dy / dist * vel - rnd.uniform(250, 650)
                self.blocos.append((img.crop(caixa), x, y, vx, vy, dist / 2600))
        self.fim = 0.75 + max((b[5] for b in self.blocos), default=0)

    def colar(self, destino, x0, y0, u):
        """u = segundos desde a explosão (negativo: ainda inteira)."""
        if u < 0:
            a.colar(destino, self.img, x0, y0)
            return
        for pedaco, x, y, vx, vy, atraso in self.blocos:
            t = u - atraso
            if t <= 0:
                a.colar(destino, pedaco, x0 + x, y0 + y)
                continue
            if t > 0.75:
                continue
            px = x0 + x + vx * t
            py = y0 + y + vy * t + 1300 * t * t
            op = 1.0 if t < 0.35 else max(0.0, 1 - (t - 0.35) / 0.4)
            a.colar(destino, pedaco, int(px), int(py), op)


# ------------------------------------------------------------------ transições
# Cada transição recebe A (último quadro da cena que sai, congelado), B (quadro atual da cena
# que entra) e p de 0 a 1. As que precisam de preparo guardam cache pela chave da cena.

_cache = {}


def t_blocos(A, B, p, chave=None):
    """Blocos de pixels: a cena vira mosaico cada vez mais grosso e volta já como a nova."""
    base, q = (A, p / 0.5) if p < 0.5 else (B, (1 - p) / 0.5)
    f = 1 + int(44 * q * q)
    if f <= 1:
        return base.copy()
    w, h = base.size
    return base.resize((max(1, w // f), max(1, h // f)), Image.NEAREST).resize((w, h), Image.NEAREST)


def t_glitch(A, B, p, chave=None):
    """Glitch colorido: faixas deslocadas, canais de cor separados e barras, no auge no meio."""
    base = (A if p < 0.5 else B).copy()
    i = 1 - abs(p - 0.5) * 2
    rnd = random.Random(hash(chave) % 1000 * 100 + int(p * 60))
    w, h = base.size
    for _ in range(int(3 + 12 * i)):
        y = rnd.randrange(0, h - 20)
        faixa = base.crop((0, y, w, min(h, y + rnd.randrange(8, 90))))
        base.paste(faixa, (int(rnd.uniform(-140, 140) * i), y))
    dx = int(26 * i)
    if dx:
        r, g, b = base.split()
        base = Image.merge("RGB", (ImageChops.offset(r, dx, 0), g, ImageChops.offset(b, -dx, 0)))
    if i > 0.3:
        d = ImageDraw.Draw(base, "RGBA")
        for _ in range(3):
            y = rnd.randrange(0, h)
            d.rectangle((0, y, w, y + rnd.randrange(4, 18)), fill=rnd.choice([a.MAGENTA, CIANO]) + (int(90 * i),))
    return base


def t_zoom(A, B, p, chave=None):
    """Zoom de impacto: mergulha na cena que sai, clarão, e a nova assenta vindo de perto."""
    w, h = A.size
    if p < 0.4:
        q = p / 0.4
        s, img, flash = 1 + 0.55 * q * q, A, q ** 2 * 0.85
    else:
        q = (p - 0.4) / 0.6
        s, img, flash = 1.25 - 0.25 * a.ease_out_cubic(q), B, (1 - q) ** 2 * 0.85
    cw, ch = w / s, h / s
    out = img.crop((int((w - cw) / 2), int((h - ch) / 2), int((w + cw) / 2), int((h + ch) / 2))).resize((w, h), Image.BILINEAR)
    if flash > 0.02:
        out = Image.blend(out, Image.new("RGB", (w, h), (255, 245, 255)), flash)
    return out


def t_desmontagem(A, B, p, chave=None, bloco=72):
    """Desmontagem em pixels: a cena que sai se solta em blocos que caem, de cima para baixo."""
    if ("desm", chave) not in _cache:
        rnd = random.Random(7)
        pedacos = []
        for y in range(0, A.height, bloco):
            for x in range(0, A.width, bloco):
                atraso = (y / A.height) * 0.32 + rnd.uniform(0, 0.16)
                pedacos.append((A.crop((x, y, x + bloco, y + bloco)), x, y, rnd.uniform(-260, 260), rnd.uniform(-220, 60), atraso))
        _cache[("desm", chave)] = pedacos
    out = B.copy()
    for img, x, y, vx, vy, atraso in _cache[("desm", chave)]:
        t = (p - atraso) / 0.5
        if t <= 0:
            out.paste(img, (x, y))
            continue
        if t >= 1:
            continue
        tt = t * 0.6
        a.colar(out, img.convert("RGBA"), int(x + vx * tt), int(y + vy * tt + 1800 * tt * tt), 1 - t)
    return out


def t_cacos(A, B, p, chave=None):
    """Quebra em cacos: a tela racha e os cacos caem girando, revelando a nova cena."""
    if ("cacos", chave) not in _cache:
        rnd = random.Random(11)
        cols, linhas = 6, 10
        cw, ch = A.width / cols, A.height / linhas
        pts = [[(c * cw + (rnd.uniform(-0.3, 0.3) * cw if 0 < c < cols else 0),
                 l * ch + (rnd.uniform(-0.3, 0.3) * ch if 0 < l < linhas else 0)) for c in range(cols + 1)] for l in range(linhas + 1)]
        pecas, linhas_racha = [], []
        for l in range(linhas):
            for c in range(cols):
                p00, p10, p01, p11 = pts[l][c], pts[l][c + 1], pts[l + 1][c], pts[l + 1][c + 1]
                linhas_racha += [(p00, p10), (p00, p01), (p00, p11)]
                for tri in ((p00, p10, p11), (p00, p11, p01)):
                    xs, ys = [q[0] for q in tri], [q[1] for q in tri]
                    bx0, by0 = int(min(xs)), int(min(ys))
                    bx1, by1 = int(math.ceil(max(xs))), int(math.ceil(max(ys)))
                    m = Image.new("L", (max(1, bx1 - bx0), max(1, by1 - by0)), 0)
                    ImageDraw.Draw(m).polygon([(q[0] - bx0, q[1] - by0) for q in tri], fill=255)
                    peca = A.crop((bx0, by0, bx1, by1)).convert("RGBA")
                    peca.putalpha(m)
                    atraso = 0.14 + rnd.uniform(0, 0.25) + (sum(ys) / 3) / A.height * 0.12
                    pecas.append((peca, bx0, by0, rnd.uniform(-320, 320), rnd.uniform(-520, -120), rnd.uniform(-200, 200), atraso))
        _cache[("cacos", chave)] = (pecas, linhas_racha)
    pecas, linhas_racha = _cache[("cacos", chave)]
    if p < 0.14:
        out = A.copy()
        d = ImageDraw.Draw(out, "RGBA")
        alcance = p / 0.14
        for q0, q1 in linhas_racha:
            if (q0[1] / A.height) < alcance * 1.2:
                d.line((q0, q1), fill=(255, 255, 255, 170), width=3)
        return out
    out = B.copy()
    for peca, x, y, vx, vy, giro, atraso in pecas:
        t = (p - atraso) / 0.55
        if t <= 0:
            a.colar(out, peca, x, y)
            continue
        if t >= 1:
            continue
        r = peca.rotate(giro * t, resample=Image.BICUBIC, expand=True)
        tt = t * 0.7
        px = x + vx * tt - (r.width - peca.width) / 2
        py = y + vy * tt + 2200 * tt * tt - (r.height - peca.height) / 2
        a.colar(out, r, int(px), int(py), 1.0 if t < 0.7 else (1 - t) / 0.3)
    return out


def t_dissolucao(A, B, p, chave=None):
    """Dissolução gradual: uma imagem se funde na outra."""
    return Image.blend(A, B, suave(p))


# Visual de janela do sistema antigo: cinza em relevo, barra de título azul em degradê.
W98_CINZA, W98_CLARO, W98_BRANCO = (192, 192, 192), (223, 223, 223), (255, 255, 255)
W98_ESCURO, W98_PRETO = (128, 128, 128), (0, 0, 0)
W98_AZUL, W98_AZUL2 = (0, 0, 128), (16, 132, 208)


def bisel(d, caixa, tipo="janela", e=2):
    """Relevo de duas linhas (luz em cima/esquerda, sombra embaixo/direita); 'afundado' inverte."""
    x0, y0, x1, y1 = caixa
    camadas = {"janela": ((W98_CLARO, W98_PRETO), (W98_BRANCO, W98_ESCURO)),
               "botao": ((W98_BRANCO, W98_PRETO), (W98_CLARO, W98_ESCURO)),
               "afundado": ((W98_ESCURO, W98_BRANCO), (W98_PRETO, W98_CLARO))}[tipo]
    for k, (luz, sombra) in enumerate(camadas):
        o = k * e
        d.rectangle((x0 + o, y0 + o, x1 - o, y0 + o + e - 1), fill=luz)
        d.rectangle((x0 + o, y0 + o, x0 + o + e - 1, y1 - o), fill=luz)
        d.rectangle((x0 + o, y1 - o - e + 1, x1 - o, y1 - o), fill=sombra)
        d.rectangle((x1 - o - e + 1, y0 + o, x1 - o, y1 - o), fill=sombra)


def botao(d, caixa, texto=None, fonte=None, apertado=False, cor=W98_CINZA, cor_texto=W98_PRETO):
    d.rectangle(caixa, fill=cor)
    bisel(d, caixa, "afundado" if apertado else "botao")
    if texto:
        x0, y0, x1, y1 = caixa
        d.text(((x0 + x1) / 2 + (2 if apertado else 0), (y0 + y1) / 2 + (2 if apertado else 0)), texto,
               font=fonte, fill=cor_texto, anchor="mm")


# Som de cada transição do catálogo: (nome do som, volume, parâmetros).
SOM_TRANSICAO = {
    "blocos": [("desmonte", 0.8, {})], "glitch": [("glitch", 0.9, {})], "zoom": [("zum", 0.9, {})],
    "cacos": [("vidro", 0.9, {})], "desmontagem": [("desmonte", 0.7, {})],
    "dissolucao": [("whoosh", 0.25, {"dur": 0.6})],
}


def cromo_janela(img, titulo=None, menu=("Arquivo", "Editar", "Exibir", "Ajuda")):
    """Moldura de janela no estilo do sistema antigo em volta de uma imagem: borda em relevo, barra
    de título azul com ícone e botões, barra de menus e área de conteúdo afundada.
    Acrescenta 20 px na largura e 92 px na altura."""
    titulo = titulo or a.NOME_MARCA
    w, h = img.size
    largura, altura = w + 20, h + 92
    out = Image.new("RGB", (largura, altura), W98_CINZA)
    d = ImageDraw.Draw(out)
    bisel(d, (0, 0, largura - 1, altura - 1), "janela")
    tx0, ty0, tx1, ty1 = 6, 6, largura - 7, 45
    mascara = Image.linear_gradient("L").rotate(90).resize((tx1 - tx0 + 1, ty1 - ty0 + 1))
    barra = Image.composite(Image.new("RGB", mascara.size, W98_AZUL2), Image.new("RGB", mascara.size, W98_AZUL), mascara)
    out.paste(barra, (tx0, ty0))
    icone = Image.new("RGBA", (10, 12), (0, 0, 0, 0))
    di = ImageDraw.Draw(icone)
    di.polygon([(0, 0), (6, 0), (9, 3), (9, 11), (0, 11)], fill=W98_BRANCO + (255,), outline=W98_PRETO + (255,))
    di.line([(6, 0), (6, 3), (9, 3)], fill=W98_PRETO + (255,))
    for yy in (5, 7, 9):
        di.line([(2, yy), (7, yy)], fill=W98_AZUL + (255,))
    out.paste(ampliar(icone, 2), (tx0 + 8, ty0 + 8), ampliar(icone, 2))
    d.text((tx0 + 36, (ty0 + ty1) / 2), titulo, font=a.fonte("titulo", 22), fill=W98_BRANCO, anchor="lm")
    bw, bh = 32, 28
    by = ty0 + (ty1 - ty0 + 1 - bh) // 2
    fechar = tx1 - 4 - bw
    maxi = fechar - 6 - bw
    mini = maxi - bw
    for x in (fechar, maxi, mini):
        botao(d, (x, by, x + bw - 1, by + bh - 1))
    d.line((fechar + 10, by + 8, fechar + bw - 11, by + bh - 9), fill=W98_PRETO, width=3)
    d.line((fechar + 10, by + bh - 9, fechar + bw - 11, by + 8), fill=W98_PRETO, width=3)
    d.rectangle((maxi + 9, by + 7, maxi + bw - 10, by + bh - 8), outline=W98_PRETO, width=2)
    d.rectangle((maxi + 9, by + 7, maxi + bw - 10, by + 10), fill=W98_PRETO)
    d.rectangle((mini + 9, by + bh - 11, mini + 20, by + bh - 8), fill=W98_PRETO)
    f = a.fonte("corpo", 20)
    x = 16
    for item in menu:
        d.text((x, 63), item, font=f, fill=W98_PRETO, anchor="lm")
        d.line((x, 74, x + f.getlength(item[0]), 74), fill=W98_PRETO, width=2)
        x += f.getlength(item) + 28
    bisel(d, (6, 78, largura - 7, altura - 7), "afundado")
    out.paste(img, (10, 82))
    return out


TRANSICOES = {
    "blocos": (t_blocos, 0.55),
    "glitch": (t_glitch, 0.45),
    "zoom": (t_zoom, 0.5),
    "desmontagem": (t_desmontagem, 0.75),
    "cacos": (t_cacos, 0.85),
    "dissolucao": (t_dissolucao, 0.6),
}


def transicao(nome, A, B, p, chave):
    f, _ = TRANSICOES[nome]
    return f(A, B, p, chave)


# ------------------------------------------------------------------ sons (síntese própria)

def _quadrada(f, t):
    return 1.0 if (f * t) % 1 < 0.5 else -1.0


def s_tique(freq=1900, dur=0.012, vol=0.22):
    """8-bit: um tique curto (digitação)."""
    n = int(SR * dur)
    return [vol * _quadrada(freq, k / SR) * (1 - k / n) ** 2 for k in range(n)]


def s_tecla(semente=0, vol=0.3):
    """Realista: clique de tecla."""
    rnd = random.Random(semente)
    n = int(SR * 0.016)
    return [vol * (rnd.random() * 2 - 1) * (1 - k / n) ** 6 for k in range(n)]


def s_pop(f0=900, f1=320, dur=0.07, vol=0.45):
    n = int(SR * dur)
    out, fase = [], 0.0
    for k in range(n):
        u = k / n
        fase += 2 * math.pi * (f0 + (f1 - f0) * u) / SR
        out.append(vol * math.sin(fase) * (1 - u) ** 1.5)
    return out


def s_alerta(vol=0.26):
    """8-bit: 'uh-oh' de duas notas para apresentar o mito."""
    out = []
    for f in (660, 440):
        n = int(SR * 0.1)
        out += [vol * _quadrada(f, k / SR) * min(1, (n - k) / 300) for k in range(n)]
    return out


def s_pavio(dur, semente=1, vol=0.14):
    """Pavio aceso: chiado com estalinhos."""
    rnd = random.Random(semente)
    n = int(SR * dur)
    out, ant = [], 0.0
    for k in range(n):
        r = rnd.random() * 2 - 1
        v = (r - ant) * 0.5
        ant = r
        if rnd.random() < 0.0009:
            v += rnd.uniform(-1, 1) * 2.5
        out.append(vol * v * min(1, k / 2000))
    return out


def s_explosao(semente=2, vol=0.9):
    """Explosão: baque grave + ruído abafado (realista) com um ronco 8-bit por cima."""
    rnd = random.Random(semente)
    n = int(SR * 0.9)
    out, fase, y = [], 0.0, 0.0
    for k in range(n):
        t = k / SR
        fase += 2 * math.pi * (90 - 55 * min(1, t / 0.4)) / SR
        baque = math.sin(fase) * math.exp(-t * 6)
        y += 0.08 * ((rnd.random() * 2 - 1) - y)
        ruido = y * 3.2 * math.exp(-t * 4.5)
        ronco = 0.3 * _quadrada(70, t) * math.exp(-t * 12)
        out.append(vol * (0.8 * baque + ruido + ronco) * min(1, k / 80))
    return out


def s_ding(vol=0.3):
    """'Ding' suave para a verdade."""
    n = int(SR * 0.7)
    return [vol * math.exp(-k / SR * 5) * (math.sin(2 * math.pi * 1318.5 * k / SR) + 0.5 * math.sin(2 * math.pi * 1975.5 * k / SR))
            * min(1, k / 100) for k in range(n)]


def s_whoosh(dur=0.35, semente=4, vol=0.5):
    """Whoosh: ruído com filtro que abre e fecha."""
    rnd = random.Random(semente)
    n = int(SR * dur)
    out, y = [], 0.0
    for k in range(n):
        u = k / n
        coef = 0.02 + 0.35 * math.sin(math.pi * u)
        y += coef * ((rnd.random() * 2 - 1) - y)
        out.append(vol * y * math.sin(math.pi * u) * 2)
    return out


def s_vidro(semente=5, vol=0.5):
    """Vidro quebrando: estalos agudos e tilintar."""
    rnd = random.Random(semente)
    n = int(SR * 0.7)
    out = [0.0] * n
    for _ in range(22):
        ini = int(rnd.uniform(0, 0.45) * SR)
        ant = 0.0
        for k in range(int(SR * 0.018)):
            if ini + k >= n:
                break
            r = rnd.random() * 2 - 1
            out[ini + k] += vol * (r - ant) * (1 - k / (SR * 0.018))
            ant = r
    for _ in range(7):
        ini, f = int(rnd.uniform(0.05, 0.5) * SR), rnd.uniform(3000, 6000)
        for k in range(int(SR * 0.15)):
            if ini + k >= n:
                break
            out[ini + k] += vol * 0.35 * math.sin(2 * math.pi * f * k / SR) * math.exp(-k / SR * 30)
    return out


def s_glitch(semente=6, vol=0.22):
    """Glitch digital: picotes de onda quadrada em frequências aleatórias."""
    rnd = random.Random(semente)
    out = []
    for _ in range(14):
        n = int(SR * 0.028)
        f = rnd.uniform(180, 2200)
        liga = rnd.random() < 0.8
        out += [vol * _quadrada(f, k / SR) * liga for k in range(n)]
    return out


def s_desmonte(semente=7, vol=0.2):
    """Desmontagem: blips 8-bit descendo."""
    rnd = random.Random(semente)
    out = []
    for i in range(12):
        f = 1400 - i * 95 + rnd.uniform(-40, 40)
        n = int(SR * 0.04)
        out += [vol * _quadrada(f, k / SR) * (1 - k / n) for k in range(n)]
    return out


def s_clique(vol=0.4):
    """Clique de janela/mouse."""
    out = []
    for amp in (1.0, 0.5):
        out += [vol * amp * (1 if k % 2 else -1) * (1 - k / 40) for k in range(40)]
        out += [0.0] * 260
    return out


def s_zum(vol=0.35):
    """Subida rápida (zoom)."""
    n = int(SR * 0.3)
    out, fase = [], 0.0
    for k in range(n):
        u = k / n
        fase += 2 * math.pi * (180 + 1100 * u * u) / SR
        out.append(vol * math.sin(fase) * math.sin(math.pi * u))
    return out


def s_esteira(vol=0.4):
    """Baque de esteira."""
    n = int(SR * 0.08)
    return [vol * _quadrada(90, k / SR) * (1 - k / n) ** 2 for k in range(n)]


def s_erro(vol=0.24):
    """Buzina de erro."""
    n = int(SR * 0.3)
    return [vol * _quadrada(140, k / SR) * (0.6 + 0.4 * _quadrada(18, k / SR)) * min(1, (n - k) / 400) for k in range(n)]


def s_sucesso(vol=0.22):
    """Arpejo 8-bit de acerto."""
    out = []
    for f in (1046.5, 1318.5, 1568.0, 2093.0):
        n = int(SR * 0.07)
        out += [vol * _quadrada(f, k / SR) * (1 - k / n) ** 0.5 for k in range(n)]
    return out


SONS = {
    "tique": s_tique, "tecla": s_tecla, "pop": s_pop, "alerta": s_alerta, "explosao": s_explosao,
    "ding": s_ding, "whoosh": s_whoosh, "vidro": s_vidro, "glitch": s_glitch, "desmonte": s_desmonte,
    "clique": s_clique, "zum": s_zum, "esteira": s_esteira, "erro": s_erro, "sucesso": s_sucesso,
}


class Mesa:
    """Trilha de efeitos sonoros: cada som é somado no instante em que acontece na tela."""

    def __init__(self, dur):
        self.buf = array.array("f", bytes(4 * int(SR * (dur + 1.5))))

    def somar(self, ini, amostras, vol=1.0):
        buf, n, i0 = self.buf, len(self.buf), int(ini * SR)
        for k, v in enumerate(amostras):
            i = i0 + k
            if i >= n:
                break
            if i >= 0:
                buf[i] += v * vol

    def salvar(self, caminho, pico=0.8):
        m = max((abs(v) for v in self.buf), default=0) or 1
        g = pico / m
        dados = array.array("h", (int(max(-1.0, min(1.0, v * g)) * 32767) for v in self.buf))
        with wave.open(caminho, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(dados.tobytes())
        return g


def rachar(img, semente):
    """Cartão rachado a partir do canto superior direito, com lascas e fragmentos em pixels."""
    rnd = random.Random(semente)
    w, h = img.size
    out = Image.new("RGBA", (w + 160, h + 120), (0, 0, 0, 0))
    out.alpha_composite(img, (0, 60))
    d = ImageDraw.Draw(out)
    origem = (w - 24, 62)
    for k in range(6):
        ang = math.radians(150 + k * 24 + rnd.uniform(-8, 8))
        x, y = origem
        pts = [(x, y)]
        for _ in range(4):
            passo = rnd.uniform(40, 95)
            ang += rnd.uniform(-0.45, 0.45)
            x, y = x + passo * math.cos(ang), y + passo * math.sin(ang)
            pts.append((x, min(y, h + 56)))
        d.line(pts, fill=(255, 255, 255, 200), width=3)
    for _ in range(14):  # lascas que saíram do cartão
        x, y = origem[0] + rnd.uniform(-30, 30), origem[1] + rnd.uniform(-10, 30)
        t = rnd.choice((10, 14, 18))
        d.rectangle((x, y, x + t, y + t), fill=(0, 0, 0, 0))
    for _ in range(22):  # fragmentos voando para fora
        x = origem[0] + rnd.uniform(10, 150)
        y = origem[1] + rnd.uniform(-60, 50)
        t = rnd.choice((8, 12, 16))
        cor = rnd.choice([a.MAGENTA, a.CARTAO, a.TEXTO, (120, 60, 200)])
        d.rectangle((x, y, x + t, y + t), fill=cor + (rnd.randint(150, 255),))
    puf = explosao(0.32, semente=semente, esc=3)
    out.alpha_composite(puf, (int(origem[0] - puf.width / 2 + 30), int(origem[1] - puf.height / 2)))
    return out
