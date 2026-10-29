// Matriz de transferência de votos: linha = origem no 1º turno, coluna = destino no 2º.
// Valores em votos inteiros. A soma de cada linha é fixa (resultado do 1º turno) e a
// soma de cada coluna é fixa (resultado do 2º turno).
export type Matriz = number[][];

// PRNG com semente (mulberry32), para que um mesmo arrasto produza resultados estáveis.
export function criarRng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Matriz padrão: cada origem com destino "fiel" (Lula → Lula, nulo → nulo…) fica nele
 * até o limite do 2º turno; o resto é distribuído proporcionalmente ao que falta em cada coluna.
 */
export function matrizInicial(linhas: number[], colunas: number[], fiel: (number | undefined)[]): Matriz {
  const m = linhas.map(() => colunas.map(() => 0));
  const restoLinha = [...linhas];
  const restoColuna = [...colunas];

  fiel.forEach((j, i) => {
    if (j === undefined) return;
    const x = Math.min(restoLinha[i]!, restoColuna[j]!);
    m[i]![j] = x;
    restoLinha[i]! -= x;
    restoColuna[j]! -= x;
  });

  const pendentes = restoLinha.map((_, i) => i).filter((i) => restoLinha[i]! > 0);
  pendentes.forEach((i, n) => {
    const partes =
      n === pendentes.length - 1
        ? [...restoColuna] // a última linha fecha as colunas exatamente
        : repartirProporcional(restoLinha[i]!, restoColuna);
    partes.forEach((x, j) => {
      m[i]![j]! += x;
      restoColuna[j]! -= x;
    });
  });
  return m;
}

// Reparte `quantidade` em inteiros proporcionais a `pesos` (maiores restos).
function repartirProporcional(quantidade: number, pesos: number[]): number[] {
  const total = pesos.reduce((a, b) => a + b, 0);
  if (total === 0) return pesos.map(() => 0);
  const exatas = pesos.map((p) => (quantidade * p) / total);
  const partes = exatas.map(Math.floor);
  let sobra = quantidade - partes.reduce((a, b) => a + b, 0);
  exatas
    .map((x, j) => ({ j, resto: x - Math.floor(x) }))
    .sort((a, b) => b.resto - a.resto)
    .forEach(({ j }) => {
      if (sobra > 0) {
        partes[j]!++;
        sobra--;
      }
    });
  return partes;
}

/**
 * Modo livre: muda só a célula (s, d), sem mexer em nenhuma outra. O alvo é limitado
 * para que a linha não passe do total do 1º turno; o que sobra fica "não distribuído".
 */
export function ajustarManual(
  base: Matriz,
  travados: boolean[][],
  s: number,
  d: number,
  alvo: number,
  totalLinha: number,
): Matriz {
  const m = base.map((l) => [...l]);
  if (travados[s]![d]) return m;
  const outros = m[s]!.reduce((acc, v, j) => (j === d ? acc : acc + v), 0);
  m[s]![d] = Math.round(Math.min(Math.max(alvo, 0), totalLinha - outros));
  return m;
}

/**
 * Passagem do modo livre para o fixo: completa a matriz para que bata exatamente com o
 * 1º turno (linhas) e o 2º turno (colunas), mexendo o mínimo e sem tocar em travados.
 *
 * 1. Corta, proporcionalmente, o excesso de linhas/colunas que passaram do total.
 * 2. Distribui o que falta em cada linha entre as colunas que ainda têm falta,
 *    proporcionalmente à falta de cada coluna.
 * 3. Se as travas impedirem o passo 2, remaneja células por caminhos aumentantes.
 *
 * Retorna null se as travas tornam impossível bater os dois turnos.
 */
