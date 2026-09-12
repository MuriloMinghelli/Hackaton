// Estimativa de custo por modal. Não existe fonte pública gratuita de tarifa real de
// ônibus/app pro Vale do Sinos, então isso é sempre uma ESTIMATIVA, rotulada como tal —
// nunca apresentada como preço exato.

const WALKING_MODALS = new Set(["a-pe", "cadeira-de-rodas", "com-apoio", "carrinho-bebe"]);

export function estimateCost(modal, distanceMeters, durationSeconds) {
  const km = distanceMeters / 1000;

  if (WALKING_MODALS.has(modal)) {
    return { amountBRL: 0, label: "grátis" };
  }

  if (modal === "bicicleta") {
    return { amountBRL: 0, label: "grátis (sua bike)" };
  }

  if (modal === "onibus") {
    // Tarifa de ônibus urbano é fixa por viagem (não varia com a distância) — por isso
    // um valor fixo é, na verdade, mais realista do que uma fórmula por km.
    return { amountBRL: 5.5, label: "~R$ 5,50 (tarifa estimada)" };
  }

  if (modal === "carro") {
    // Estimativa no estilo app de transporte: bandeirada + por km + por minuto.
    const minutes = durationSeconds / 60;
    const raw = 4 + km * 1.2 + minutes * 0.25;
    const amount = Math.round(raw * 100) / 100;
    const formatted = amount.toFixed(2).replace(".", ",");
    return { amountBRL: amount, label: `~R$ ${formatted} (app)` };
  }

  return { amountBRL: null, label: "não estimado" };
}
