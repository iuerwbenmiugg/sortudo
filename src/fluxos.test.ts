import { describe, expect, it } from "vitest";
import { DESTINOS, PRIMEIRO_TURNO, SEGUNDO_TURNO } from "./data";
import { ajustarCelula, ajustarManual, completarMatriz, criarRng, matrizInicial, type Matriz } from "./fluxos";

const somaLinhas = (m: Matriz) => m.map((l) => l.reduce((a, b) => a + b, 0));
const somaColunas = (m: Matriz) => m[0]!.map((_, j) => m.reduce((a, l) => a + l[j]!, 0));

const LINHAS = PRIMEIRO_TURNO.map((o) => o.votos);
const COLUNAS = DESTINOS.map((d) => SEGUNDO_TURNO[d.id]);
const FIEL = PRIMEIRO_TURNO.map((o) => {
  const j = DESTINOS.findIndex((d) => d.id === o.padrao);
  return j >= 0 ? j : undefined;
});

function invariantes(m: Matriz, linhas: number[], colunas: number[]) {
  expect(somaLinhas(m)).toEqual(linhas);
  expect(somaColunas(m)).toEqual(colunas);
  for (const l of m) for (const x of l) {
    expect(Number.isInteger(x)).toBe(true);
    expect(x).toBeGreaterThanOrEqual(0);
  }
}

const semTravas = (m: Matriz) => m.map((l) => l.map(() => false));

describe("dados", () => {
  it("1º e 2º turno têm o mesmo eleitorado", () => {
    expect(LINHAS.reduce((a, b) => a + b, 0)).toBe(COLUNAS.reduce((a, b) => a + b, 0));
  });
});

describe("matrizInicial", () => {
  it("bate exatamente com o 1º turno (linhas) e o 2º turno (colunas)", () => {
    invariantes(matrizInicial(LINHAS, COLUNAS, FIEL), LINHAS, COLUNAS);
  });

  it("mantém cada um no próprio voto até o limite do 2º turno", () => {
    const m = matrizInicial(LINHAS, COLUNAS, FIEL);
    const lula = PRIMEIRO_TURNO.findIndex((o) => o.id === "lula");
    const abst = PRIMEIRO_TURNO.findIndex((o) => o.id === "abstencao");
    expect(m[lula]![0]).toBe(LINHAS[lula]); // todo eleitor do Lula continua Lula
    expect(m[abst]![4]).toBe(COLUNAS[4]); // abstenção do 2º turno inteira veio de abstenção
  });
});