export function completarMatriz(
  base: Matriz,
  travados: boolean[][],
  linhas: number[],
  colunas: number[],
): Matriz | null {
  const m = base.map((l) => [...l]);
  const nL = linhas.length;
  const nC = colunas.length;
  const livre = (u: number, v: number) => !travados[u]![v];
  const somaLinha = (u: number) => m[u]!.reduce((a, b) => a + b, 0);
  const somaColuna = (v: number) => m.reduce((a, l) => a + l[v]!, 0);

  // 1. excessos
  const cortar = (celulas: [number, number][], excesso: number) => {
    const livres = celulas.filter(([u, v]) => livre(u, v));
    const disponivel = livres.reduce((a, [u, v]) => a + m[u]![v]!, 0);
    if (disponivel < excesso) return false;
    const cortes = repartirProporcional(excesso, livres.map(([u, v]) => m[u]![v]!));
    livres.forEach(([u, v], k) => (m[u]![v]! -= cortes[k]!));
    return true;
  };
  for (let u = 0; u < nL; u++) {
    const excesso = somaLinha(u) - linhas[u]!;
    if (excesso > 0 && !cortar(colunas.map((_, v) => [u, v]), excesso)) return null;
  }
  for (let v = 0; v < nC; v++) {
    const excesso = somaColuna(v) - colunas[v]!;
    if (excesso > 0 && !cortar(linhas.map((_, u) => [u, v]), excesso)) return null;
  }

  // 2. preenchimento proporcional à falta de cada coluna
  const faltaLinha = linhas.map((t, u) => t - somaLinha(u));
  const faltaColuna = colunas.map((t, v) => t - somaColuna(v));
  for (let u = 0; u < nL; u++) {
    const alvos = faltaColuna.map((f, v) => (livre(u, v) ? f : 0));
    const cabe = alvos.reduce((a, b) => a + b, 0);
    const partes = repartirProporcional(Math.min(faltaLinha[u]!, cabe), alvos);
    partes.forEach((x, v) => {
      m[u]![v]! += x;
      faltaLinha[u]! -= x;
      faltaColuna[v]! -= x;
    });
  }

  // 3. o que sobrou: caminhos linha com falta → … → coluna com falta, alternando
  //    aumentar (linha→coluna) e diminuir (coluna→linha) células livres.
  for (let iter = 0; faltaLinha.some((f) => f > 0) && iter < MAX_ITERACOES; iter++) {
    const anterior = new Map<number, number>();
    const fila: number[] = [];
    faltaLinha.forEach((f, u) => {
      if (f > 0) {
        anterior.set(u, -1);
        fila.push(u);
      }
    });
    let fim = -1;
    while (fila.length > 0 && fim < 0) {
      const no = fila.shift()!;
      const vizinhos: number[] = [];
      if (no < nL) {
        for (let v = 0; v < nC; v++) if (livre(no, v)) vizinhos.push(nL + v);
      } else {
        for (let u = 0; u < nL; u++) if (livre(u, no - nL) && m[u]![no - nL]! > 0) vizinhos.push(u);
      }
      for (const viz of vizinhos) {
        if (anterior.has(viz)) continue;
        anterior.set(viz, no);
        if (viz >= nL && faltaColuna[viz - nL]! > 0) {
          fim = viz;
          break;
        }
        fila.push(viz);
      }
    }
    if (fim < 0) return null;

    const passos: Passo[] = [];
    let no = fim;
    while (anterior.get(no)! !== -1) {
      const de = anterior.get(no)!;
      passos.push(
        de < nL ? { u: de, v: no - nL, linhaParaColuna: true } : { u: no, v: de - nL, linhaParaColuna: false },
      );
      no = de;
    }
    const origem = no;
    let qtd = Math.min(faltaLinha[origem]!, faltaColuna[fim - nL]!);
    for (const p of passos) if (!p.linhaParaColuna) qtd = Math.min(qtd, m[p.u]![p.v]!);
    for (const p of passos) m[p.u]![p.v]! += p.linhaParaColuna ? qtd : -qtd;
    faltaLinha[origem]! -= qtd;
    faltaColuna[fim - nL]! -= qtd;
  }
  return faltaLinha.every((f) => f === 0) ? m : null;
}

// Quantas fatias o ajuste é dividido: cada fatia segue um caminho sorteado,
// o que espalha a compensação aleatoriamente por várias células.
const FATIAS = 24;
const MAX_ITERACOES = 5000;

/**
 * Leva a célula (s, d) para `alvo` (ou o mais perto possível) mantendo todas as somas
 * de linha e coluna e sem tocar em células travadas.
 *
 * Cada fatia do ajuste percorre um ciclo alternado na matriz. Para aumentar (s, d):
 * diminui (s, v₁), aumenta (u₁, v₁), diminui (u₁, v₂), …, diminui (uₖ, d). Cada linha
 * e coluna do ciclo ganha e perde a mesma quantidade, então os totais não mudam.
 * Para diminuir (s, d) os papéis de aumentar/diminuir se invertem.
 * Os ciclos são caminhos aumentantes (BFS com vizinhos embaralhados) de s até d.
 */
