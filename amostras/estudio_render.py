"""Motor do estúdio do app: transforma quadros (cenas de vídeo e slides de carrossel) em arquivos, com o mesmo
visual das amostras aprovadas (fundo roxo, texto que surge em pixels, personagem na janela, bombinha, janelas do
sistema antigo, transições do catálogo, sons sintetizados, trilha composta na duração exata).

Protocolo com o app: o pedido chega em JSON pela entrada; o script imprime "progresso: ..." enquanto trabalha e
termina com "resultado: {json}" (ou "erro: ..." e código 1).

Uso: python3 estudio_render.py cena|slides|video|tecnica < pedido.json
"""
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

from PIL import Image, ImageDraw

import arte as a
import demos_dados as dd
import efeitos as fx
from efeitos import SOM_TRANSICAO
from voz import envelope, ler_pcm

W, H, FPS = 1080, 1920, 30
M = 84
ATRASO_VOZ = 0.45     # a voz entra depois do corte, quando a transição já assentou
FOLGA_FIM = 0.55      # respiro depois da última palavra
PALAVRAS_POR_S = 2.4  # estimativa de ritmo quando não há voz (prévia e teste rápido)
Y_TEXTO = 330
FUNDO_SEGURO = 1560   # abaixo disso a legenda e os botões das redes cobrem a tela
DEMO_ALT = 500
CACHE_VOZ = os.path.join(a.AQUI, "saida", "cache-vozes")
REF_VOZ = os.path.join(a.AQUI, "ref-piper.wav")
EXPRESSOES = {n[:-4] for n in os.listdir(a.PERSONAGEM) if n.endswith(".png") and "original" not in n}
CAMERAS = ["aprox", "quique", "deslize", "aprox", "quique", "deslize_volta"]


class Erro(Exception):
    pass


def progresso(texto):
    print("progresso: " + texto, flush=True)


def expressao(nome, padrao="ok"):
    return nome if nome in EXPRESSOES else padrao


def chave(p):
    return re.sub(r"[^\wÀ-ÿ]", "", p.lower())


# ------------------------------------------------------------------ voz (Chatterbox com timbre da Piper), com cache

def _hash(fala):
    return hashlib.sha1(f"v1|0.4|0.4|{fala}".encode()).hexdigest()[:16]


def narrar(falas):
    """Devolve, para cada fala, (wav, palavras alinhadas). Só gera o que não está no cache (editar uma cena não refaz
    a narração das outras)."""
    os.makedirs(CACHE_VOZ, exist_ok=True)
    faltam = [f for f in dict.fromkeys(falas) if f.strip() and not os.path.exists(os.path.join(CACHE_VOZ, _hash(f) + ".json"))]
    if faltam:
        python_cb = os.path.join(a.AQUI, ".venv-cb", "bin", "python")
        python_asr = os.path.join(a.AQUI, ".venv-asr", "bin", "python")
        for py in (python_cb, python_asr):
            if not os.path.exists(py):
                raise Erro(f"Falta o ambiente de voz {os.path.relpath(py, a.AQUI)}; veja amostras/README.md.")
        with tempfile.TemporaryDirectory() as tmp:
            lista = os.path.join(tmp, "falas.json")
            json.dump(faltam, open(lista, "w", encoding="utf-8"), ensure_ascii=False)
            progresso(f"narrando {len(faltam)} fala(s) com a voz da marca (leva alguns minutos)")
            r = subprocess.run([python_cb, "gerar_falas.py", lista, tmp, REF_VOZ], cwd=a.AQUI, capture_output=True, text=True)
            if r.returncode != 0:
                raise Erro("A narração falhou: " + (r.stderr.strip().splitlines() or ["sem detalhes"])[-1])
            progresso("alinhando as palavras faladas com a tela")
            r = subprocess.run([python_asr, "alinhar.py", tmp], cwd=a.AQUI, capture_output=True, text=True)
            if r.returncode != 0:
                raise Erro("O alinhamento falhou: " + (r.stderr.strip().splitlines() or ["sem detalhes"])[-1])
            alinhadas = json.load(open(os.path.join(tmp, "palavras.json"), encoding="utf-8"))
            for n, f in enumerate(faltam, 1):
                h = _hash(f)
                shutil.move(os.path.join(tmp, f"cena-{n}.wav"), os.path.join(CACHE_VOZ, h + ".wav"))
                json.dump(alinhadas.get(f"cena-{n}", []), open(os.path.join(CACHE_VOZ, h + ".json"), "w", encoding="utf-8"),
                          ensure_ascii=False)
    saida = []
    for f in falas:
        if not f.strip():
            saida.append((None, []))
            continue
        h = _hash(f)
        saida.append((os.path.join(CACHE_VOZ, h + ".wav"), json.load(open(os.path.join(CACHE_VOZ, h + ".json"), encoding="utf-8"))))
    return saida


def palavras_estimadas(fala):
    """Sem voz: espalha as palavras no tempo pelo tamanho de cada uma."""
    ps = fala.split()
    total = max(1.2, len(ps) / PALAVRAS_POR_S)
    pesos = [max(3, len(p)) + (4 if p[-1:] in ".!?" else 2 if p[-1:] in ",:;" else 0) for p in ps]
    soma, t, out = sum(pesos) or 1, 0.0, []
    for p, w in zip(ps, pesos):
        d = total * w / soma
        out.append(dict(w=p, i=round(t, 3), f=round(t + d * 0.85, 3)))
        t += d
    return out, total


def achar(ws, palavra, depois=0.0):
    if not palavra:
        return None
    alts = [chave(x) for x in palavra.split("|") if chave(x)]
    for p in ws:
        if p["i"] >= depois and any(alt in chave(p["w"]) or chave(p["w"]).startswith(alt) for alt in alts):
            return p["i"]
    return None


# ------------------------------------------------------------------ montagem de cada cena

