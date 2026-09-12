import "dotenv/config";
import express from "express";
import cors from "cors";

import { geocode, GeocodeError } from "./src/geocode.js";
import { getRoute, RoutingError, modalToProfile } from "./src/routing.js";
import { pickSuggestion } from "./src/suggestions.js";
import { generateNarrative } from "./src/narrative.js";
import { estimateCost } from "./src/pricing.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "mova-backend" });
});

// Os três modais que o OSRM público sabe calcular de verdade. Todo modal a pé (inclusive
// os de mobilidade reduzida) mapeia pro perfil "a-pe" — ver modalToProfile em routing.js.
const ROUTABLE_MODALS = ["a-pe", "bicicleta", "carro"];

// Ônibus segue as mesmas ruas do carro, só que mais devagar (paradas, embarque) — por isso
// reaproveitamos a rota de carro já calculada em vez de fazer outra chamada ao OSRM.
const BUS_DURATION_MULTIPLIER = 1.5;

function buildBusAlternative(carRoute) {
  if (!carRoute) return { modal: "onibus", available: false, reason: "Rota de carro indisponível pra estimar o ônibus." };
  const durationSeconds = Math.round(carRoute.distanceMeters ? carRoute.durationSeconds * BUS_DURATION_MULTIPLIER : 0);
  return {
    modal: "onibus",
    available: true,
    profile: "bus-estimate",
    distanceMeters: carRoute.distanceMeters,
    durationSeconds,
    cost: estimateCost("onibus", carRoute.distanceMeters, durationSeconds),
    geometry: carRoute.geometry, // aproximação: segue as mesmas ruas do carro, sem itinerário de linha real
    note: "estimativa a partir das ruas — sem itinerário de linha real",
  };
}

// Não existe fonte pública gratuita de estações/horários do Trensurb integrada aqui, então
// é mais honesto marcar como indisponível do que desenhar uma rota de trilho inventada.
function buildTrainAlternative() {
  return {
    modal: "trem",
    available: false,
    reason: "Ainda sem dados de estações do Trensurb — não dá pra calcular essa rota.",
  };
}

app.post("/api/route", async (req, res) => {
  const { from, to, modal = "a-pe", priority = "acessivel", urgencyMinutes, notes } = req.body || {};

  if (!from || !to) {
    return res.status(400).json({ error: "Informe \"from\" e \"to\"." });
  }

  try {
    const [origin, destination] = await Promise.all([geocode(from), geocode(to)]);

    const settled = await Promise.allSettled(
      ROUTABLE_MODALS.map((baseModal) => getRoute({ origin, destination, modal: baseModal })),
    );

    const routableAlternatives = ROUTABLE_MODALS.map((baseModal, i) => {
      const result = settled[i];
      if (result.status !== "fulfilled") {
        return { modal: baseModal, available: false };
      }
      const route = result.value;
      return {
        modal: baseModal,
        available: true,
        profile: route.profile,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        cost: estimateCost(baseModal, route.distanceMeters, route.durationSeconds),
        geometry: route.geometry,
      };
    });

    const carResult = settled[ROUTABLE_MODALS.indexOf("carro")];
    const carRoute = carResult?.status === "fulfilled" ? carResult.value : null;

    const alternatives = [...routableAlternatives, buildBusAlternative(carRoute), buildTrainAlternative()];

    let primary;
    if (modal === "onibus") {
      const busAlt = alternatives.find((a) => a.modal === "onibus");
      if (!busAlt.available) throw new RoutingError(busAlt.reason);
      primary = { ...busAlt, steps: [] }; // sem itinerário de linha, então sem passo a passo
    } else if (modal === "trem") {
      const trainAlt = alternatives.find((a) => a.modal === "trem");
      throw new RoutingError(trainAlt.reason);
    } else {
      const requestedProfile = modalToProfile(modal);
      const primaryIndex = ROUTABLE_MODALS.findIndex((m) => modalToProfile(m) === requestedProfile);
      const primaryResult = settled[primaryIndex];
      if (!primaryResult || primaryResult.status !== "fulfilled") {
        throw new RoutingError("Não consegui calcular essa rota em nenhum modal.");
      }
      const route = primaryResult.value;
      primary = {
        ...routableAlternatives[primaryIndex],
        steps: route.steps,
      };
    }

    const { suggestion } = pickSuggestion({
      geometry: primary.geometry,
      priority,
      urgencyMinutes,
    });

    const { narrative, source: narrativeSource } = await generateNarrative({
      origin,
      destination,
      distanceMeters: primary.distanceMeters,
      durationSeconds: primary.durationSeconds,
      steps: primary.steps,
      modal,
      priority,
      urgencyMinutes,
      notes,
      cost: primary.cost,
      suggestion,
    });

    res.json({
      origin,
      destination,
      modal,
      priority,
      profile: primary.profile,
      distanceMeters: primary.distanceMeters,
      durationSeconds: primary.durationSeconds,
      cost: primary.cost,
      geometry: primary.geometry,
      steps: primary.steps,
      narrative,
      narrativeSource,
      suggestion,
      // Tempo e preço (ou o motivo de não dar) de cada modal, pro front-end comparar.
      alternatives: alternatives.map(({ geometry, ...rest }) => rest),
    });
  } catch (err) {
    if (err instanceof GeocodeError) {
      return res.status(422).json({ error: err.message, field: "endereco" });
    }
    if (err instanceof RoutingError) {
      return res.status(422).json({ error: err.message, field: "rota" });
    }
    console.error("[POST /api/route]", err);
    res.status(500).json({ error: "Erro interno ao calcular a rota." });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`MOVA backend rodando em http://localhost:${port}`);
});
