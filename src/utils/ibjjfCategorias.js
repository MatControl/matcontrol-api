// IBJJF Adult Gi weight classes (kg)
// Fonte: Tabela oficial IBJJF (Adulto, Gi). Pode ser atualizada conforme necessário.

const CLASSES_MASCULINO = [
  { nome: "Galo (Rooster)", maxKg: 57.5 },
  { nome: "Pluma (Light-Feather)", maxKg: 64 },
  { nome: "Pena (Feather)", maxKg: 70 },
  { nome: "Leve (Light)", maxKg: 76 },
  { nome: "Médio (Middle)", maxKg: 82.3 },
  { nome: "Meio-Pesado (Medium-Heavy)", maxKg: 88.3 },
  { nome: "Pesado (Heavy)", maxKg: 94.3 },
  { nome: "Super-Pesado (Super-Heavy)", maxKg: 100.5 },
];

const CLASSES_FEMININO = [
  { nome: "Galo (Rooster)", maxKg: 52.5 },
  { nome: "Pluma (Light-Feather)", maxKg: 56.5 },
  { nome: "Pena (Feather)", maxKg: 60.5 },
  { nome: "Leve (Light)", maxKg: 65 },
  { nome: "Médio (Middle)", maxKg: 69 },
  { nome: "Meio-Pesado (Medium-Heavy)", maxKg: 74 },
  { nome: "Pesado (Heavy)", maxKg: 79.3 },
];

export function getIbjjfAdultGiCategory(sexo, pesoKg) {
  const p = Number(pesoKg);
  const s = (sexo || "").toLowerCase();
  if (!Number.isFinite(p) || p <= 0) return null;
  const classes = s === "feminino" ? CLASSES_FEMININO : s === "masculino" ? CLASSES_MASCULINO : null;
  if (!classes) return null;
  const match = classes.find((c) => p <= c.maxKg);
  if (match) return match.nome;
  // Ultra-Heavy se excede última classe
  return "Ultra-Pesado (Ultra-Heavy)";
}

function byThresholds(p, list) {
  const match = list.find(c => p <= c.maxKg)
  return match ? match.nome : list.length ? `${list[list.length - 1].nome}+` : null
}

export function getWeightCategory(modalidadeNome, sexo, pesoKg) {
  const p = Number(pesoKg)
  const s = (sexo || '').toLowerCase()
  if (!Number.isFinite(p) || p <= 0) return null
  const m = String(modalidadeNome || '').toLowerCase()
  if (m.includes('jiu') || m.includes('bjj')) {
    return getIbjjfAdultGiCategory(sexo, p)
  }
  if (m.includes('jud')) {
    const masc = [
      { nome: '-60 kg', maxKg: 60 },
      { nome: '-66 kg', maxKg: 66 },
      { nome: '-73 kg', maxKg: 73 },
      { nome: '-81 kg', maxKg: 81 },
      { nome: '-90 kg', maxKg: 90 },
      { nome: '-100 kg', maxKg: 100 },
    ]
    const fem = [
      { nome: '-48 kg', maxKg: 48 },
      { nome: '-52 kg', maxKg: 52 },
      { nome: '-57 kg', maxKg: 57 },
      { nome: '-63 kg', maxKg: 63 },
      { nome: '-70 kg', maxKg: 70 },
      { nome: '-78 kg', maxKg: 78 },
    ]
    const list = s === 'feminino' ? fem : masc
    const res = byThresholds(p, list)
    return res || (s === 'feminino' ? '+78 kg' : '+100 kg')
  }
  if (m.includes('muay')) {
    const list = [
      { nome: '≤52 kg', maxKg: 52 },
      { nome: '≤57 kg', maxKg: 57 },
      { nome: '≤60 kg', maxKg: 60 },
      { nome: '≤63.5 kg', maxKg: 63.5 },
      { nome: '≤67 kg', maxKg: 67 },
      { nome: '≤71 kg', maxKg: 71 },
      { nome: '≤75 kg', maxKg: 75 },
      { nome: '≤81 kg', maxKg: 81 },
    ]
    const res = byThresholds(p, list)
    return res || '>81 kg'
  }
  if (m.includes('box')) {
    const list = [
      { nome: 'Fly', maxKg: 52 },
      { nome: 'Feather', maxKg: 57 },
      { nome: 'Lightweight', maxKg: 60 },
      { nome: 'Light-Welter', maxKg: 64 },
      { nome: 'Welter', maxKg: 69 },
      { nome: 'Middle', maxKg: 75 },
      { nome: 'Light-Heavy', maxKg: 81 },
      { nome: 'Cruiser', maxKg: 91 },
    ]
    const res = byThresholds(p, list)
    return res || 'Heavy'
  }
  if (m.includes('karat')) {
    const masc = [
      { nome: '-60 kg', maxKg: 60 },
      { nome: '-67 kg', maxKg: 67 },
      { nome: '-75 kg', maxKg: 75 },
      { nome: '-84 kg', maxKg: 84 },
    ]
    const fem = [
      { nome: '-50 kg', maxKg: 50 },
      { nome: '-55 kg', maxKg: 55 },
      { nome: '-61 kg', maxKg: 61 },
      { nome: '-68 kg', maxKg: 68 },
    ]
    const list = s === 'feminino' ? fem : masc
    const res = byThresholds(p, list)
    return res || (s === 'feminino' ? '+68 kg' : '+84 kg')
  }
  return getIbjjfAdultGiCategory(sexo, p)
}

export default { getIbjjfAdultGiCategory, getWeightCategory };