_fundo, _fundo_limpo, _janelas = {}, {}, {}


def fundo(w=W, h=H, logo=True):
    k = (w, h, logo)
    if k not in _fundo:
        f = a.fundo(w, h)
        if logo:
            a.colar(f, a.marca(36), M, 190 if h == H else 62)
        _fundo[k] = f
    return _fundo[k]


def janela(tile, esc):
    if (tile, esc) not in _janelas:
        j = a.janela(tile, esc)
        aura, _ = a.aura(j)
        _janelas[(tile, esc)] = (j, aura)
    return _janelas[(tile, esc)]


def caixa(texto, borda, tam):
    larg = W - 2 * M
    corpo = a.bloco(texto, "titulo", tam, larg - 70, a.TEXTO, 1.1)
    linhas = len(a.quebrar(texto, a.fonte("titulo", tam), larg - 70))
    alto = corpo.height + 40
    fundo_cx = Image.new("RGBA", (larg, alto), (0, 0, 0, 0))
    ImageDraw.Draw(fundo_cx).rounded_rectangle((0, 0, larg - 1, alto - 1), 30, fill=a.CARTAO + (238,),
                                               outline=borda + (255,), width=4)
    cheia = fundo_cx.copy()
    cheia.alpha_composite(corpo, (28, 20))
    n = len(texto.replace("*", ""))
    return dict(fundo=fundo_cx, texto=fx.Digitavel(corpo, linhas, semente=n), cheia=cheia, dur=min(1.4, 0.032 * n), n=n, alto=alto)


def titulo_digitado(texto, tam):
    largura = W - 2 * M
    while tam > 54 and len(a.quebrar(texto, a.fonte("titulo", tam), largura)) > 4:
        tam -= 6
    img = a.bloco(texto, "titulo", tam, largura)
    linhas = len(a.quebrar(texto, a.fonte("titulo", tam), largura))
    n = len(texto.replace("*", ""))
    return dict(dig=fx.Digitavel(img, linhas, semente=3), img=img, alto=img.height, dur=min(1.6, 0.04 * n), n=n)


def tiques(c, t0, dur, n, passo=3):
    for j in range(0, n, passo):
        c["sons"].append((t0 + dur * j / max(n, 1), "tique", 0.3, {}))


