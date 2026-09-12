// Gera a narrativa da rota em linguagem natural. Tenta a API da Anthropic; se não houver
// credencial configurada (ou a chamada falhar por qualquer motivo), cai num texto-modelo —
// o backend nunca deixa de responder a rota só porque a narrativa por IA falhou.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // lê ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN do ambiente
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

const SYSTEM_PROMPT = `Você é a voz do MOVA, um app de mobilidade do Vale do Sinos (RS, Brasil).
Escreva sempre em português do Brasil, tom caloroso e direto — como alguém do bairro dando
uma dica pra um amigo, nunca formal ou robótico.

Sua resposta é o texto principal que a pessoa vai ler antes de sair de casa. Estruture em até
4 parágrafos curtos (sem títulos, sem markdown), separados por uma linha em branco:

1. Resumo direto: distância, tempo estimado e custo estimado da viagem.
2. Como o perfil e as restrições informadas (campos "modal" e "observacoesDoPerfil") foram
   levados em conta NO CÁLCULO da rota (tempo, prioridade escolhida) — nunca faça promessas
   sobre as condições físicas do caminho, porque você não tem esse dado.
3. Só se "itinerarioDetalhado" for true: as principais indicações do caminho, em linguagem
   natural, baseadas na lista de "passos" — não precisa citar todos. Se "itinerarioDetalhado"
   for false, não invente trajeto nenhum: diga com uma frase curta que é uma estimativa de
   tempo e valor, sem itinerário detalhado (isso é normal pra ônibus, por exemplo, onde não
   temos a linha exata).
4. Só se o campo "suggestion" existir: uma menção natural e opcional a esse comércio, nunca
   como propaganda forçada, sem emoji, sem "aproveite!" ou chamada pra ação. Se "suggestion"
   for null, não mencione nenhum comércio e pule esse parágrafo.

Regras, sem exceção — a mais importante é a primeira:
1. Você NUNCA tem dado real de acessibilidade física da via (rampa, escada, piso, buraco,
   degrau). Por isso é tão proibido INVENTAR um obstáculo quanto AFIRMAR que o caminho não
   tem obstáculos, é "acessível", "seguro" ou "tranquilo" fisicamente — as duas coisas são
   invenção. O máximo que você pode dizer é que a prioridade/perfil da pessoa entrou no
   cálculo da rota (tempo, distância, modal escolhido), nunca uma garantia sobre o terreno.
2. Baseie-se só nos fatos do JSON. Nunca invente passo, rua ou instrução de trajeto que não
   esteja na lista "passos" — se ela estiver vazia, diga isso, não preencha o vazio.
3. Nunca use markdown, listas com marcadores, emojis ou aspas.
4. Parágrafos curtos, linguagem direta, sem enrolação.`;

function formatDistance(meters) {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

const MODAL_LABEL = {
  "a-pe": "a pé",
  "cadeira-de-rodas": "de cadeira de rodas",
  "com-apoio": "com apoio/muletas",
  "carrinho-bebe": "com carrinho de bebê",
  bicicleta: "de bicicleta",
  carro: "de carro",
  onibus: "de ônibus",
};

function buildFallbackNarrative({ destination, distanceMeters, durationSeconds, modal, notes, cost, steps, suggestion }) {
  const place = destination.label.split(",")[0];
  const modalLabel = MODAL_LABEL[modal] || modal;
  const hasMobilityProfile = modal === "cadeira-de-rodas" || modal === "com-apoio";
  const hasSteps = Boolean(steps?.length);

  const paragraphs = [];

  paragraphs.push(
    `São ${formatDistance(distanceMeters)} até ${place} ${modalLabel}, cerca de ${formatDuration(durationSeconds)}. ` +
      `Custo estimado: ${cost?.label || "não estimado"}.`,
  );

  if (hasMobilityProfile || notes) {
    let p = hasMobilityProfile
      ? "Seu perfil de mobilidade entrou no cálculo do tempo e da rota."
      : "O que você informou entrou no cálculo da rota.";
    if (notes) p += ` Anotado: ${notes}.`;
    paragraphs.push(p);
  }

  if (hasSteps) {
    const named = steps.map((s) => s.instruction).filter(Boolean).slice(0, 4);
    if (named.length) paragraphs.push(`No caminho: ${named.join("; depois, ")}.`);
  } else {
    paragraphs.push("Essa é uma estimativa de tempo e valor — ainda não temos o itinerário detalhado desse trajeto.");
  }

  if (suggestion) {
    paragraphs.push(`No caminho, passa perto de ${suggestion.name} — ${suggestion.blurb}.`);
  }

  return paragraphs.join("\n\n");
}

function buildUserMessage(input) {
  const { origin, destination, distanceMeters, durationSeconds, steps, modal, priority, urgencyMinutes, notes, cost, suggestion } = input;
  const stepList = (steps || []).filter((s) => s?.instruction);
  return JSON.stringify(
    {
      origem: origin.label,
      destino: destination.label,
      distanciaMetros: distanceMeters,
      duracaoSegundos: durationSeconds,
      custoEstimado: cost ? cost.label : "não estimado",
      itinerarioDetalhado: stepList.length > 0,
      passos: stepList.slice(0, 8).map((s) => s.instruction),
      modal,
      prioridade: priority,
      prazoMinutos: urgencyMinutes ?? null,
      observacoesDoPerfil: notes ?? null,
      suggestion: suggestion ? { nome: suggestion.name, dica: suggestion.blurb } : null,
    },
    null,
    2,
  );
}

export async function generateNarrative(input) {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      output_config: { effort: "medium" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(input) }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock?.text?.trim()) {
      throw new Error("Resposta da IA veio sem texto.");
    }
    return { narrative: textBlock.text.trim(), source: "ai", model: MODEL };
  } catch (err) {
    console.warn("[narrative] IA indisponível, usando texto-modelo:", err.message);
    return { narrative: buildFallbackNarrative(input), source: "fallback" };
  }
}
