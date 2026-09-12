// Motor de sugestões nativas: só sugere um parceiro se ele está literalmente no caminho
// e se o contexto (pressa) permite. Essa decisão é sempre determinística — nunca deixamos
// o LLM decidir se mostra ou não um anúncio, só como escrever a frase quando ele é mostrado.
import { PARTNERS } from "./partners.js";

const MAX_DISTANCE_FROM_ROUTE_METERS = 250;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Distância aproximada (metros) entre dois pontos lat/lon — Haversine.
function haversineMeters(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Distância mínima (aproximada) de um ponto até uma polilinha [[lon,lat], ...],
// checando a distância até cada vértice — suficiente pra segmentos curtos de rua.
function distanceToRouteMeters(point, coordinates) {
  let min = Infinity;
  for (const [lon, lat] of coordinates) {
    const d = haversineMeters(point, { lat, lon });
    if (d < min) min = d;
  }
  return min;
}

export function pickSuggestion({ geometry, priority, urgencyMinutes }) {
  const inAHurry = priority === "rapido" || (urgencyMinutes != null && urgencyMinutes <= 20);
  if (inAHurry) {
    return { suggestion: null, suppressedByUrgency: true };
  }

  const coordinates = geometry?.coordinates || [];
  if (!coordinates.length) {
    return { suggestion: null, suppressedByUrgency: false };
  }

  let nearest = null;
  let nearestDistance = Infinity;
  for (const partner of PARTNERS) {
    const d = distanceToRouteMeters(partner, coordinates);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearest = partner;
    }
  }

  if (!nearest || nearestDistance > MAX_DISTANCE_FROM_ROUTE_METERS) {
    return { suggestion: null, suppressedByUrgency: false };
  }

  return {
    suggestion: { ...nearest, distanceMeters: Math.round(nearestDistance) },
    suppressedByUrgency: false,
  };
}
