"""Peças de apoio da amostra marca: cores, fontes, fundo, janela do personagem e texto.

Regra do personagem: o recorte da folha nunca é redesenhado. Ele só é ampliado por um número
inteiro, sem suavizar (cada pixel vira um bloco), e depois a janela inteira se move.
"""
import json
import math
import os
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

AQUI = os.path.dirname(os.path.abspath(__file__))
PERSONAGEM = os.path.join(AQUI, "personagem")

BG0 = (11, 6, 20)
BG1 = (28, 11, 52)
ROXO = (138, 61, 255)
MAGENTA = (255, 61, 202)
AMARELO = (255, 204, 51)
TEXTO = (244, 239, 255)
SUAVE = (186, 172, 220)
CARTAO = (30, 18, 58)

_SG = "/usr/share/fonts/truetype/space-grotesk/SpaceGrotesk-"
_DM = "/usr/share/fonts/truetype/dm-mono/DMMono-"
FONTES = {
    "titulo": _SG + "Bold.ttf",
    "corpo": _SG + "Medium.ttf",
    "mono": _DM + "Medium.ttf",
    "mono-leve": _DM + "Regular.ttf",
}


@lru_cache(maxsize=None)
def fonte(nome, tamanho):
    return ImageFont.truetype(FONTES[nome], tamanho)


def tile(nome):
    return Image.open(os.path.join(PERSONAGEM, f"{nome}.png")).convert("RGB")


# ---------------------------------------------------------------- fundo

def _brilho(base, cor, cx, cy, raio, forca):
    # radial_gradient vai de 0 no centro a 255 nos cantos: a 128 px do centro vale ~181, então
    # a queda precisa chegar a zero em 128 px (a borda), senão a caixa do brilho aparece como emenda.
    m = Image.radial_gradient("L").point(lambda v: max(0, int((255 - v * 1.4142) * forca)))
    m = m.resize((2 * raio, 2 * raio), Image.BICUBIC)
    base.paste(Image.new("RGB", m.size, cor), (cx - raio, cy - raio), m)


def fundo(w, h):
    """Roxo muito escuro com dois brilhos e uma grade de pontos que lembra os pixels do personagem."""
    base = Image.new("RGB", (w, h), BG0)
    grad = Image.linear_gradient("L").resize((w, h))
    base = Image.composite(Image.new("RGB", (w, h), BG1), base, grad)
    _brilho(base, ROXO, int(w * 0.15), int(h * 0.1), int(w * 0.85), 0.42)
    _brilho(base, MAGENTA, int(w * 0.95), int(h * 0.92), int(w * 0.7), 0.26)
    d = ImageDraw.Draw(base)
    passo = 36
    for y in range(passo // 2, h, passo):
        for x in range(passo // 2, w, passo):
            d.rectangle((x, y, x + 2, y + 2), fill=(52, 34, 92))
    return base


# ---------------------------------------------------------------- janela do personagem

def _mascara(w, h, raio):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), raio, fill=255)
    return m


def janela(nome, esc, borda=7, raio=38):
    """O recorte ampliado em número inteiro (sem suavizar), dentro de uma moldura roxa-magenta."""
    t = tile(nome)
    t = t.resize((t.width * esc, t.height * esc), Image.NEAREST).convert("RGBA")
    w, h = t.size
    t.putalpha(_mascara(w, h, raio))
    W, H = w + 2 * borda, h + 2 * borda
    cor = Image.composite(
        Image.new("RGBA", (W, H), MAGENTA + (255,)),
        Image.new("RGBA", (W, H), ROXO + (255,)),
        Image.linear_gradient("L").resize((W, H)),
    )
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.paste(cor, (0, 0), _mascara(W, H, raio + borda))
    out.alpha_composite(t, (borda, borda))
    return out


def aura(janela_img, cor=ROXO, folga=90, desfoque=46, forca=0.75):
    """Luz difusa atrás da janela. Devolve (imagem, deslocamento negativo da folga)."""
    w, h = janela_img.size
    m = Image.new("L", (w + 2 * folga, h + 2 * folga), 0)
    ImageDraw.Draw(m).rounded_rectangle((folga, folga, folga + w, folga + h), 60, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(desfoque)).point(lambda v: int(v * forca))
    img = Image.new("RGBA", m.size, cor + (0,))
    img.putalpha(m)
    return img, folga


def colar(destino, img, x, y, opacidade=1.0):
    """Cola uma imagem RGBA (ou RGB) em um RGB, com opacidade, cortando o que passar da borda."""
    if img.mode != "RGBA":
        destino.paste(img, (x, y))
        return
    a = img.getchannel("A")
    if opacidade < 1.0:
        a = a.point(lambda v: int(v * opacidade))
    destino.paste(img.convert("RGB"), (x, y), a)


# ---------------------------------------------------------------- texto

def _tokens(texto):
    """'Faça *quase tudo*.' vira [(palavra, destacada)]; asteriscos marcam o destaque."""
    saida, ligado = [], False
    for p in texto.split():
        if p.startswith("*"):
            ligado = True
        saida.append((p.replace("*", ""), ligado))
        if "*" in p[1:]:
            ligado = False
    return saida