describe("ajustarCelula", () => {
  const base = matrizInicial(LINHAS, COLUNAS, FIEL);
  const renan = PRIMEIRO_TURNO.findIndex((o) => o.id === "renan");

  it("aumenta a célula e preserva 1º e 2º turno", () => {
    const alvo = base[renan]![0]! + 500_000;
    const m = ajustarCelula(base, semTravas(base), renan, 0, alvo, criarRng(1));
    expect(m[renan]![0]).toBe(alvo);
    invariantes(m, LINHAS, COLUNAS);
  });

  it("diminui a célula e preserva 1º e 2º turno", () => {
    const m = ajustarCelula(base, semTravas(base), renan, 0, 0, criarRng(2));
    expect(m[renan]![0]).toBe(0);
    invariantes(m, LINHAS, COLUNAS);
  });

  it("move Lula → Flávio no grupo do Lula", () => {
    const m = ajustarCelula(base, semTravas(base), 1, 1, 3_000_000, criarRng(3));
    expect(m[1]![1]).toBe(3_000_000);
    invariantes(m, LINHAS, COLUNAS);
  });

  it("não altera células travadas", () => {
    const travas = semTravas(base);
    travas[renan]![1] = true;
    travas[0]![0] = true;
    travas[1]![0] = true;
    const m = ajustarCelula(base, travas, renan, 0, base[renan]![0]! + 200_000, criarRng(4));
    expect(m[renan]![1]).toBe(base[renan]![1]);
    expect(m[0]![0]).toBe(base[0]![0]);
    expect(m[1]![0]).toBe(base[1]![0]);
    invariantes(m, LINHAS, COLUNAS);
  });

  it("para no máximo possível quando o alvo é inviável", () => {
    const m = ajustarCelula(base, semTravas(base), renan, 0, 10 ** 12, criarRng(5));
    expect(m[renan]![0]).toBe(LINHAS[renan]); // a linha inteira cabe em Lula
    invariantes(m, LINHAS, COLUNAS);
  });

  it("não move se travas impedem qualquer compensação", () => {
    const travas = semTravas(base).map((l, i) => l.map(() => i !== renan));
    // só a linha do Renan está livre: mexer nela mudaria as colunas
    const m = ajustarCelula(base, travas, renan, 0, base[renan]![0]! + 1000, criarRng(6));
    expect(m).toEqual(base);
  });

  it("atinge o máximo: depois dele, nem 1 voto a mais é possível", () => {
    const travas = semTravas(base);
    travas[1]![0] = true; // Lula → Lula travado: aperta o espaço de Lula no 2º turno
    const m = ajustarCelula(base, travas, 0, 0, 10 ** 12, criarRng(7));
    invariantes(m, LINHAS, COLUNAS);
    const m2 = ajustarCelula(m, travas, 0, 0, m[0]![0]! + 1, criarRng(8));
    expect(m2).toEqual(m);
    // Flávio → Lula no máximo = 2º turno do Lula − o que está travado em Lula → Lula
    expect(m[0]![0]).toBe(COLUNAS[0]! - base[1]![0]!);
  });

  it("é determinístico para a mesma semente", () => {
    const a = ajustarCelula(base, semTravas(base), renan, 2, 800_000, criarRng(42));
    const b = ajustarCelula(base, semTravas(base), renan, 2, 800_000, criarRng(42));
    expect(a).toEqual(b);
  });

  it("invariantes valem em movimentos aleatórios com travas", () => {
    const rnd = criarRng(99);
    let m = base;
    for (let k = 0; k < 300; k++) {
      const travas = m.map((l) => l.map(() => rnd() < 0.2));
      const s = Math.floor(rnd() * m.length);
      const d = Math.floor(rnd() * DESTINOS.length);
      travas[s]![d] = false;
      const alvo = Math.floor(rnd() * LINHAS[s]! * 1.1);
      const r = ajustarCelula(m, travas, s, d, alvo, criarRng(k));
      invariantes(r, LINHAS, COLUNAS);
      r.forEach((l, i) =>
        l.forEach((x, j) => {
          if (travas[i]![j]) expect(x).toBe(m[i]![j]);
        }),
      );
      m = r;
    }
  });
});

describe("ajustarManual (modo livre)", () => {
  const base = matrizInicial(LINHAS, COLUNAS, FIEL);
  const renan = PRIMEIRO_TURNO.findIndex((o) => o.id === "renan");
  const total = LINHAS[renan]!;

  it("diminuir só muda a própria célula e deixa votos não distribuídos", () => {
    const m = ajustarManual(base, semTravas(base), renan, 0, 100_000, total);
    expect(m[renan]![0]).toBe(100_000);
    m.forEach((l, i) => l.forEach((x, j) => {
      if (i !== renan || j !== 0) expect(x).toBe(base[i]![j]);
    }));
    expect(total - m[renan]!.reduce((a, b) => a + b, 0)).toBe(base[renan]![0]! - 100_000);
  });

  it("aumentar só usa o que está não distribuído", () => {
    const m1 = ajustarManual(base, semTravas(base), renan, 0, 0, total);
    const m2 = ajustarManual(m1, semTravas(base), renan, 1, total, total);
    expect(m2[renan]![1]).toBe(base[renan]![1]! + base[renan]![0]!);
    expect(m2[renan]!.reduce((a, b) => a + b, 0)).toBe(total);
  });

  it("não passa do total da linha e não fica negativo", () => {
    const m = ajustarManual(base, semTravas(base), renan, 2, 10 ** 12, total);
    expect(m[renan]!.reduce((a, b) => a + b, 0)).toBe(total);
    expect(ajustarManual(base, semTravas(base), renan, 2, -5, total)[renan]![2]).toBe(0);
  });

  it("a partir do zero, sobe até o total do grupo", () => {
    const zero = base.map((l) => l.map(() => 0));
    const m = ajustarManual(zero, semTravas(zero), renan, 3, 10 ** 12, total);
    expect(m[renan]).toEqual([0, 0, 0, total, 0]);
  });

  it("célula travada não muda", () => {
    const travas = semTravas(base);
    travas[renan]![0] = true;
    expect(ajustarManual(base, travas, renan, 0, 0, total)).toEqual(base);
  });
});

