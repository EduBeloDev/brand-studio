"""Transcreve áudios com faster-whisper (MIT) para conferir se as palavras saem inteligíveis.
Uso: .venv-asr/bin/python asr.py arquivo.wav [...]      (--palavras mostra o tempo de cada palavra)
O áudio é decodificado pelo ffmpeg (16 kHz mono) e entregue ao Whisper como números."""
import os
import subprocess
import sys

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("HF_HOME", os.path.join(AQUI, ".cache-hf"))
from faster_whisper import WhisperModel  # noqa: E402


def carregar(arq):
    bruto = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", arq, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
                           check=True, capture_output=True).stdout
    return np.frombuffer(bruto, np.float32)


if __name__ == "__main__":
    palavras = "--palavras" in sys.argv
    arquivos = [a for a in sys.argv[1:] if not a.startswith("--")]
    modelo = WhisperModel("small", device="cpu", compute_type="int8")
    for arq in arquivos:
        segs, _ = modelo.transcribe(carregar(arq), language="pt", word_timestamps=palavras, beam_size=5)
        segs = list(segs)
        print(f"[{os.path.basename(os.path.dirname(arq))}/{os.path.basename(arq)}] " + " ".join(s.text.strip() for s in segs))
        if palavras:
            print("   " + " ".join(f"{w.word.strip()}@{w.start:.2f}" for s in segs for w in s.words))
