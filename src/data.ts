// Resultado oficial (TSE) da eleição presidencial de 2026.
// 1º turno: 4/out/2026 · 2º turno: 25/out/2026.
// Abstenções = eleitores aptos − comparecimento.

export const ELEITORES_APTOS = 158_745_502;

export type DestinoId = "lula" | "flavio" | "branco" | "nulo" | "abstencao";

export interface Destino {
  id: DestinoId;
  nome: string;
  cor: string;
}

export const DESTINOS: Destino[] = [
  { id: "lula", nome: "Lula", cor: "var(--c-lula)" },
  { id: "flavio", nome: "Flávio", cor: "var(--c-flavio)" },
  { id: "nulo", nome: "Nulo", cor: "var(--c-nulo)" },
  { id: "branco", nome: "Branco", cor: "var(--c-branco)" },
  { id: "abstencao", nome: "Abstenção", cor: "var(--c-abstencao)" },
];

export interface Origem {
  id: string;
  nome: string;
  partido?: string;
  votos: number;
  // Para onde essa origem vai por padrão (ex.: eleitor do Lula continua Lula).
  padrao?: DestinoId;
}

export const PRIMEIRO_TURNO: Origem[] = [
  { id: "flavio", nome: "Flávio Bolsonaro", partido: "PL", votos: 56_104_503, padrao: "flavio" },
  { id: "lula", nome: "Lula", partido: "PT", votos: 53_879_538, padrao: "lula" },
  { id: "cury", nome: "Augusto Cury", partido: "Avante", votos: 3_448_569 },
  { id: "renan", nome: "Renan Santos", partido: "Missão", votos: 2_675_887 },
  { id: "caiado", nome: "Ronaldo Caiado", partido: "PSD", votos: 2_605_148 },
  { id: "zema", nome: "Romeu Zema", partido: "Novo", votos: 326_488 },
  { id: "samara", nome: "Samara Martins", partido: "UP", votos: 122_911 },
  { id: "hertz", nome: "Hertz Dias", partido: "PSTU", votos: 43_103 },
  { id: "clariana", nome: "Clariana Barão", partido: "DC", votos: 40_043 },
  { id: "edmilson", nome: "Edmilson Costa", partido: "PCB", votos: 22_693 },
  { id: "wilson", nome: "Wilson Grassi", partido: "Democrata", votos: 16_881 },
  { id: "rui", nome: "Rui Costa Pimenta", partido: "PCO", votos: 15_024 },
  { id: "nulo", nome: "Nulos", votos: 3_674_249, padrao: "nulo" },
  { id: "branco", nome: "Brancos", votos: 2_300_798, padrao: "branco" },
  { id: "abstencao", nome: "Abstenções", votos: 33_469_667, padrao: "abstencao" },
];

export const SEGUNDO_TURNO: Record<DestinoId, number> = {
  lula: 64_256_232,
  flavio: 59_826_041,
  nulo: 2_723_305,
  branco: 1_430_496,
  abstencao: 30_509_428,
};
