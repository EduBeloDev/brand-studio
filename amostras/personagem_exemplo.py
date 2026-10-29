"""Personagem de exemplo: um robozinho em pixel art desenhado por código, uma imagem por expressão do catálogo.

Serve para o motor funcionar num clone novo (e nas capturas da documentação) sem o personagem da marca, que fica só
no computador de quem usa. Arte original deste projeto, sem material de terceiros.
Uso: python3 personagem_exemplo.py [pasta]      (padrão: personagem-exemplo/ ao lado deste arquivo)
"""
import os
import sys

from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
G = 48          # grade em pixels de arte
ESC = 4         # cada pixel de arte vira um bloco de 4x4 (192 px no total)

FUNDO = (24, 16, 40)
BRILHO = (52, 30, 88)
CORPO = (188, 178, 222)
SOMBRA = (128, 112, 178)
TELA = (20, 24, 38)
OLHO = (120, 240, 210)
AMARELO = (255, 204, 51)
MAGENTA = (255, 61, 202)
BRANCO = (244, 239, 255)

EXPRESSOES = ['ok', 'joinha', 'ideia', 'feliz', 'pensativo', 'confuso', 'surpreso', 'determinado', 'focado', 'digitando',
              'lendo', 'cansado', 'irritado', 'bracos', 'paz', 'polegar_baixo']


def px(d, x, y, cor, w=1, h=1):
    d.rectangle((x, y, x + w - 1, y + h - 1), fill=cor)


def corpo(d):
    # brilho de fundo, antena, cabeça com tela e ombros
    for r, c in ((20, BRILHO),):
        d.ellipse((24 - r, 24 - r, 24 + r, 24 + r), fill=c)
    px(d, 23, 3, SOMBRA, 2, 5)
    px(d, 22, 1, MAGENTA, 4, 3)
    px(d, 10, 8, CORPO, 28, 24)
    px(d, 10, 30, SOMBRA, 28, 2)
    px(d, 13, 11, TELA, 22, 17)
    px(d, 7, 16, SOMBRA, 3, 8)
    px(d, 38, 16, SOMBRA, 3, 8)
    px(d, 8, 35, CORPO, 32, 13)
    px(d, 8, 35, SOMBRA, 32, 2)
    px(d, 21, 32, SOMBRA, 6, 3)


def olhos(d, tipo):
    if tipo == 'aberto':
        px(d, 17, 15, OLHO, 3, 4); px(d, 28, 15, OLHO, 3, 4)
    elif tipo == 'feliz':
        for dx in (16, 27):
            px(d, dx, 17, OLHO, 1, 1); px(d, dx + 1, 16, OLHO, 3, 1); px(d, dx + 4, 17, OLHO, 1, 1)
    elif tipo == 'grande':
        px(d, 16, 14, OLHO, 5, 5); px(d, 27, 14, OLHO, 5, 5)
        px(d, 18, 16, TELA, 1, 1); px(d, 29, 16, TELA, 1, 1)
    elif tipo == 'meio':
        px(d, 16, 17, OLHO, 5, 2); px(d, 27, 17, OLHO, 5, 2)
    elif tipo == 'bravo':
        px(d, 16, 14, OLHO, 2, 1); px(d, 18, 15, OLHO, 2, 1); px(d, 17, 17, OLHO, 3, 2)
        px(d, 30, 14, OLHO, 2, 1); px(d, 28, 15, OLHO, 2, 1); px(d, 28, 17, OLHO, 3, 2)
    elif tipo == 'baixo':
        px(d, 17, 18, OLHO, 3, 3); px(d, 28, 18, OLHO, 3, 3)
    elif tipo == 'piscando':
        px(d, 17, 15, OLHO, 3, 4); px(d, 27, 17, OLHO, 5, 1)