def quebrar(texto, f, largura):
    d = ImageDraw.Draw(Image.new("L", (1, 1)))
    linhas, atual = [], []
    for palavra, dest in _tokens(texto):
        teste = " ".join(p for p, _ in atual + [(palavra, dest)])
        if atual and d.textlength(teste, font=f) > largura:
            linhas.append(atual)
            atual = []
        atual.append((palavra, dest))
    if atual:
        linhas.append(atual)
    return linhas


def bloco(texto, nome_fonte, tamanho, largura, cor=TEXTO, entrelinha=1.12, alinhar="esq"):
    """Imagem RGBA com o texto quebrado. Palavras com *asteriscos* ganham marcador amarelo."""
    f = fonte(nome_fonte, tamanho)
    linhas = quebrar(texto, f, largura)
    alt = int(tamanho * entrelinha)
    pad = int(tamanho * 0.16)
    img = Image.new("RGBA", (largura + 2 * pad, alt * len(linhas) + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    espaco = d.textlength(" ", font=f)
    for i, linha in enumerate(linhas):
        total = d.textlength(" ".join(p for p, _ in linha), font=f)
        x = pad + ((largura - total) / 2 if alinhar == "centro" else 0)
        y = pad + i * alt
        # primeiro os marcadores (um retângulo por sequência de palavras destacadas)
        xs, j = x, 0
        while j < len(linha):
            if linha[j][1]:
                ini = xs
                k = j
                while k < len(linha) and linha[k][1]:
                    xs += d.textlength(linha[k][0], font=f) + (espaco if k + 1 < len(linha) and linha[k + 1][1] else 0)
                    k += 1
                d.rounded_rectangle(
                    (ini - pad * 0.55, y + tamanho * 0.08, xs + pad * 0.3, y + tamanho * 1.12),
                    radius=int(tamanho * 0.22), fill=AMARELO,
                )
                xs += espaco
                j = k
            else:
                xs += d.textlength(linha[j][0], font=f) + espaco
                j += 1
        xs = x
        for palavra, dest in linha:
            d.text((xs, y), palavra, font=f, fill=BG0 if dest else cor)
            xs += d.textlength(palavra, font=f) + espaco
    return img


def pilula(texto, tamanho=26, cor=TEXTO, borda=AMARELO, preenche=None, folga=(26, 12)):
    """Rótulo no estilo da folha de emotes: caixa com contorno e texto em DM Mono maiúsculo."""
    f = fonte("mono", tamanho)
    d = ImageDraw.Draw(Image.new("L", (1, 1)))
    texto = texto.upper()
    w = int(d.textlength(texto, font=f)) + 2 * folga[0]
    h = int(tamanho * 1.25) + 2 * folga[1]
    img = Image.new("RGBA", (w + 4, h + 4), (0, 0, 0, 0))
    dd = ImageDraw.Draw(img)
    dd.rounded_rectangle((2, 2, w + 1, h + 1), radius=h // 2, fill=(preenche or BG0) + (235,), outline=borda, width=3)
    dd.text((2 + folga[0], 2 + folga[1] + 1), texto, font=f, fill=cor)
    return img


def cartao(w, h, raio=34, borda=(138, 61, 255, 150)):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle((0, 0, w - 1, h - 1), raio, fill=CARTAO + (225,), outline=borda, width=3)
    return img


def seta(tamanho, cor=TEXTO, largura=5):
    """Seta para a direita desenhada à mão (as fontes não trazem o glifo em todas as versões)."""
    img = Image.new("RGBA", (tamanho, tamanho), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    m = tamanho // 2
    d.line((4, m, tamanho - 6, m), fill=cor, width=largura)
    d.line((tamanho - 6 - tamanho // 3, m - tamanho // 3, tamanho - 6, m), fill=cor, width=largura)
    d.line((tamanho - 6 - tamanho // 3, m + tamanho // 3, tamanho - 6, m), fill=cor, width=largura)
    return img


def marca(tamanho=38):
    """Assinatura: quadradinho magenta com brilho + a palavra marca."""
    f = fonte("titulo", tamanho)
    d = ImageDraw.Draw(Image.new("L", (1, 1)))
    tw = int(d.textlength("marca", font=f))
    q = int(tamanho * 0.8)
    img = Image.new("RGBA", (q + 16 + tw + 8, int(tamanho * 1.4)), (0, 0, 0, 0))
    dd = ImageDraw.Draw(img)
    dd.rounded_rectangle((0, 4, q, 4 + q), radius=q // 4, fill=MAGENTA)
    dd.rectangle((q // 4, 4 + q // 4, q // 4 + q // 5, 4 + q // 4 + q // 5), fill=(255, 220, 245))
    dd.text((q + 16, 0), "marca", font=f, fill=TEXTO)
    return img


# ---------------------------------------------------------------- conteúdo

def conteudo():
    with open(os.path.join(AQUI, "conteudo.json"), encoding="utf-8") as a:
        return json.load(a)


def ease_out_cubic(t):
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) ** 3


def ease_out_back(t, s=1.9):
    t = min(max(t, 0.0), 1.0) - 1
    return 1 + (s + 1) * t ** 3 + s * t ** 2