describe("completarMatriz (livre → fixo)", () => {
  const zero = LINHAS.map(() => COLUNAS.map(() => 0));
  const idx = (id: string) => PRIMEIRO_TURNO.findIndex((o) => o.id === id);

  it("completa uma matriz zerada", () => {
    invariantes(completarMatriz(zero, semTravas(zero), LINHAS, COLUNAS)!, LINHAS, COLUNAS);
  });

  it("não muda uma matriz que já bate", () => {
    const exata = matrizInicial(LINHAS, COLUNAS, FIEL);
    expect(completarMatriz(exata, semTravas(exata), LINHAS, COLUNAS)).toEqual(exata);
  });

  it("preserva o que o usuário distribuiu quando cabe no resultado", () => {
    const m = zero.map((l) => [...l]);
    m[idx("renan")]![0] = 2_000_000;
    m[idx("lula")]![0] = 50_000_000;
    m[idx("flavio")]![1] = 55_000_000;
    const r = completarMatriz(m, semTravas(m), LINHAS, COLUNAS)!;
    invariantes(r, LINHAS, COLUNAS);
    expect(r[idx("renan")]![0]).toBeGreaterThanOrEqual(2_000_000);
    expect(r[idx("lula")]![0]).toBeGreaterThanOrEqual(50_000_000);
    expect(r[idx("flavio")]![1]).toBeGreaterThanOrEqual(55_000_000);
  });

  it("corta o excesso de um destino que passou do real", () => {
    const m = zero.map((l) => [...l]);
    m[idx("lula")]![0] = LINHAS[idx("lula")]!;
    m[idx("flavio")]![0] = LINHAS[idx("flavio")]!; // Lula fica com 110 mi > 64 mi
    invariantes(completarMatriz(m, semTravas(m), LINHAS, COLUNAS)!, LINHAS, COLUNAS);
  });

  it("respeita travas", () => {
    const m = zero.map((l) => [...l]);
    m[idx("lula")]![0] = LINHAS[idx("lula")]!;
    const travas = semTravas(m);
    travas[idx("lula")]![0] = true;
    travas[idx("abstencao")]![4] = true; // abstenção → abstenção travada em 0
    const r = completarMatriz(m, travas, LINHAS, COLUNAS)!;
    invariantes(r, LINHAS, COLUNAS);
    expect(r[idx("lula")]![0]).toBe(LINHAS[idx("lula")]);
    expect(r[idx("abstencao")]![4]).toBe(0);
  });

  it("retorna null quando as travas tornam impossível", () => {
    const m = zero.map((l) => [...l]);
    m[idx("lula")]![0] = LINHAS[idx("lula")]!;
    m[idx("flavio")]![0] = LINHAS[idx("flavio")]!;
    const travas = semTravas(m);
    travas[idx("lula")]![0] = true;
    travas[idx("flavio")]![0] = true; // 110 mi travados em Lula > 64 mi
    expect(completarMatriz(m, travas, LINHAS, COLUNAS)).toBeNull();
  });

  it("invariantes em matrizes parciais aleatórias com travas", () => {
    const rnd = criarRng(123);
    let nulos = 0;
    for (let k = 0; k < 200; k++) {
      // matriz parcial: cada linha distribui uma fração aleatória do seu total
      const m = LINHAS.map((t) => {
        const pesos = COLUNAS.map(() => (rnd() < 0.5 ? rnd() : 0));
        const soma = pesos.reduce((a, b) => a + b, 0) || 1;
        const frac = rnd();
        return pesos.map((p) => Math.floor((t * frac * p) / soma));
      });
      const travas = m.map((l) => l.map(() => rnd() < 0.1));
      const r = completarMatriz(m, travas, LINHAS, COLUNAS);
      if (!r) {
        nulos++;
        continue;
      }
      invariantes(r, LINHAS, COLUNAS);
      r.forEach((l, i) => l.forEach((x, j) => travas[i]![j] && expect(x).toBe(m[i]![j])));
    }
    expect(nulos).toBeLessThan(200);
  });
});
