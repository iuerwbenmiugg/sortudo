import { DESTINOS, ELEITORES_APTOS, PRIMEIRO_TURNO, SEGUNDO_TURNO, type Origem } from "./data";
import { ajustarCelula, ajustarManual, completarMatriz, criarRng, matrizInicial, type Matriz } from "./fluxos";

const LINHAS = PRIMEIRO_TURNO.map((o) => o.votos);
const COLUNAS = DESTINOS.map((d) => SEGUNDO_TURNO[d.id]);
const FIEL = PRIMEIRO_TURNO.map((o) => {
  const j = DESTINOS.findIndex((d) => d.id === o.padrao);
  return j >= 0 ? j : undefined;
});

const fmtVotos = new Intl.NumberFormat("pt-BR");
const fmtPct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtPct2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ICONE_ABERTO = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>`;
const ICONE_FECHADO = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;

// Modo "fixo": toda mudança é compensada para que o 2º turno bata exatamente com o oficial.
// Modo "livre": tudo manual; o usuário tenta casar o 2º turno.
type Modo = "fixo" | "livre";

interface Estado {
  matriz: Matriz;
  travados: boolean[][];
}

// O modo livre começa zerado: o usuário distribui todos os votos na mão.
function estadoPadrao(m: Modo): Estado {
  const matriz =
    m === "fixo" ? matrizInicial(LINHAS, COLUNAS, FIEL) : LINHAS.map(() => COLUNAS.map(() => 0));
  return { matriz, travados: matriz.map((l) => l.map(() => false)) };
}

let modo: Modo = "livre";

// Um único cenário, compartilhado pelos dois modos: dá para começar no livre e terminar no fixo.
// matriz[origem][destino] = votos que saíram de `origem` no 1º turno e foram para `destino` no 2º.
let { matriz, travados } = estadoPadrao(modo);

// Um "gesto" é um arrasto contínuo de um slider: a semente aleatória é sorteada no
// início e o cálculo parte sempre da matriz de antes do arrasto, para que os outros
// sliders se movam de forma estável enquanto o usuário arrasta.
let gesto: { s: number; d: number; base: Matriz; semente: number } | null = null;

const ESPECIAIS = ["nulo", "branco", "abstencao"];

const el = <T extends HTMLElement = HTMLElement>(sel: string, raiz: ParentNode = document) =>
  raiz.querySelector<T>(sel)!;

const novaSemente = () => Math.floor(Math.random() * 2 ** 32);

// % de candidatos sobre válidos; brancos e nulos sobre comparecimento; abstenções sobre o eleitorado.
function percentual(id: string, votos: number, validos: number, abstencoes: number) {
  if (id === "abstencao") return { pct: votos / ELEITORES_APTOS, base: "do eleitorado" };
  if (id === "nulo" || id === "branco") {
    return { pct: votos / (ELEITORES_APTOS - abstencoes), base: "dos votos" };
  }
  return { pct: votos / validos, base: "dos válidos" };
}

function linhaResultado(id: string, nome: string, cor: string, votos: number, validos: number, abstencoes: number) {
  const { pct, base } = percentual(id, votos, validos, abstencoes);
  return `
    <li class="linha ${ESPECIAIS.includes(id) ? "especial" : ""}" style="--cor:${cor}">
      <span class="nome">${nome}</span>
      <span class="votos">${fmtVotos.format(votos)}</span>
      <span class="pct" title="${base}">${fmtPct2.format(pct * 100)}%</span>
    </li>`;
}

const RODAPE = `
  <p class="rodape">
    Eleitorado: <strong>${fmtVotos.format(ELEITORES_APTOS)}</strong><br />
    % de candidatos sobre válidos; brancos e nulos sobre comparecimento; abstenções sobre o eleitorado.
  </p>`;

// ---------- 1º turno ----------

function renderPrimeiroTurno() {
  const validos = PRIMEIRO_TURNO.filter((o) => !ESPECIAIS.includes(o.id)).reduce((acc, o) => acc + o.votos, 0);
  const abstencoes = PRIMEIRO_TURNO.find((o) => o.id === "abstencao")!.votos;

  const linhas = PRIMEIRO_TURNO.map((o) =>
    linhaResultado(o.id, nomeOrigem(o), corOrigem(o), o.votos, validos, abstencoes),
  ).join("");

  el("#lista-t1").innerHTML = `<ul class="tabela">${linhas}</ul>${RODAPE}`;
}

function nomeOrigem(o: Origem): string {
  return `${o.nome}${o.partido ? ` <small>${o.partido}</small>` : ""}`;
}

function corOrigem(o: Origem): string {
  const destino = DESTINOS.find((d) => d.id === o.padrao);
  return destino ? destino.cor : "var(--c-outros)";
}

// ---------- 2º turno ----------

const barra = (valores: number[]) =>
  DESTINOS.map((d, j) => `<span style="background:${d.cor};flex-grow:${valores[j]}"></span>`).join("");

const somaColunas = () => COLUNAS.map((_, j) => matriz.reduce((a, l) => a + l[j]!, 0));

function renderSegundoTurno() {
  if (modo === "fixo") renderSegundoTurnoFixo();
  else renderSegundoTurnoLivre();
}

function renderSegundoTurnoFixo() {
  const validos = SEGUNDO_TURNO.lula + SEGUNDO_TURNO.flavio;
  const linhas = DESTINOS.map((d) =>
    linhaResultado(d.id, d.nome, d.cor, SEGUNDO_TURNO[d.id], validos, SEGUNDO_TURNO.abstencao),
  ).join("");

  // Prova, a cada movimento, que as transferências reproduzem os dois turnos exatamente.
  const linhasOk = matriz.every((l, i) => l.reduce((a, b) => a + b, 0) === LINHAS[i]);
  const ok = linhasOk && somaColunas().every((c, j) => c === COLUNAS[j]);

  el("#lista-t2").innerHTML = `
    <ul class="tabela">${linhas}</ul>
    <div class="barra grande" aria-hidden="true">${barra(COLUNAS)}</div>
    <p class="conferencia ${ok ? "" : "falha"}">${
      ok
        ? "✓ As transferências reproduzem o 1º e o 2º turno voto a voto."
        : "✗ As transferências não batem com o resultado oficial."
    }</p>
    ${RODAPE}`;
}

function renderSegundoTurnoLivre() {
  const sim = somaColunas();
  const validosReal = COLUNAS[0]! + COLUNAS[1]!;
  const validosSim = sim[0]! + sim[1]!;

  const linhas = DESTINOS.map((d, j) => {
    const real = COLUNAS[j]!;
    const simulado = sim[j]!;
    const diff = simulado - real;
    const candidato = d.id === "lula" || d.id === "flavio";
    const pctReal = candidato ? `${fmtPct2.format((real / validosReal) * 100)}%` : "";
    const pctSim = candidato && validosSim > 0 ? `${fmtPct2.format((simulado / validosSim) * 100)}%` : "";
    return `
      <li class="linha2" style="--cor:${d.cor}">
        <span class="nome">${d.nome}</span>
        <span class="real"><strong>${fmtVotos.format(real)}</strong><small>${pctReal}</small></span>
        <span class="sim">${fmtVotos.format(simulado)}<small>${pctSim}</small></span>
        <span class="diff ${diff > 0 ? "pos" : diff < 0 ? "neg" : ""}">${diff > 0 ? "+" : ""}${fmtVotos.format(diff)}</span>
      </li>`;
  }).join("");

  // Votos colocados num destino que já passou do real: precisam ir para outro lugar.
  const foraDoLugar = sim.reduce((acc, x, j) => acc + Math.max(0, x - COLUNAS[j]!), 0);
  const pendentes = ELEITORES_APTOS - sim.reduce((a, b) => a + b, 0);

  el("#lista-t2").innerHTML = `
    <div class="cab2"><span></span><span>Real</span><span>Simulado</span><span>Diferença</span></div>
    <ul class="tabela2">${linhas}</ul>
    <div class="comparacao">
      <div><small>Real</small><div class="barra">${barra(COLUNAS)}</div></div>
      <div><small>Simulado</small><div class="barra">${barra(sim)}</div></div>
    </div>
    <p class="conferencia ${foraDoLugar === 0 && pendentes === 0 ? "" : "pendente"}">${
      foraDoLugar === 0 && pendentes === 0
        ? "✓ Casou! A simulação reproduz o 2º turno voto a voto."
        : [
            foraDoLugar > 0 &&
              `Votos fora do lugar: <strong>${fmtVotos.format(foraDoLugar)}</strong>
               <small>(${fmtPct2.format((foraDoLugar / ELEITORES_APTOS) * 100)}% do eleitorado)</small>`,
            pendentes > 0 && `Ainda não distribuídos: <strong>${fmtVotos.format(pendentes)}</strong>`,
          ]
            .filter(Boolean)
            .join("<br />")
    }</p>
    <p class="rodape">% de Lula e Flávio sobre os votos válidos. O 2º turno real é fixo; o simulado vem dos sliders.</p>`;
}

// ---------- Grupos de sliders ----------

function renderGrupos() {
  el("#grupos").innerHTML = PRIMEIRO_TURNO.map((o, s) => {
    const linhas = DESTINOS.map(
      (d, j) => `
        <div class="slider-linha" data-j="${j}" style="--cor:${d.cor}">
          <label for="s-${s}-${j}">${d.nome}</label>
          <input type="range" id="s-${s}-${j}" min="0" max="${o.votos}" step="1" data-s="${s}" data-j="${j}" />
          <output class="pct"></output>
          <span class="votos"></span>
          <button type="button" class="cadeado" data-s="${s}" data-j="${j}"></button>
        </div>`,
    ).join("");
    return `
      <article class="grupo" data-s="${s}">
        <header>
          <h3>${nomeOrigem(o)}</h3>
          <span class="votos-origem">${fmtVotos.format(o.votos)} votos</span>
        </header>
        <div class="barra" aria-hidden="true">
          ${DESTINOS.map((d) => `<span style="background:${d.cor}"></span>`).join("")}
          <span class="vazio"></span>
        </div>
        ${linhas}
        <p class="nao-distribuidos" hidden></p>
      </article>`;
  }).join("");

  atualizarTudo();
}

function atualizarGrupo(s: number) {
  const total = LINHAS[s]!;
  const art = el(`.grupo[data-s="${s}"]`);
  const barras = art.querySelectorAll<HTMLSpanElement>(".barra span");

  DESTINOS.forEach((d, j) => {
    const v = matriz[s]![j]!;
    const travado = travados[s]![j]!;
    const linha = el(`.slider-linha[data-j="${j}"]`, art);
    const input = el<HTMLInputElement>("input", linha);
    if (input.valueAsNumber !== v) input.value = String(v);
    input.disabled = travado;
    input.style.setProperty("--fill", `${(v / total) * 100}%`);
    linha.classList.toggle("travada", travado);
    el("output", linha).textContent = `${fmtPct.format((v / total) * 100)}%`;
    el(".votos", linha).textContent = fmtVotos.format(v);

    const botao = el<HTMLButtonElement>(".cadeado", linha);
    botao.innerHTML = travado ? ICONE_FECHADO : ICONE_ABERTO;
    botao.setAttribute("aria-pressed", String(travado));
    botao.setAttribute("aria-label", `${travado ? "Destravar" : "Travar"} ${d.nome} (${PRIMEIRO_TURNO[s]!.nome})`);
    botao.title = travado ? "Destravar" : "Travar";

    barras[j]!.style.flexGrow = String(v);
    barras[j]!.hidden = v === 0;
  });

  // Só acontece no modo livre: votos que o usuário tirou e ainda não colocou em lugar nenhum.
  const pendentes = total - matriz[s]!.reduce((a, b) => a + b, 0);
  const vazio = barras[DESTINOS.length]!;
  vazio.style.flexGrow = String(pendentes);
  vazio.hidden = pendentes === 0;
  const aviso = el(".nao-distribuidos", art);
  aviso.hidden = pendentes === 0;
  aviso.textContent = `Não distribuídos: ${fmtVotos.format(pendentes)} votos (${fmtPct.format((pendentes / total) * 100)}%)`;
}

function atualizarTudo() {
  PRIMEIRO_TURNO.forEach((_, s) => atualizarGrupo(s));
  renderSegundoTurno();
}

// ---------- Modo ----------

const DICAS: Record<Modo, string> = {
  fixo: `Cada slider diz quantos eleitores daquele grupo do 1º turno foram para cada destino no 2º.
    Ao mexer um, a diferença é compensada aleatoriamente nos outros sliders (deste e de outros
    grupos) de modo que o 1º e o 2º turno continuem exatamente iguais aos oficiais. Trave com o
    cadeado o que não deve mudar. Se um slider não andar, é porque as travas não deixam espaço
    para compensar.`,
  livre: `Cada slider diz quantos eleitores daquele grupo do 1º turno foram para cada destino no 2º.
    Aqui tudo é manual: mexer um slider não altera nenhum outro. Ao baixar um, os votos ficam
    "não distribuídos" no grupo; para subir, é preciso haver votos não distribuídos. Tente fazer o
    2º turno simulado casar com o real. Trave com o cadeado o que não deve mudar. Ao passar para
    o modo fixo, o que você distribuiu é mantido e o que faltar é completado automaticamente.`,
};

function aplicarModo() {
  document.querySelectorAll<HTMLButtonElement>("[data-modo]").forEach((b) => {
    b.setAttribute("aria-checked", String(b.dataset.modo === modo));
  });
  el("#dica").textContent = DICAS[modo];
  atualizarTudo();
}

function trocarModo(novo: Modo) {
  if (novo === modo) return;
  if (novo === "fixo") {
    // O fixo exige bater com o 2º turno: completa a distribuição feita no livre.
    const completa = completarMatriz(matriz, travados, LINHAS, COLUNAS);
    if (!completa) {
      alert(
        "Não dá para passar ao modo fixo com essas travas: os valores travados não cabem no " +
          "resultado do 2º turno. Destrave algum slider e tente de novo.",
      );
      return;
    }
    matriz = completa;
  }
  modo = novo;
  gesto = null;
  aplicarModo();
}

// ---------- Eventos ----------

function moverPara(s: number, d: number, alvo: number, base: Matriz, semente: number) {
  matriz =
    modo === "fixo"
      ? ajustarCelula(base, travados, s, d, alvo, criarRng(semente))
      : ajustarManual(base, travados, s, d, alvo, LINHAS[s]!);
  atualizarTudo();
}

document.addEventListener("input", (ev) => {
  const input = ev.target as HTMLInputElement;
  if (input.type !== "range" || input.dataset.s === undefined) return;
  const s = Number(input.dataset.s);
  const d = Number(input.dataset.j);

  if (!gesto || gesto.s !== s || gesto.d !== d) {
    gesto = { s, d, base: matriz, semente: novaSemente() };
  }
  moverPara(s, d, input.valueAsNumber, gesto.base, gesto.semente);
});

document.addEventListener("change", (ev) => {
  if ((ev.target as HTMLInputElement).type === "range") gesto = null;
});

// Com step de 1 voto, as setas nativas seriam inúteis: cada tecla move 0,1% da origem
// (Shift: 1%, PageUp/PageDown: 10%).
document.addEventListener("keydown", (ev) => {
  const input = ev.target as HTMLInputElement;
  if (input.type !== "range" || input.dataset.s === undefined) return;
  const s = Number(input.dataset.s);
  const d = Number(input.dataset.j);
  const total = LINHAS[s]!;
  const atual = matriz[s]![d]!;
  const passo = Math.max(1, Math.round(total * (ev.shiftKey ? 0.01 : 0.001)));

  const alvos: Record<string, number> = {
    ArrowRight: atual + passo,
    ArrowUp: atual + passo,
    ArrowLeft: atual - passo,
    ArrowDown: atual - passo,
    PageUp: atual + Math.round(total * 0.1),
    PageDown: atual - Math.round(total * 0.1),
    Home: 0,
    End: total,
  };
  const alvo = alvos[ev.key];
  if (alvo === undefined) return;
  ev.preventDefault();
  gesto = null;
  moverPara(s, d, alvo, matriz, novaSemente());
});

document.addEventListener("click", (ev) => {
  const botao = (ev.target as HTMLElement).closest<HTMLButtonElement>(".cadeado");
  if (!botao) return;
  const s = Number(botao.dataset.s);
  const d = Number(botao.dataset.j);
  travados[s]![d] = !travados[s]![d];
  gesto = null;
  atualizarGrupo(s);
});

document.querySelectorAll<HTMLButtonElement>("[data-modo]").forEach((b) => {
  b.addEventListener("click", () => trocarModo(b.dataset.modo as Modo));
});

el("#restaurar").addEventListener("click", () => {
  ({ matriz, travados } = estadoPadrao(modo));
  gesto = null;
  atualizarTudo();
});

renderPrimeiroTurno();
renderGrupos();
aplicarModo();
