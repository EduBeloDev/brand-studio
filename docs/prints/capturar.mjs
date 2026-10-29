// Captura as telas do estúdio para o README, com o Firefox sem janela controlado pelo geckodriver (WebDriver).
// Antes: monte a demonstração (montar_demo.py) e suba o app apontado para ela (ver docs/prints/README.md).
// Uso: node docs/prints/capturar.mjs [http://localhost:3001] [pasta de saída]
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const APP = process.argv[2] ?? 'http://localhost:3001';
const PASTA = process.argv[3] ?? import.meta.dirname;
const DRIVER = 'http://127.0.0.1:4444';
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

const geckodriver = spawn(process.env.GECKODRIVER ?? 'geckodriver', ['--port', '4444'], { stdio: 'ignore' });
let sessao;

async function wd(metodo, rota, corpo) {
  const r = await fetch(`${DRIVER}${rota}`, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: corpo && JSON.stringify(corpo) });
  const d = await r.json();
  if (!r.ok) throw new Error(`${rota}: ${JSON.stringify(d.value)}`);
  return d.value;
}
const js = (script, args = []) => wd('POST', `/session/${sessao}/execute/sync`, { script, args });

/** Clica no primeiro elemento de `seletor` cujo texto contém `texto` (ou é igual a ele, com `exato`). */
async function clicar(texto, seletor = 'button', exato = false) {
  const ok = await js(`const [t, sel, exato] = arguments; const b = [...document.querySelectorAll(sel)].find((e) => {
      const x = e.textContent.trim().toLowerCase().replace(/^[^\\p{L}\\d]+/u, ''); return exato ? x === t.toLowerCase() : x.includes(t.toLowerCase()); });
    if (b) b.click(); return !!b;`, [texto, seletor, exato]);
  if (!ok) throw new Error(`Não achei "${texto}".`);
  await esperar(700);
}

async function capturar(nome, espera = 1200) {
  await esperar(espera);
  const png = await wd('GET', `/session/${sessao}/screenshot`);
  await writeFile(path.join(PASTA, `${nome}.png`), Buffer.from(png, 'base64'));
  console.log(`capturada: ${nome}.png`);
}

async function tamanho(largura, altura) {
  await wd('POST', `/session/${sessao}/window/rect`, { width: largura, height: altura });
}

try {
  for (let i = 0; i < 30; i++) {
    try { await fetch(`${DRIVER}/status`); break; } catch { await esperar(300); }
  }
  sessao = (await wd('POST', '/session', { capabilities: { alwaysMatch: { 'moz:firefoxOptions': { args: ['-headless'] } } } })).sessionId;
  await tamanho(1440, 1100);
  await wd('POST', `/session/${sessao}/url`, { url: APP });
  await js("localStorage.setItem('tema', 'dark'); return true;");
  await wd('POST', `/session/${sessao}/url`, { url: APP });
  await capturar('estudio-inicio', 2500);

  await clicar('Conteúdos', '.abas button');
  await clicar('o-que-e-uma-api', '.no-nome', true);
  await capturar('estudio-nota');

  await clicar('o-que-e-uma-api-sem-complicar', '.no-nome', true);
  await clicar('garçom do app', '.react-flow__node');
  await capturar('estudio-quadro-video', 9000);

  await clicar('carrossel-json-sem-medo', '.no-nome', true);
  await esperar(1500);
  await clicar('exemplo de verdade', '.react-flow__node');
  await capturar('estudio-quadro-carrossel', 7000);

  await clicar('Grafo', '.abas button');
  await capturar('estudio-grafo', 4000);

  await clicar('Marca', '.abas button');
  await capturar('estudio-marca');

  await clicar('Produções', '.abas button');
  await capturar('estudio-producoes', 2000);

  await clicar('Início', '.abas button');
  await clicar('Tema claro');
  await capturar('estudio-tema-claro');
  await clicar('Tema escuro');

  await tamanho(500, 1000);
  await capturar('estudio-estreito');
} finally {
  if (sessao) await wd('DELETE', `/session/${sessao}`).catch(() => {});
  geckodriver.kill();
}
