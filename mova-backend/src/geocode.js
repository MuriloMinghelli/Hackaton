// Geocodificação de endereços em texto -> coordenadas, usando o Nominatim (OpenStreetMap).
// Gratuito, sem chave de API. Política de uso do Nominatim exige um User-Agent identificável
// e no máximo ~1 requisição por segundo — nada disso é um problema pro volume de um protótipo.

// Caixa aproximada do Vale do Sinos (Novo Hamburgo, São Leopoldo, Sapiranga, Campo Bom,
// Estância Velha, Ivoti...), usada só para favorecer resultados da região, não para
// excluir endereços fora dela.
const VALE_DO_SINOS_VIEWBOX = "-51.28,-29.55,-50.90,-29.75";

export class GeocodeError extends Error {
  constructor(message, query) {
    super(message);
    this.name = "GeocodeError";
    this.query = query;
  }
}

export async function geocode(query) {
  const trimmed = (query || "").trim();
  if (!trimmed) {
    throw new GeocodeError("Endereço vazio.", query);
  }

  const params = new URLSearchParams({
    q: trimmed,
    format: "jsonv2",
    limit: "1",
    viewbox: VALE_DO_SINOS_VIEWBOX,
    bounded: "0",
    "accept-language": "pt-BR",
  });

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      // Nominatim pede um User-Agent que identifique a aplicação, não o navegador.
      "User-Agent": "mova-hackathon-prototype/0.1 (contato: defina-um-email-no-cabecalho)",
    },
  });

  if (!res.ok) {
    throw new GeocodeError(`Nominatim respondeu ${res.status}`, trimmed);
  }

  const results = await res.json();
  if (!results.length) {
    throw new GeocodeError(`Não encontrei "${trimmed}" no Vale do Sinos.`, trimmed);
  }

  const [top] = results;
  return {
    label: top.display_name,
    lat: parseFloat(top.lat),
    lon: parseFloat(top.lon),
  };
}