def boca(d, tipo):
    if tipo == 'sorriso':
        px(d, 19, 23, OLHO, 1, 1); px(d, 20, 24, OLHO, 8, 1); px(d, 28, 23, OLHO, 1, 1)
    elif tipo == 'reta':
        px(d, 20, 24, OLHO, 8, 1)
    elif tipo == 'o':
        px(d, 22, 22, OLHO, 4, 4); px(d, 23, 23, TELA, 2, 2)
    elif tipo == 'triste':
        px(d, 20, 23, OLHO, 8, 1); px(d, 19, 24, OLHO, 1, 1); px(d, 28, 24, OLHO, 1, 1)
    elif tipo == 'torta':
        px(d, 20, 24, OLHO, 3, 1); px(d, 23, 23, OLHO, 5, 1)


def mao(d, x, y, polegar=None):
    px(d, x, y, CORPO, 6, 6)
    px(d, x, y + 5, SOMBRA, 6, 1)
    if polegar == 'cima':
        px(d, x + 1, y - 4, CORPO, 3, 4)
    elif polegar == 'baixo':
        px(d, x + 1, y + 6, CORPO, 3, 4)


def desenhar(nome):
    img = Image.new("RGB", (G, G), FUNDO)
    d = ImageDraw.Draw(img)
    corpo(d)
    rosto = {
        'ok': ('aberto', 'sorriso'), 'joinha': ('piscando', 'sorriso'), 'ideia': ('grande', 'sorriso'),
        'feliz': ('feliz', 'sorriso'), 'pensativo': ('meio', 'torta'), 'confuso': ('aberto', 'torta'),
        'surpreso': ('grande', 'o'), 'determinado': ('bravo', 'reta'), 'focado': ('meio', 'reta'),
        'digitando': ('baixo', 'reta'), 'lendo': ('baixo', 'sorriso'), 'cansado': ('meio', 'triste'),
        'irritado': ('bravo', 'triste'), 'bracos': ('meio', 'reta'), 'paz': ('feliz', 'sorriso'),
        'polegar_baixo': ('aberto', 'triste'),
    }[nome]
    olhos(d, rosto[0])
    boca(d, rosto[1])
    if nome == 'ideia':
        px(d, 39, 3, AMARELO, 5, 5); px(d, 40, 8, SOMBRA, 3, 2)
    elif nome == 'surpreso':
        px(d, 42, 4, AMARELO, 2, 7); px(d, 42, 13, AMARELO, 2, 2)
    elif nome == 'confuso':
        px(d, 40, 3, MAGENTA, 5, 2); px(d, 44, 5, MAGENTA, 1, 3); px(d, 42, 8, MAGENTA, 2, 2); px(d, 42, 12, MAGENTA, 2, 2)
    elif nome == 'joinha':
        mao(d, 38, 38, 'cima')
    elif nome == 'polegar_baixo':
        mao(d, 38, 34, 'baixo')
    elif nome == 'pensativo':
        mao(d, 30, 27)
    elif nome == 'paz':
        mao(d, 38, 38); px(d, 38, 33, CORPO, 2, 5); px(d, 41, 33, CORPO, 2, 5)
    elif nome == 'bracos':
        px(d, 10, 39, SOMBRA, 28, 4)
    elif nome == 'digitando':
        px(d, 6, 41, (70, 70, 96), 36, 6); px(d, 8, 42, (110, 110, 140), 32, 1)
    elif nome == 'lendo':
        px(d, 12, 38, BRANCO, 11, 9); px(d, 25, 38, BRANCO, 11, 9); px(d, 23, 38, SOMBRA, 2, 9)
    elif nome == 'cansado':
        px(d, 40, 6, BRANCO, 3, 1); px(d, 42, 7, BRANCO, 1, 1); px(d, 40, 8, BRANCO, 3, 1)
    elif nome == 'irritado':
        px(d, 40, 4, MAGENTA, 2, 2); px(d, 43, 4, MAGENTA, 2, 2); px(d, 41, 7, MAGENTA, 3, 1)
    elif nome == 'feliz':
        px(d, 4, 6, AMARELO, 2, 2); px(d, 42, 10, AMARELO, 2, 2)
    return img.resize((G * ESC, G * ESC), Image.NEAREST)


def gerar(pasta):
    os.makedirs(pasta, exist_ok=True)
    for nome in EXPRESSOES:
        desenhar(nome).save(os.path.join(pasta, f"{nome}.png"))
    return pasta


if __name__ == "__main__":
    print(gerar(sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, "personagem-exemplo")))
