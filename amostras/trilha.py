"""Trilha chiptune original, sintetizada do zero (nenhuma amostra de terceiros).

Tudo aqui é gerado por fórmula: ondas quadrada e triangular, ruído para a bateria. A melodia e
a harmonia são composição própria sobre uma progressão comum (Lá menor: Am - F - C - G).

A trilha é composta na duração exata do vídeo, para não reiniciar no meio: introdução uma vez,
seções que se alternam (A, B, A mais intensa, uma quebra mais leve) e a batida final caindo no fim.
O andamento parte de 112 BPM e é ajustado em poucos por cento para os compassos fecharem certinho.

Uso: python3 trilha.py [duração em segundos] [arquivo de saída]
"""
import array
import math
import os
import random
import sys
import wave

SR = 44100
BPM = 112
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saida", "trilha-chiptune.wav")
CAUDA = 1.0  # depois da batida final, o som ainda decai por este tempo

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
CICLO = ["A", "B", "A2", "Q"]  # depois da introdução, as seções de 4 compassos se alternam assim


def freq(m):
    return 440.0 * 2 ** ((m - 69) / 12)


class Sintetizador:
    def __init__(self, segundos):
        self.n = int(SR * segundos)
        self.buf = array.array("f", bytes(4 * self.n))
        self.rnd = random.Random(11)

    def nota(self, ini, dur, f, onda, vol, duty=0.5, vib=0.0, ataque=0.004, solta=0.06):
        n0, n, buf, fase = int(ini * SR), int(dur * SR), self.buf, 0.0
        for k in range(n):
            i = n0 + k
            if i >= self.n:
                break
            t = k / SR
            ff = f * (1 + vib * math.sin(2 * math.pi * 5.5 * t)) if vib else f
            fase = (fase + ff / SR) % 1.0
            s = (1.0 if fase < duty else -1.0) if onda == "pulso" else 4 * abs(fase - 0.5) - 1.0
            env = min(1.0, t / ataque) * min(1.0, (dur - t) / solta)
            buf[i] += vol * s * max(env, 0.0)

    def bumbo(self, ini, vol=0.55):
        n0 = int(ini * SR)
        for k in range(int(0.16 * SR)):
            i = n0 + k
            if i >= self.n:
                break
            u = k / (0.16 * SR)
            fr = 160 * (1 - u) + 42 * u
            self.buf[i] += vol * math.sin(2 * math.pi * fr * (k / SR) * 0.6) * (1 - u) ** 1.6

    def caixa(self, ini):
        n0 = int(ini * SR)
        for k in range(int(0.13 * SR)):
            i = n0 + k
            if i >= self.n:
                break
            u = k / (0.13 * SR)
            self.buf[i] += 0.30 * (self.rnd.random() * 2 - 1) * (1 - u) ** 2 + 0.18 * math.sin(2 * math.pi * 190 * k / SR) * (1 - u) ** 3

    def chapeu(self, ini, aberto=False, vol=0.11):
        n0, dur, ant = int(ini * SR), 0.10 if aberto else 0.035, 0.0
        for k in range(int(dur * SR)):
            i = n0 + k
            if i >= self.n:
                break
            r = self.rnd.random() * 2 - 1
            self.buf[i] += vol * (r - ant) * (1 - k / (dur * SR)) ** 2
            ant = r


def secao(c, total):
    """Seção do compasso c: introdução nos 4 primeiros; o último bloco é sempre 'A2' (fecho forte)."""
    if c < 4:
        return "intro"
    if c >= total - 4:
        return "A2"
    return CICLO[((c - 4) // 4) % len(CICLO)]


def compor(duracao=None):
    """Devolve as amostras. Sem duração, faz a versão curta original (16 compassos)."""
    padrao = 60 / BPM * 4
    if duracao:
        n_compassos = max(8, round((duracao - CAUDA) / padrao))
        compasso = (duracao - CAUDA) / n_compassos
    else:
        n_compassos, compasso = 16, padrao
    passo = compasso / 16
    sint = Sintetizador(n_compassos * compasso + CAUDA + 0.2)
    for c in range(n_compassos):
        base = c * compasso
        raiz, tri = ACORDES[c % 4]
        s = secao(c, n_compassos)
        quebra = s == "Q"
        # baixo (triângulo): na quebra, só nos tempos fortes
        for p, semi in BAIXO:
            if quebra and p not in (0, 8):
                continue
            sint.nota(base + p * passo, passo * (3.6 if quebra else 1.8), freq(raiz + semi), "tri", 0.30, solta=0.05)
        # arpejo discreto; na seção A2 sobe uma oitava na segunda metade do compasso
        for p in range(16):
            m = tri[(0, 1, 2, 1)[p % 4]] + (12 if s == "A2" and p % 8 >= 4 else 0)
            sint.nota(base + p * passo, passo * 0.85, freq(m), "pulso", 0.04 if quebra else 0.055, duty=0.125, solta=0.02)
        # bateria
        for p in range(0, 16, 2):
            sint.chapeu(base + p * passo, aberto=(p == 14 and s in ("A", "B", "A2")), vol=0.08 if quebra else 0.11)
        if s in ("A", "B", "A2"):
            for p in (0, 8, 10):
                sint.bumbo(base + p * passo)
            for p in (4, 12):
                sint.caixa(base + p * passo)
        elif quebra:
            sint.bumbo(base, vol=0.4)
        # melodia (pulso 25%, vibrato leve)
        if s != "intro":
            melodia = MEL_A if s in ("A", "A2") else MEL_B
            for p, m, d in melodia[c % 4]:
                sint.nota(base + p * passo, d * passo * 0.95, freq(m), "pulso", 0.09 if quebra else 0.13, duty=0.25,
                          vib=0.006, solta=0.04)
    fim = n_compassos * compasso
    sint.bumbo(fim)
    sint.nota(fim, 0.9, freq(57), "tri", 0.30, solta=0.7)
    sint.nota(fim, 0.9, freq(76), "pulso", 0.10, duty=0.25, solta=0.7)
    return sint.buf, 60 * 4 / compasso, n_compassos


def salvar(buf, caminho):
    # limitador suave e normalização para -3 dBFS; fade de entrada de 30 ms evita estalo
    pico = max(abs(math.tanh(v * 1.2)) for v in buf) or 1
    ganho = 0.708 / pico
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    dados = array.array("h", (int(math.tanh(v * 1.2) * ganho * min(1.0, i / (0.03 * SR)) * 32767)
                              for i, v in enumerate(buf)))
    with wave.open(caminho, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(dados.tobytes())


def gerar(duracao=None, caminho=SAIDA):
    buf, bpm, n = compor(duracao)
    salvar(buf, caminho)
    return bpm, n, len(buf) / SR


if __name__ == "__main__":
    dur = float(sys.argv[1]) if len(sys.argv) > 1 else None
    destino = sys.argv[2] if len(sys.argv) > 2 else SAIDA
    bpm, n, seg = gerar(dur, destino)
    print(f"trilha ok {destino}: {n} compassos a {bpm:.1f} BPM, {seg:.1f}s")
