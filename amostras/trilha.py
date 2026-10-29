"""Trilha chiptune original da marca, sintetizada do zero (nenhuma amostra de terceiros).

Tudo aqui é gerado por fórmula: ondas quadrada e triangular, ruído para a bateria. A melodia e
a harmonia são composição própria sobre uma progressão comum (Lá menor: Am - F - C - G).
16 compassos a 112 BPM (cerca de 34 s). Para um vídeo de outra duração, corta-se e aplica-se fade.
"""
import math
import os
import random
import struct
import wave

SR = 44100
BPM = 112
PASSO = 60 / BPM / 4          # duração de uma semicolcheia
COMPASSO = PASSO * 16
N_COMPASSOS = 16
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saida", "trilha-chiptune.wav")

# Cada compasso da progressão: nota-raiz do baixo (MIDI) e as 3 notas do acorde na oitava 4
ACORDES = [
    (45, (69, 72, 76)),   # Am
    (41, (65, 69, 72)),   # F
    (48, (67, 72, 76)),   # C
    (43, (62, 67, 71)),   # G
]

# Melodia A e B: (passo de 0 a 15, nota MIDI, duração em passos)
MEL_A = [
    [(0, 76, 3), (4, 72, 2), (6, 69, 2), (8, 72, 2), (10, 76, 2), (12, 81, 4)],
    [(0, 77, 3), (4, 72, 2), (6, 69, 2), (8, 72, 2), (10, 77, 2), (12, 76, 4)],
    [(0, 76, 2), (2, 79, 2), (4, 76, 2), (6, 72, 2), (8, 74, 2), (10, 76, 2), (12, 79, 4)],
    [(0, 74, 3), (4, 71, 2), (6, 67, 2), (8, 71, 2), (10, 74, 2), (12, 71, 2), (14, 69, 2)],
]
MEL_B = [
    [(0, 69, 2), (2, 72, 2), (4, 76, 2), (6, 72, 2), (8, 69, 2), (10, 72, 2), (12, 76, 4)],
    [(0, 69, 2), (2, 72, 2), (4, 77, 2), (6, 72, 2), (8, 69, 2), (10, 72, 2), (12, 77, 4)],
    [(0, 67, 2), (2, 72, 2), (4, 76, 2), (6, 72, 2), (8, 67, 2), (10, 72, 2), (12, 76, 4)],
    [(0, 67, 2), (2, 71, 2), (4, 74, 2), (6, 71, 2), (8, 67, 2), (10, 71, 2), (12, 74, 2), (14, 79, 2)],
]
BAIXO = [(0, 0), (2, 0), (4, 12), (6, 0), (8, 0), (10, 0), (12, 7), (14, 12)]  # (passo, semitons acima da raiz)
KICK = (0, 8, 10)
SNARE = (4, 12)

TOTAL = int(SR * (N_COMPASSOS * COMPASSO + 1.2))
buf = [0.0] * TOTAL
rnd = random.Random(11)


def freq(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def nota(ini, dur, f, onda, vol, duty=0.5, vib=0.0, ataque=0.004, solta=0.06):
    """Escreve uma nota no buffer. onda: 'pulso' ou 'tri'."""
    n0 = int(ini * SR)
    n = int(dur * SR)
    fase = 0.0
    for k in range(n):
        i = n0 + k
        if i >= TOTAL:
            break
        t = k / SR
        ff = f * (1 + vib * math.sin(2 * math.pi * 5.5 * t)) if vib else f
        fase = (fase + ff / SR) % 1.0
        if onda == "pulso":
            s = 1.0 if fase < duty else -1.0
        else:
            s = 4 * abs(fase - 0.5) - 1.0
        env = min(1.0, t / ataque) * min(1.0, (dur - t) / solta)
        buf[i] += vol * s * max(env, 0.0)


def bumbo(ini):
    n0 = int(ini * SR)
    for k in range(int(0.16 * SR)):
        i = n0 + k
        if i >= TOTAL:
            break
        u = k / (0.16 * SR)
        fr = 160 * (1 - u) + 42 * u
        buf[i] += 0.55 * math.sin(2 * math.pi * fr * (k / SR) * 0.6) * (1 - u) ** 1.6


def caixa(ini):
    n0 = int(ini * SR)
    for k in range(int(0.13 * SR)):
        i = n0 + k
        if i >= TOTAL:
            break
        u = k / (0.13 * SR)
        buf[i] += 0.30 * (rnd.random() * 2 - 1) * (1 - u) ** 2 + 0.18 * math.sin(2 * math.pi * 190 * k / SR) * (1 - u) ** 3


def chapeu(ini, aberto=False):
    n0 = int(ini * SR)
    dur = 0.10 if aberto else 0.035
    ant = 0.0
    for k in range(int(dur * SR)):
        i = n0 + k
        if i >= TOTAL:
            break
        r = rnd.random() * 2 - 1
        buf[i] += 0.11 * (r - ant) * (1 - k / (dur * SR)) ** 2
        ant = r


def compor():
    for c in range(N_COMPASSOS):
        base = c * COMPASSO
        raiz, tri = ACORDES[c % 4]
        secao = c // 4                      # 0 intro, 1 e 3 com melodia A/B, 2 melodia B
        melodia = MEL_A if secao in (1, 3) else MEL_B
        # baixo (triângulo) em todos os compassos
        for p, semi in BAIXO:
            nota(base + p * PASSO, PASSO * 1.8, freq(raiz + semi), "tri", 0.30, solta=0.05)
        # arpejo discreto (pulso fino) em subida e descida
        for p in range(16):
            m = tri[(0, 1, 2, 1)[p % 4]] + (12 if secao >= 2 and p % 8 >= 4 else 0)
            nota(base + p * PASSO, PASSO * 0.85, freq(m), "pulso", 0.055, duty=0.125, solta=0.02)
        # bateria entra a partir da segunda seção; chapéu desde o começo, mais leve
        for p in range(0, 16, 2):
            chapeu(base + p * PASSO, aberto=(p == 14 and secao >= 1))
        if secao >= 1:
            for p in KICK:
                bumbo(base + p * PASSO)
            for p in SNARE:
                caixa(base + p * PASSO)
        # melodia (pulso 25%, com vibrato leve)
        if secao >= 1:
            for p, m, d in melodia[c % 4]:
                nota(base + p * PASSO, d * PASSO * 0.95, freq(m), "pulso", 0.13, duty=0.25, vib=0.006, solta=0.04)
    # batida final para fechar a música
    fim = N_COMPASSOS * COMPASSO
    bumbo(fim)
    nota(fim, 0.9, freq(57), "tri", 0.30, solta=0.7)
    nota(fim, 0.9, freq(76), "pulso", 0.10, duty=0.25, solta=0.7)


def salvar():
    # limitador suave e normalização para -3 dBFS; fade de entrada de 30 ms evita estalo
    pico = max(abs(math.tanh(v * 1.2)) for v in buf) or 1
    ganho = 0.708 / pico
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    with wave.open(SAIDA, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        quadros = []
        for i, v in enumerate(buf):
            fade = min(1.0, i / (0.03 * SR))
            quadros.append(struct.pack("<h", int(math.tanh(v * 1.2) * ganho * fade * 32767)))
        w.writeframes(b"".join(quadros))
    print("trilha ok", SAIDA, f"{TOTAL / SR:.1f}s")


if __name__ == "__main__":
    compor()
    salvar()