def montar(c, k, total_cenas, voz):
    """Calcula tempos, imagens e sons de uma cena. voz = (wav ou None, palavras, duração da fala)."""
    wav, ws, dur_fala = voz
    c["k"] = k
    c["sons"] = []
    som = c["sons"].append
    c["palavras"] = [dict(w=p["w"], i=p["i"] + ATRASO_VOZ, f=p["f"] + ATRASO_VOZ) for p in ws]
    c["voz"] = wav
    fim_fala = ATRASO_VOZ + dur_fala
    anims = c.get("animacoes") or []
    tipos = {x.get("efeito") for x in anims}
    c["bomba"] = next((x for x in anims if x.get("efeito") == "bombinha"), None)
    c["demo"] = next((x for x in anims if x.get("efeito") == "demonstracao" and x.get("demo")), None)
    tela = (c.get("tela") or "").strip() or (c.get("fala") or "").split(".")[0][:60]
    c["tela"] = tela

    def instante(anim, padrao):
        t = achar(c["palavras"], anim.get("gatilho", ""))
        return t if t is not None else padrao

    if c["bomba"]:
        c["cx"] = caixa(tela, a.MAGENTA, 58)
        c["t_texto"] = 0.35
        som((0.3, "alerta", 0.4, {}))
        tiques(c, 0.47, c["cx"]["dur"], c["cx"]["n"])
        t_expl = instante(c["bomba"], fim_fala + 0.15)
        t_expl = max(t_expl, 0.47 + c["cx"]["dur"] + 0.9)
        c["t_lanc"], c["t_expl"] = t_expl - 0.75, t_expl
        larg = W - 2 * M
        c["pouso"] = (M + larg - 150, Y_TEXTO - 26)
        c["origem"] = (W + 100, 120) if k % 2 else (-140, 120)
        c["dest"] = fx.Destrutivel(c["cx"]["cheia"], (c["pouso"][0] - M, c["pouso"][1] - Y_TEXTO), semente=k + 1)
        som((c["t_lanc"], "whoosh", 0.45, {"dur": 0.45}))
        som((c["t_lanc"], "pavio", 0.5, {"dur": 0.75}))
        som((t_expl, "explosao", 0.75, {}))
        alto = c["cx"]["alto"]
        depois = (c["bomba"].get("detalhe") or "").strip()
        if depois:
            c["cx2"] = caixa(depois, a.AMARELO, 58)
            c["t_depois"] = t_expl + 0.32
            som((c["t_depois"], "pop", 0.3, {}))
            som((c["t_depois"] + 0.12, "ding", 0.45, {}))
            tiques(c, c["t_depois"] + 0.22, c["cx2"]["dur"], c["cx2"]["n"])
            alto = max(alto, c["cx2"]["alto"])
            fim_fala = max(fim_fala, c["t_depois"] + c["cx2"]["dur"] + 1.2)
        else:
            fim_fala = max(fim_fala, t_expl + 0.9)
        y = Y_TEXTO + alto + 40
    else:
        c["td"] = titulo_digitado(tela, 84 if len(tela) > 28 else 96)
        c["t_texto"] = 0.35
        som((0.3, "pop", 0.3, {}))
        tiques(c, 0.35, c["td"]["dur"], c["td"]["n"])
        y = Y_TEXTO + c["td"]["alto"] + 30
    if c["demo"]:
        padrao = max(c["t_texto"] + 1.0, ATRASO_VOZ + 0.3 * dur_fala)
        c["t_demo"] = instante(c["demo"], padrao)
        c["y_demo"] = y
        y += DEMO_ALT + 40
        som((c["t_demo"], "clique", 0.45, {}))
        if c["demo"].get("demo") in ("codigo", "terminal"):
            for j in range(10):
                som((c["t_demo"] + 0.1 + j * 0.13, "tecla", 0.35, {"semente": j}))
        if c["demo"].get("demo") in ("codigo", "terminal") and c["demo"].get("saida"):
            som((c["t_demo"] + 1.9, "sucesso", 0.3, {}))
        if c["demo"].get("demo") == "lista":
            itens = [i for i in (c["demo"].get("itens") or "").split("\n") if i.strip()][:5]
            for j in range(len(itens)):
                som((c["t_demo"] + 0.45 * j + 0.25, "tique", 0.4, {}))
        if c["demo"].get("demo") == "comparacao":
            som((c["t_demo"] + 0.6, "whoosh", 0.3, {"dur": 0.4}))
        fim_fala = max(fim_fala, c["t_demo"] + 2.8)
    c["y_personagem"] = y + 30
    # personagem: expressão base e trocas (animação "personagem")
    trilha = [(0.15, expressao(c.get("expressao")))]
    for x in anims:
        if x.get("efeito") == "personagem" and x.get("detalhe"):
            trilha.append((instante(x, ATRASO_VOZ + 0.6 * dur_fala), expressao(x["detalhe"])))
    if c["bomba"]:
        trilha.append((c["t_expl"], "surpreso"))
        if c.get("cx2"):
            trilha.append((c["t_depois"] + 0.6, expressao(c.get("expressao"))))
    c["trilha"] = sorted(trilha, key=lambda e: e[0])
    for t, _ in c["trilha"][1:]:
        som((t, "pop", 0.22, {"f0": 500, "f1": 900, "dur": 0.08}))
    tw, th = a.tile(c["trilha"][0][1]).size
    espaco = 1600 - c["y_personagem"]
    c["esc"] = next((e for e in (4, 3) if th * e + 14 <= espaco and tw * e + 14 <= W - 40), 2)
    # centraliza o bloco (texto, demonstração, personagem) na área segura, longe das bordas que a interface das redes cobre
    dy = max(0, (FUNDO_SEGURO - (c["y_personagem"] + th * c["esc"] + 14)) // 2)
    c["y_texto"] = Y_TEXTO + dy
    c["y_personagem"] += dy
    if c["demo"]:
        c["y_demo"] += dy
    if c["bomba"]:
        c["pouso"] = (c["pouso"][0], c["pouso"][1] + dy)
    if "destaque" in tipos:
        x = next(x for x in anims if x.get("efeito") == "destaque")
        c["t_destaque"] = instante(x, ATRASO_VOZ + 0.5 * dur_fala)
        som((c["t_destaque"], "ding", 0.4, {}))
        som((c["t_destaque"] + 0.1, "sucesso", 0.3, {}))
    for x in anims:
        if x.get("efeito") == "som" and x.get("detalhe") in fx.SONS:
            som((instante(x, ATRASO_VOZ + 0.3 * dur_fala), x["detalhe"], 0.5, {}))
    c["camera"] = "tremor" if c["bomba"] else CAMERAS[k % len(CAMERAS)]
    ultima = k == total_cenas - 1
    c["esmaece"] = ultima
    c["dur"] = fim_fala + FOLGA_FIM + (1.0 if ultima else 0)
    if ultima:
        som((c["dur"] - 0.9, "whoosh", 0.25, {"dur": 0.8}))
    c["env"] = envelope(*ler_pcm(wav)) if wav else []
    return c


def legendas(c):
    """Trecho de até 4 palavras da grafia normal, com a palavra do momento em amarelo, nos tempos da fala."""
    texto = (c.get("legenda") or c.get("fala") or "").split()
    ws = c["palavras"]
    if not texto or not ws:
        return []
    ini, fim = ws[0]["i"], ws[-1]["f"]
    if len(ws) == len(texto):
        tempos = [(p["i"], p["f"]) for p in ws]
    else:
        passo = (fim - ini) / len(texto)
        tempos = [(ini + j * passo, ini + (j + 1) * passo) for j in range(len(texto))]
    trechos, atual = [], []
    for j, p in enumerate(texto):
        atual.append(j)
        if p[-1:] in ".,!?:;" or len(atual) == 4:
            trechos.append(atual)
            atual = []
    if atual:
        trechos.append(atual)
    estados = []
    for trecho in trechos:
        for pos, j in enumerate(trecho):
            linha = " ".join(("*" + texto[q] + "*") if q == j else texto[q] for q in trecho)
            img = a.bloco(linha, "titulo", 54, W - 2 * M - 40, a.TEXTO, 1.15, alinhar="centro")
            img = img.crop(img.getchannel("A").getbbox())
            caixa_l = Image.new("RGBA", (img.width + 70, img.height + 40), (0, 0, 0, 0))
            ImageDraw.Draw(caixa_l).rounded_rectangle((0, 0, caixa_l.width - 1, caixa_l.height - 1), 34, fill=a.BG0 + (225,))
            caixa_l.alpha_composite(img, (35, 20))
            t_fim = tempos[trecho[pos + 1]][0] if pos + 1 < len(trecho) else tempos[j][1] + 0.15
            estados.append((tempos[j][0], max(t_fim, tempos[j][0] + 0.05), caixa_l))
    return estados


# ------------------------------------------------------------------ desenho

def digitar(f, dig, x, y, p):
    if p > 0:
        a.colar(f, dig.quadro(p), x, y)


def caixa_pop(f, cx, x, y, lt, t0):
    q = (lt - t0) / 0.16
    if q <= 0:
        return
    if q < 1:
        s = 0.92 + 0.08 * a.ease_out_back(q)
        fs = cx["fundo"].resize((max(1, int(cx["fundo"].width * s)), max(1, int(cx["fundo"].height * s))))
        a.colar(f, fs, x + (cx["fundo"].width - fs.width) // 2, y + (cx["fundo"].height - fs.height) // 2, q)
    else:
        a.colar(f, cx["fundo"], x, y)
    digitar(f, cx["texto"], x + 28, y + 20, (lt - t0 - 0.12) / cx["dur"])


def personagem(f, c, lt):
    atual, t_atual, anterior = None, 0.0, None
    for t, tile in c["trilha"]:
        if t <= lt:
            anterior, atual, t_atual = atual, tile, t
    if atual is None:
        return None
    j, aura = janela(atual, c["esc"])
    base = j
    s, dx, dy, ang = 1.0, 0, 0, 0.0
    if anterior is None and lt - t_atual < 0.45:  # entrada deslizando de baixo
        dy += int(420 * (1 - a.ease_out_cubic((lt - t_atual) / 0.4)))
    elif anterior is not None and lt - t_atual < 0.2:  # troca de expressão
        s *= 1 + 0.06 * (1 - (lt - t_atual) / 0.2)
    cam = c["camera"]
    if cam == "aprox":
        s *= 1 + 0.06 * fx.suave(lt / c["dur"])
    elif cam == "quique" and c["env"]:
        q = int((lt - ATRASO_VOZ) * FPS)
        if 0 <= q < len(c["env"]):
            dy -= round(12 * c["env"][q])
    elif cam == "deslize":
        dx += round(-50 + 100 * fx.suave(lt / c["dur"]))
    elif cam == "deslize_volta":
        dx += round(50 - 100 * fx.suave(lt / c["dur"]))
    elif cam == "tremor" and c["t_expl"] <= lt < c["t_expl"] + 0.45:
        amp = 18 * (1 - (lt - c["t_expl"]) / 0.45)
        dx, dy = dx + round(amp * math.sin(lt * 97)), dy + round(amp * math.cos(lt * 71))
    if "t_destaque" in c and c["t_destaque"] <= lt < c["t_destaque"] + 0.8:
        u = lt - c["t_destaque"]
        ang = 5 * math.sin(2 * math.pi * 1.2 * u) * (1 - u / 0.8)
    pulso = 0.6 + 0.25 * math.sin(2 * math.pi * 0.5 * lt)
    if abs(s - 1) > 0.002:
        j = j.resize((round(j.width * s), round(j.height * s)), Image.LANCZOS)
        aura = aura.resize((round(aura.width * s), round(aura.height * s)), Image.LANCZOS)
    if abs(ang) > 0.05:
        j = j.rotate(ang, resample=Image.BICUBIC, expand=True)
    cx = W / 2 + dx
    cy = c["y_personagem"] + base.height / 2 + dy
    a.colar(f, aura, round(cx - aura.width / 2), round(cy - aura.height / 2), pulso)
    a.colar(f, j, round(cx - j.width / 2), round(cy - j.height / 2))
    return (cx, cy, base.width, base.height)


def estrelas(f, c, lt, ret):
    if "t_destaque" not in c or ret is None:
        return
    u = lt - c["t_destaque"]
    if not 0 <= u < 1.3:
        return
    cx, cy, w, h = ret
    for i, (px, py) in enumerate([(-0.62, -0.45), (0.6, -0.5), (0.68, 0.05), (-0.7, 0.1), (-0.5, 0.52), (0.55, 0.5)]):
        if u > i * 0.08:
            e = fx.estrela(u * 4 + i * 0.37)
            a.colar(f, e, int(cx + px * w - e.width / 2), int(cy + py * h - e.height / 2), 1 if u < 1.0 else (1.3 - u) / 0.3)


def painel_demo(c, lt):
    u = lt - c["t_demo"]
    if u < 0:
        return None
    p = dd.desenhar(c["demo"]["demo"], u, c["demo"])
    if p is None:
        return None
    q = min(1.0, u / 0.2)
    if q < 1:
        s = 0.92 + 0.08 * a.ease_out_cubic(q)
        p = p.resize((int(p.width * s), int(p.height * s)))
    return p, q


def quadro_cena(c, lt):
    f = fundo().copy()
    if c["demo"]:
        r = painel_demo(c, lt)
        if r:
            p, q = r
            a.colar(f, p.convert("RGBA"), (W - p.width) // 2, c["y_demo"] + (DEMO_ALT - p.height) // 2, q)
    if c["bomba"]:
        if lt < c["t_expl"]:
            caixa_pop(f, c["cx"], M, c["y_texto"], lt, c["t_texto"])
        elif lt < c["t_expl"] + c["dest"].fim:
            c["dest"].colar(f, M, c["y_texto"], lt - c["t_expl"])
        if c.get("cx2") and lt >= c["t_depois"]:
            caixa_pop(f, c["cx2"], M, c["y_texto"], lt, c["t_depois"])
    else:
        p = (lt - c["t_texto"]) / c["td"]["dur"]
        if "t_destaque" in c and 0 <= lt - c["t_destaque"] < 0.35 and p >= 1:
            s = 1 + 0.05 * math.sin(math.pi * (lt - c["t_destaque"]) / 0.35)
            img = c["td"]["img"]
            img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
            a.colar(f, img, M - 16 - (img.width - c["td"]["img"].width) // 2, c["y_texto"] - (img.height - c["td"]["img"].height) // 2)
        else:
            digitar(f, c["td"]["dig"], M - 16, c["y_texto"], p)
    ret = personagem(f, c, lt)
    if c["bomba"]:
        if c["t_lanc"] <= lt < c["t_expl"]:
            u = (lt - c["t_lanc"]) / 0.5
            px, py = c["pouso"]
            if u < 1:
                x0, y0 = c["origem"]
                x, y = x0 + (px - x0) * u, y0 + (py - y0) * u - 260 * math.sin(math.pi * u)
            else:
                x, y = px + 3 * math.sin(lt * 45), py
            b = fx.bomba(int(lt * 18), esc=7)
            a.colar(f, b, int(x - b.width / 2), int(y - b.height / 2))
        u = (lt - c["t_expl"]) / 0.6
        if 0 <= u < 1:
            e = fx.explosao(u, semente=c["k"] + 1, esc=6, clara=False)
            a.colar(f, e, int(c["pouso"][0] - e.width / 2), int(c["pouso"][1] - e.height / 2))
    estrelas(f, c, lt, ret)
    for ini, fim, img in c.get("legendas", []):
        if ini <= lt < fim:
            a.colar(f, img, (W - img.width) // 2, 1650)
            break
    return f


_congelados = {}


def quadro(cenas, t):
    k = max(i for i, c in enumerate(cenas) if c["inicio"] <= t)
    c = cenas[k]
    lt = t - c["inicio"]
    f = quadro_cena(c, lt)
    if k > 0:
        nome = cenas[k - 1]["transicao"]
        dur_t = fx.TRANSICOES[nome][1]
        if lt < dur_t:
            if k not in _congelados:
                _congelados[k] = quadro_cena(cenas[k - 1], cenas[k - 1]["dur"] - 1 / FPS)
            f = fx.transicao(nome, _congelados[k], f, lt / dur_t, chave=("estudio", k))
    if c["esmaece"] and lt > c["dur"] - 0.9:
        f = Image.blend(f, fundo(logo=False), fx.suave((lt - (c["dur"] - 0.9)) / 0.9))
    return f


# ------------------------------------------------------------------ som

def efeitos_sonoros(cenas, total, caminho):
    mesa = fx.Mesa(total)
    cache = {}
    for k, c in enumerate(cenas):
        eventos = list(c["sons"])
        if k > 0:
            eventos += [(0.0, nome, vol, kw) for nome, vol, kw in SOM_TRANSICAO[cenas[k - 1]["transicao"]]]
        for t, nome, vol, kw in eventos:
            ch = (nome, tuple(sorted(kw.items())))
            if ch not in cache:
                cache[ch] = fx.s_pavio(**kw) if nome == "pavio" else fx.SONS[nome](**kw)
            mesa.somar(c["inicio"] + t, cache[ch], vol)
    mesa.salvar(caminho)


def mixar(cenas, mudo, efeitos, trilha_wav, destino, total):
    vozes = [c for c in cenas if c["voz"]]
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", mudo]
    for c in vozes:
        cmd += ["-i", c["voz"]]
    cmd += ["-i", trilha_wav, "-i", efeitos]
    n = len(vozes)
    f = []
    if n:
        f += [f"[{k + 1}:a]aresample=44100,aformat=channel_layouts=mono,adelay={int((c['inicio'] + ATRASO_VOZ) * 1000)}:all=1[v{k}]"
              for k, c in enumerate(vozes)]
        f.append("".join(f"[v{k}]" for k in range(n)) + f"amix=inputs={n}:normalize=0:duration=longest,"
                 "loudnorm=I=-16:TP=-1.5,asplit=2[voz][chave]")
    f.append(f"[{n + 1}:a]aresample=44100,atrim=0:{total:.3f},asetpts=N/SR/TB,volume=0.5,afade=t=out:st={max(0, total - 0.3):.3f}:d=0.3[mus]")
    f.append(f"[{n + 2}:a]aresample=44100,volume=0.45[fx]")
    if n:
        f.append("[mus][chave]sidechaincompress=threshold=0.04:ratio=2.5:attack=30:release=160[musd]")
        f.append(f"[voz][musd][fx]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.85:level=0,atrim=0:{total:.3f}[a]")
    else:
        f.append(f"[mus][fx]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.85:level=0,atrim=0:{total:.3f}[a]")
    cmd += ["-filter_complex", ";".join(f), "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-t", f"{total:.3f}", "-movflags", "+faststart", destino]
    subprocess.run(cmd, check=True)


# ------------------------------------------------------------------ modos

def preparar(cenas_in, sem_voz, legenda):
    if not cenas_in:
        raise Erro("O quadro não tem nenhuma cena com fala.")
    for c in cenas_in:
        if c.get("transicao") not in fx.TRANSICOES:
            c["transicao"] = "dissolucao"
    if sem_voz:
        vozes = []
        for c in cenas_in:
            ws, dur = palavras_estimadas(c.get("fala") or c.get("tela") or "...")
            vozes.append((None, ws, dur))
    else:
        vozes = []
        for wav, ws in narrar([c.get("fala") or "" for c in cenas_in]):
            if wav:
                x, sr = ler_pcm(wav)
                vozes.append((wav, ws, len(x) / sr))
            else:
                vozes.append((None, [], 1.5))
    cenas, inicio = [], 0.0
    for k, (c, voz) in enumerate(zip(cenas_in, vozes)):
        c = dict(c, inicio=inicio)
        montar(c, k, len(cenas_in), voz)
        if legenda:
            c["legendas"] = legendas(c)
        cenas.append(c)
        inicio += c["dur"]
    return cenas


def modo_video(p):
    destino = p["destino"]
    os.makedirs(os.path.dirname(os.path.abspath(destino)), exist_ok=True)
    cenas = preparar([dict(c) for c in p.get("cenas", [])], bool(p.get("sem_voz")), bool(p.get("legenda")))
    total = cenas[-1]["inicio"] + cenas[-1]["dur"]
    progresso(f"{len(cenas)} cenas, {total:.1f} s; desenhando os quadros")
    with tempfile.TemporaryDirectory() as tmp:
        mudo = os.path.join(tmp, "mudo.mp4")
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
               "-i", "-", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", mudo]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        n = int(total * FPS)
        for i in range(n):
            proc.stdin.write(quadro(cenas, i / FPS).tobytes())
            if i % 150 == 0:
                progresso(f"quadros {i}/{n} ({100 * i // max(n, 1)}%)")
        proc.stdin.close()
        if proc.wait() != 0:
            raise Erro("O ffmpeg falhou ao gravar o vídeo.")
        progresso("compondo a trilha e os efeitos sonoros")
        import trilha
        trilha_wav = os.path.join(tmp, "trilha.wav")
        trilha.gerar(total, trilha_wav)
        efeitos = os.path.join(tmp, "efeitos.wav")
        efeitos_sonoros(cenas, total, efeitos)
        progresso("mixando voz, trilha e efeitos")
        mixar(cenas, mudo, efeitos, trilha_wav, destino, total)
    return {"arquivo": destino, "duracao": round(total, 2), "cenas": [round(c["dur"], 2) for c in cenas]}


def modo_cena(p):
    """Prévia de uma cena: um quadro no momento em que tudo já apareceu (antes da explosão, se houver bombinha)."""
    destino = p["destino"]
    c = preparar([dict(p, transicao=p.get("transicao") or "dissolucao")], True, bool(p.get("legenda")))[0]
    c["esmaece"] = False
    if c["bomba"]:
        lt = c["t_depois"] + c["cx2"]["dur"] + 0.5 if c.get("cx2") else c["t_lanc"] + 0.6
    else:
        lt = max(c["t_texto"] + c["td"]["dur"] + 0.3, c.get("t_demo", 0) + 2.9, c["trilha"][-1][0] + 0.3)
        lt = min(lt, c["dur"] - 0.1)
    os.makedirs(os.path.dirname(os.path.abspath(destino)), exist_ok=True)
    quadro_cena(c, lt).save(destino, optimize=True)
    return {"arquivo": destino}


# ---------- slides do carrossel (1080x1350)

SW, SH = 1080, 1350


def base_slide(n, total):
    c = fundo(SW, SH, logo=True).copy()
    d = ImageDraw.Draw(c)
    d.text((SW - M, 74), f"{n:02d}/{total:02d}", font=a.fonte("mono", 28), fill=a.SUAVE, anchor="ra")
    if n < total:
        d.text((M, SH - 86), "ARRASTA", font=a.fonte("mono", 26), fill=a.SUAVE)
        a.colar(c, a.seta(54, a.AMARELO), M + 142, SH - 100)
    return c


def caber(texto, nome, tamanhos, largura, alto_max, cor=a.TEXTO):
    """O maior tamanho de fonte em que o texto cabe na altura."""
    img = None
    for tam in tamanhos:
        img = a.bloco(texto, nome, tam, largura, cor, 1.12)
        if img.height <= alto_max:
            return img
    return img


def cartao_texto(texto, borda, tamanhos, largura, alto_max=600):
    corpo = caber(texto, "titulo", tamanhos, largura - 64, alto_max - 36)
    img = Image.new("RGBA", (largura, corpo.height + 36), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle((0, 0, largura - 1, img.height - 1), 28, fill=a.CARTAO + (238,), outline=borda + (255,), width=4)
    img.alpha_composite(corpo, (26, 18))
    return img


def colar_personagem(c, nome, esc, x, y):
    j, aura = janela(expressao(nome), esc)
    a.colar(c, aura, x - 90, y - 90)
    a.colar(c, j, x, y)
    return j.size


def colar_painel(c, painel, y, fundo_max):
    larg = SW - 2 * M
    esc = min(1.0, (fundo_max - y) / painel.height, larg / painel.width)
    if esc < 0.45:
        return y
    painel = painel.resize((int(painel.width * esc), int(painel.height * esc)), Image.LANCZOS)
    c.paste(painel, ((SW - painel.width) // 2, y))
    return y + painel.height


def personagem_no_espaco(c, nome, y, fundo_max, direita=False):
    tw, th = a.tile(expressao(nome)).size
    esc = next((e for e in (3, 2) if th * e + 14 <= fundo_max - y), None)
    if esc is None:
        return
    largura = tw * esc + 14
    x = SW - M - largura if direita else (SW - largura) // 2
    colar_personagem(c, nome, esc, x, y)


LIMITE = SH - 130  # acima do "ARRASTA"


def dados_demo(f):
    """Os campos do slide alimentam a demonstração, menos o título (a janela usa o nome padrão dela)."""
    return {k: v for k, v in f.items() if k != "titulo"}


def s_capa(c, f, n, total):
    y = 168
    if f.get("selo"):
        a.colar(c, a.pilula(f["selo"], 25), M, y)
    titulo = caber(f.get("titulo", ""), "titulo", (104, 96, 88, 80, 72), SW - 2 * M - 40, 560)
    a.colar(c, titulo, M - 16, 240)
    y = 240 + titulo.height + 40
    personagem_no_espaco(c, f.get("personagem") or "ideia", y, LIMITE, direita=True)


def s_mito_verdade(c, f, n, total):
    larg = SW - 2 * M
    a.colar(c, a.pilula(f.get("rotulo") or "Mito", 26, a.TEXTO, a.MAGENTA), M, 150)
    rachado = fx.rachar(cartao_texto(f"“{f.get('mito', '')}”", a.MAGENTA, (46, 42, 38), larg - 60, 300), semente=n)
    a.colar(c, rachado, M, 150)
    y = 150 + rachado.height - 40
    a.colar(c, a.pilula("Verdade", 26, a.BG0, a.AMARELO, preenche=a.AMARELO), M, y)
    y += 70
    card = cartao_texto(f.get("verdade", ""), a.AMARELO, (44, 40, 36), larg, 360)
    a.colar(c, card, M, y)
    y += card.height + 30
    painel = dd.desenhar(f.get("demo", ""), 99, dados_demo(f)) if f.get("demo") else None
    if painel is not None:
        colar_painel(c, painel, y, LIMITE)
    else:
        personagem_no_espaco(c, f.get("personagem") or "pensativo", y + 20, LIMITE, direita=True)


def s_explicacao(c, f, n, total):
    larg = SW - 2 * M
    y = 150
    if f.get("rotulo"):
        a.colar(c, a.pilula(f["rotulo"], 26), M, y)
        y += 80
    titulo = caber(f.get("titulo", ""), "titulo", (80, 72, 64, 58), larg - 20, 330)
    a.colar(c, titulo, M - 14, y)
    y += titulo.height + 16
    if f.get("texto"):
        corpo = caber(f["texto"], "corpo", (44, 40, 36, 32), larg, 320, a.SUAVE)
        a.colar(c, corpo, M - 6, y)
        y += corpo.height + 30
    painel = dd.desenhar(f.get("demo", ""), 99, dados_demo(f)) if f.get("demo") else None
    if painel is not None:
        y = colar_painel(c, painel, y, LIMITE) + 20
    if f.get("personagem") or painel is None:
        personagem_no_espaco(c, f.get("personagem") or "pensativo", y, LIMITE, direita=painel is not None)


def s_comparacao(c, f, n, total):
    larg = SW - 2 * M
    titulo = caber(f.get("titulo", ""), "titulo", (76, 68, 60), larg, 300)
    a.colar(c, titulo, M - 14, 150)
    y = 150 + titulo.height + 30
    meio = SW // 2
    w = meio - M - 14
    lados = ((f.get("esquerda_titulo", ""), f.get("esquerda_texto", ""), a.MAGENTA),
             (f.get("direita_titulo", ""), f.get("direita_texto", ""), a.AMARELO))
    textos = [caber(corpo, "corpo", (44, 40, 36, 32, 28), w - 76, LIMITE - y - 150) for _, corpo, _ in lados]
    alto = min(LIMITE - y - 10, max(380, max(t.height for t in textos) + 150))
    d = ImageDraw.Draw(c)
    for i, (t, corpo, borda) in enumerate(lados):
        x0 = M if i == 0 else meio + 14
        card = Image.new("RGBA", (w, alto), (0, 0, 0, 0))
        ImageDraw.Draw(card).rounded_rectangle((0, 0, w - 1, alto - 1), 28, fill=a.CARTAO + (238,), outline=borda + (255,), width=4)
        a.colar(c, card, x0, y)
        a.colar(c, a.pilula(t[:18], 24, a.BG0 if i else a.TEXTO, borda, preenche=borda if i else None), x0 + 24, y + 28)
        a.colar(c, textos[i], x0 + (40 if i else 22), y + 110)  # à direita, folga para o selo VS
    cy = y + alto // 2
    d.ellipse((meio - 42, cy - 42, meio + 42, cy + 42), fill=a.AMARELO, outline=a.BG0, width=4)
    d.text((meio, cy), "VS", font=a.fonte("titulo", 34), fill=a.BG0, anchor="mm")
    personagem_no_espaco(c, f.get("personagem") or "pensativo", y + alto + 50, LIMITE)


def s_codigo(c, f, n, total):
    larg = SW - 2 * M
    titulo = caber(f.get("titulo", ""), "titulo", (76, 68, 60), larg, 260)
    a.colar(c, titulo, M - 14, 150)
    y = 150 + titulo.height + 30
    painel = dd.desenhar("codigo", 99, {"codigo": f.get("codigo", ""), "saida": f.get("saida", ""), "titulo": "exemplo - Editor", "max_linhas": 10, "compacto": True})
    y = colar_painel(c, painel, y, LIMITE - 200) + 30
    if f.get("explicacao"):
        corpo = caber(f["explicacao"], "corpo", (44, 40, 36, 32), larg, LIMITE - y, a.TEXTO)
        a.colar(c, corpo, M - 6, y)
        y += corpo.height + 20
    personagem_no_espaco(c, f.get("personagem") or "focado", y, LIMITE, direita=True)


def s_passos(c, f, n, total):
    larg = SW - 2 * M
    titulo = caber(f.get("titulo", ""), "titulo", (76, 68, 60), larg, 260)
    a.colar(c, titulo, M - 14, 150)
    y = 150 + titulo.height + 34
    itens = [i.strip() for i in (f.get("itens") or "").split("\n") if i.strip()][:5]
    if not itens:
        return
    alto = min(170, (LIMITE - y) // len(itens))
    d = ImageDraw.Draw(c)
    for i, item in enumerate(itens):
        yy = y + i * alto
        card = Image.new("RGBA", (larg, alto - 18), (0, 0, 0, 0))
        ImageDraw.Draw(card).rounded_rectangle((0, 0, larg - 1, alto - 19), 24, fill=a.CARTAO + (238,), outline=a.ROXO + (255,), width=3)
        a.colar(c, card, M, yy)
        r = min(36, (alto - 18) // 2 - 8)
        cx, cy = M + 26 + r, yy + (alto - 18) // 2
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=a.AMARELO)
        d.text((cx, cy), str(i + 1), font=a.fonte("titulo", int(r * 1.2)), fill=a.BG0, anchor="mm")
        texto = caber(item, "titulo", (40, 36, 32, 28), larg - 2 * r - 90, alto - 30)
        a.colar(c, texto, cx + r + 20, cy - texto.height // 2)


def s_fechamento(c, f, n, total):
    titulo = caber(f.get("titulo", ""), "titulo", (110, 96, 84, 72), SW - 2 * M, 480)
    a.colar(c, titulo, M - 18, 200)
    y = 200 + titulo.height + 30
    if f.get("selo"):
        selo = a.pilula(f["selo"], 34, a.BG0, a.AMARELO, preenche=a.AMARELO)
        a.colar(c, selo, M, y)
        y += selo.height + 70
    personagem_no_espaco(c, f.get("personagem") or "paz", y, LIMITE + 60)


MODELOS = {"capa": s_capa, "mito-verdade": s_mito_verdade, "explicacao": s_explicacao, "comparacao": s_comparacao,
           "codigo": s_codigo, "passos": s_passos, "fechamento": s_fechamento}


TOPO_SLIDE = 130  # abaixo da marca e do contador


def desenhar_slide(s, n, total):
    """O modelo desenha numa camada transparente; o conteúdo é centralizado na vertical entre o topo e o "ARRASTA",
    para nenhum slide ficar com um vazio grande embaixo."""
    if s.get("modelo") not in MODELOS:
        raise Erro(f"Não conheço esse modelo de slide: \"{s.get('modelo')}\".")
    camada = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
    MODELOS[s["modelo"]](camada, s.get("campos") or {}, n, total)
    caixa = camada.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    dy = 0
    if caixa:
        livre = LIMITE - caixa[3]
        dy = max(0, min(livre // 2, livre - 10)) if caixa[1] >= TOPO_SLIDE else 0
    c = base_slide(n, total).convert("RGBA")
    c.alpha_composite(camada, (0, dy))
    return c.convert("RGB")


def modo_slides(p):
    slides = p.get("slides") or []
    if not slides:
        raise Erro("O carrossel não tem slides.")
    if len(slides) > 10:
        raise Erro("O Instagram aceita até 10 slides por carrossel.")
    for s in slides:
        if s.get("modelo") not in MODELOS:
            raise Erro(f"Não conheço esse modelo de slide: \"{s.get('modelo')}\".")
    pasta = p["pasta"]
    os.makedirs(pasta, exist_ok=True)
    so = p.get("so")  # prévia de um slide só (índice)
    imagens = []
    for i, s in enumerate(slides, 1):
        if so is not None and i - 1 != so:
            continue
        arq = os.path.join(pasta, f"slide-{i:02d}.png")
        desenhar_slide(s, i, len(slides)).save(arq, optimize=True)
        imagens.append(arq)
        progresso(f"slide {i}/{len(slides)}")
    zip_arq = ""
    if so is None:
        zip_arq = os.path.join(pasta, "carrossel.zip")
        with zipfile.ZipFile(zip_arq, "w", zipfile.ZIP_DEFLATED) as z:
            for img in imagens:
                z.write(img, os.path.basename(img))
    return {"imagens": imagens, "zip": zip_arq}


# ---------- prévia de técnica roubada num vídeo existente

def duracao_video(arq):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", arq],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        raise Erro("Não consegui ler esse vídeo.")


def quadros_de(arq, inicio, dur):
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", f"{inicio:.3f}", "-t", f"{dur:.3f}", "-i", arq, "-vf",
                        f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=0x120a24",
                        "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True)
    if r.returncode != 0:
        raise Erro("O ffmpeg não conseguiu ler esse vídeo.")
    tam = W * H * 3
    return [Image.frombytes("RGB", (W, H), r.stdout[i:i + tam]) for i in range(0, len(r.stdout) - tam + 1, tam)]


def modo_tecnica(p):
    """Trecho de ~3 s: o vídeo roda, a técnica (transição mais próxima do motor) acontece e o vídeo segue mais adiante."""
    arq, destino = p["video"], p["destino"]
    efeito = p.get("efeito") if p.get("efeito") in fx.TRANSICOES else "dissolucao"
    dur = duracao_video(arq)
    inicio = max(0.0, min(float(p.get("inicio") or 0), max(0.0, dur - 2.0)))
    antes = min(1.2, max(0.4, dur - inicio - 0.6))
    salto = max(0.0, min(1.5, dur - (inicio + antes) - 1.3))
    parte1 = quadros_de(arq, inicio, antes)
    parte2 = quadros_de(arq, inicio + antes + salto, 1.3)
    if not parte1 or not parte2:
        raise Erro("O trecho escolhido é curto demais.")
    dur_t = fx.TRANSICOES[efeito][1]
    congelado = parte1[-1]
    total = (len(parte1) + len(parte2)) / FPS
    os.makedirs(os.path.dirname(os.path.abspath(destino)), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        mudo = os.path.join(tmp, "mudo.mp4")
        proc = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                                 "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                                 "-pix_fmt", "yuv420p", mudo], stdin=subprocess.PIPE)
        for q in parte1:
            proc.stdin.write(q.tobytes())
        for i, q in enumerate(parte2):
            lt = i / FPS
            if lt < dur_t:
                q = fx.transicao(efeito, congelado, q, lt / dur_t, chave=("tecnica", efeito))
            proc.stdin.write(q.tobytes())
        proc.stdin.close()
        if proc.wait() != 0:
            raise Erro("O ffmpeg falhou ao gravar a prévia.")
        mesa = fx.Mesa(total)
        for _, nome, vol, kw in [(0, *s) for s in SOM_TRANSICAO[efeito]]:
            mesa.somar(len(parte1) / FPS, fx.SONS[nome](**kw), vol)
        sons = os.path.join(tmp, "sons.wav")
        mesa.salvar(sons, pico=0.6)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mudo, "-i", sons, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                        "-c:a", "aac", "-t", f"{total:.3f}", "-movflags", "+faststart", destino], check=True)
    return {"arquivo": destino, "efeito": efeito, "duracao": round(total, 2)}


MODOS = {"cena": modo_cena, "slides": modo_slides, "video": modo_video, "tecnica": modo_tecnica}


def main():
    modo = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        if modo not in MODOS:
            raise Erro(f"Modo desconhecido: {modo or '(vazio)'}.")
        pedido = json.loads(sys.stdin.read() or "{}")
        r = MODOS[modo](pedido)
    except Erro as e:
        print("erro: " + str(e), flush=True)
        sys.exit(1)
    except Exception as e:  # noqa: BLE001 - qualquer falha volta como mensagem para a tela
        print(f"erro: falha no motor ({type(e).__name__}: {e})", flush=True)
        sys.exit(1)
    print("resultado: " + json.dumps(r, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
