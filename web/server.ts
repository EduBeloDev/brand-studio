import path from 'node:path';
import { prepararMemoria } from '../core/branding/memoria.ts';
import { criarClaudeCode } from '../core/ia/ia.ts';
import { Radar } from '../core/radar/radar.ts';
import { extrairMidia, transcritorPadrao } from '../core/referencias/referencias.ts';
import { criarMotorPython } from '../core/render/motor.ts';
import { PASTA_SAIDA } from '../core/saida.ts';
import { criarServidor } from './api.ts';
import { criarRotasDePecas } from './pecas.ts';

/**
 * O app (estúdio de conteúdo + peças da esteira). Fino: monta as peças reais (Claude Code restrito, motor em Python,
 * radar) e entrega para a API. Escuta apenas em 127.0.0.1, então só este computador abre o app.
 */

const PORTA = Number(process.env.PORT ?? 3000);
const RAIZ = path.join(import.meta.dirname, '..');
// Trocáveis por variável de ambiente (o motor em Python lê as mesmas): úteis para uma cópia de demonstração.
const CONTEUDO = process.env.BRAND_STUDIO_CONTEUDO ?? path.join(RAIZ, 'conteudo');
const SAIDA_ESTUDIO = process.env.BRAND_STUDIO_SAIDA ?? path.join(PASTA_SAIDA, 'estudio');
const AMOSTRAS = path.join(RAIZ, 'amostras');

await prepararMemoria(CONTEUDO);
const ia = criarClaudeCode({ raiz: CONTEUDO, bin: process.env.CLAUDE_BIN });
const radar = new Radar({ raiz: CONTEUDO, ia });
const servidor = criarServidor({
  raiz: CONTEUDO,
  ia,
  radar,
  motor: criarMotorPython({ script: path.join(AMOSTRAS, 'estudio_render.py'), cwd: AMOSTRAS }),
  pastaSaida: SAIDA_ESTUDIO,
  estatico: path.join(import.meta.dirname, 'dist'),
  extrairReferencia: (arquivo, pasta) => extrairMidia(arquivo, pasta, { transcrever: transcritorPadrao(AMOSTRAS) }),
  extra: criarRotasDePecas(PASTA_SAIDA),
});
servidor.listen(PORTA, '127.0.0.1', () => {
  console.log(`App aberto em http://localhost:${PORTA}`);
  if (process.env.RADAR !== 'desligado') {
    radar.iniciarSeConfigurado().then((ligou) => console.log(ligou ? 'Modo de aprendizado ligado.' : 'Modo de aprendizado desligado nas configurações.'))
      .catch((e) => console.error('O modo de aprendizado não começou:', (e as Error).message));
  }
});
