// Cálculo de rota real usando OSRM (Open Source Routing Machine) sobre dados do
// OpenStreetMap. Usa as instâncias públicas mantidas pela FOSSGIS e.V. em
// routing.openstreetmap.de — gratuitas, sem chave de API, mas é um serviço de
// demonstração: sem SLA, então trate falhas como possíveis.
//
// Só existem perfis de carro, bicicleta e a pé — não há perfil de "cadeira de rodas"
// nem de transporte público públicos e gratuitos, então qualquer perfil que ande a pé
// (inclusive com restrição de mobilidade) usa o perfil "foot" como aproximação.

const OSRM_PROFILE_BY_MODAL = {
  "a-pe": "foot",
  "cadeira-de-rodas": "foot",
  "com-apoio": "foot",
  "carrinho-bebe": "foot",
  bicicleta: "bike",
  carro: "car",
};

export class RoutingError extends Error {
  constructor(message) {
    super(message);
    this.name = "RoutingError";
  }
}

const MANEUVER_PT = {
  depart: "Siga",
  arrive: "Chegada",
  turn: "Vire",
  "new name": "Continue",
  continue: "Continue",
  merge: "Siga",
  roundabout: "Entre na rotatória",
  fork: "Mantenha-se",
};

const MODIFIER_PT = {
  left: "à esquerda",
  right: "à direita",
  "slight left": "levemente à esquerda",
  "slight right": "levemente à direita",
  "sharp left": "com força à esquerda",
  "sharp right": "com força à direita",
  straight: "em frente",
  uturn: "e retorne",
};

function describeStep(step) {
  const base = MANEUVER_PT[step.maneuver.type] || "Siga";
  const mod = step.maneuver.modifier ? ` ${MODIFIER_PT[step.maneuver.modifier] || ""}` : "";
  const street = step.name ? ` por ${step.name}` : "";
  return `${base}${mod}${street}`.replace(/\s+/g, " ").trim();
}

export function modalToProfile(modal) {
  return OSRM_PROFILE_BY_MODAL[modal] || "foot";
}

export async function getRoute({ origin, destination, modal }) {
  const profile = modalToProfile(modal);
  const coords = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
  const params = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    steps: "true",
    annotations: "false",
  });

  const url = `https://routing.openstreetmap.de/routed-${profile}/route/v1/${profile}/${coords}?${params}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new RoutingError(`OSRM (perfil "${profile}") respondeu ${res.status}`);
  }

  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new RoutingError(data.message || "Nenhuma rota encontrada entre os pontos.");
  }

  const route = data.routes[0];
  const steps = (route.legs?.[0]?.steps || []).map((step) => ({
    instruction: describeStep(step),
    distanceMeters: Math.round(step.distance),
  }));

  return {
    profile,
    distanceMeters: Math.round(route.distance),
    durationSeconds: Math.round(route.duration),
    geometry: route.geometry, // GeoJSON LineString — pronto pra desenhar num mapa real
    steps,
  };
}
