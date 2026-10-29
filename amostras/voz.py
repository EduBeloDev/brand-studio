"""Leitura da narração para o motor: PCM 16 bits e envelope de volume por quadro (move o "quique" do personagem)."""
import array
import math
import os
import subprocess
import wave

FPS = 30


def ler_pcm(arq):
    """Converte para PCM 16 bits mono 24 kHz (o Chatterbox grava em ponto flutuante) e lê."""
    destino = arq[:-4] + "-16.wav"
    if not os.path.exists(destino) or os.path.getmtime(destino) < os.path.getmtime(arq):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", arq, "-ac", "1", "-ar", "24000",
                        "-c:a", "pcm_s16le", destino], check=True)
    with wave.open(destino) as w:
        sr = w.getframerate()
        x = array.array("h")
        x.frombytes(w.readframes(w.getnframes()))
    return x, sr


def envelope(x, sr):
    """Volume da voz a cada quadro (0 a 1), suavizado: move o 'quique' do personagem."""
    passo = sr // FPS
    rms = []
    for i in range(0, len(x), passo):
        seg = x[i:i + passo]
        rms.append(math.sqrt(sum(v * v for v in seg[::4]) / max(1, len(seg[::4]))))
    m = max(rms, default=1) or 1
    return [sum(rms[max(0, k - 1):k + 2]) / len(rms[max(0, k - 1):k + 2]) / m for k in range(len(rms))]