export function ajustarCelula(
  base: Matriz,
  travados: boolean[][],
  s: number,
  d: number,
  alvo: number,
  rand: () => number,
): Matriz {
  const m = base.map((l) => [...l]);
  const nLinhas = m.length;
  const nColunas = m[0]!.length;
  const linhaTotal = m[s]!.reduce((a, b) => a + b, 0);
  const alvoValido = Math.round(Math.min(Math.max(alvo, 0), linhaTotal));
  const aumentar = alvoValido > m[s]![d]!;
  let falta = Math.abs(alvoValido - m[s]![d]!);
  if (falta === 0 || travados[s]![d]) return m;

  const fatia = Math.max(1, Math.ceil(falta / FATIAS));
  const livre = (u: number, v: number) => !travados[u]![v] && !(u === s && v === d);

  // Arestas linha→coluna: diminuem (u, v) ao aumentar; aumentam ao diminuir.
  // Arestas coluna→linha: o contrário. Uma aresta que diminui exige célula > 0.
  const podeLinhaColuna = (u: number, v: number) => livre(u, v) && (!aumentar || m[u]![v]! > 0);
  const podeColunaLinha = (u: number, v: number) => livre(u, v) && (aumentar || m[u]![v]! > 0);

  for (let iter = 0; falta > 0 && iter < MAX_ITERACOES; iter++) {
    const caminho = buscarCaminho(nLinhas, nColunas, s, d, podeLinhaColuna, podeColunaLinha, rand);
    if (!caminho) break;

    // Células que diminuem limitam a quantidade.
    let qtd = Math.min(fatia, falta);
    for (const { u, v, linhaParaColuna } of caminho) {
      if (linhaParaColuna === aumentar) qtd = Math.min(qtd, m[u]![v]!);
    }
    for (const { u, v, linhaParaColuna } of caminho) {
      m[u]![v]! += linhaParaColuna === aumentar ? -qtd : qtd;
    }
    m[s]![d]! += aumentar ? qtd : -qtd;
    falta -= qtd;
  }
  return m;
}

interface Passo {
  u: number; // linha da célula
  v: number; // coluna da célula
  linhaParaColuna: boolean;
}

// BFS do nó-linha s até o nó-coluna d, alternando linha → coluna → linha…
function buscarCaminho(
  nLinhas: number,
  nColunas: number,
  s: number,
  d: number,
  podeLinhaColuna: (u: number, v: number) => boolean,
  podeColunaLinha: (u: number, v: number) => boolean,
  rand: () => number,
): Passo[] | null {
  // nós: linhas 0..nLinhas-1, colunas nLinhas..nLinhas+nColunas-1
  const anterior = new Map<number, number>([[s, -1]]);
  const fila = [s];
  const destino = nLinhas + d;

  while (fila.length > 0) {
    const no = fila.shift()!;
    const vizinhos: number[] = [];
    if (no < nLinhas) {
      for (let v = 0; v < nColunas; v++) if (podeLinhaColuna(no, v)) vizinhos.push(nLinhas + v);
    } else {
      const v = no - nLinhas;
      for (let u = 0; u < nLinhas; u++) if (podeColunaLinha(u, v)) vizinhos.push(u);
    }
    embaralhar(vizinhos, rand);

    for (const viz of vizinhos) {
      if (anterior.has(viz)) continue;
      anterior.set(viz, no);
      if (viz === destino) return montarCaminho(anterior, destino, nLinhas);
      fila.push(viz);
    }
  }
  return null;
}

function montarCaminho(anterior: Map<number, number>, destino: number, nLinhas: number): Passo[] {
  const passos: Passo[] = [];
  let no = destino;
  while (anterior.get(no)! !== -1) {
    const de = anterior.get(no)!;
    passos.push(
      de < nLinhas
        ? { u: de, v: no - nLinhas, linhaParaColuna: true }
        : { u: no, v: de - nLinhas, linhaParaColuna: false },
    );
    no = de;
  }
  return passos.reverse();
}

function embaralhar<T>(lista: T[], rand: () => number) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [lista[i], lista[j]] = [lista[j]!, lista[i]!];
  }
}
