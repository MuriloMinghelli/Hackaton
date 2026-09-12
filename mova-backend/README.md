# MOVA — backend

API que recebe partida, destino e perfil de mobilidade, calcula uma rota real (OpenStreetMap
+ OSRM) e devolve tanto os dados da rota quanto uma narrativa em linguagem natural gerada
pela API da Anthropic.

## Rodando local

```bash
npm install
cp .env.example .env
# edite o .env e cole sua ANTHROPIC_API_KEY
npm start
```

Sobe em `http://localhost:3001`. Sem `ANTHROPIC_API_KEY` configurada, o servidor funciona
normalmente — a narrativa só cai para um texto-modelo em vez de vir da IA.

## Endpoint

### `POST /api/route`

```json
{
  "from": "Centro, Novo Hamburgo",
  "to": "Unisinos, São Leopoldo",
  "modal": "cadeira-de-rodas",
  "priority": "acessivel",
  "urgencyMinutes": 22,
  "notes": "usa prótese"
}
```

- `modal`: `a-pe` | `cadeira-de-rodas` | `com-apoio` | `carrinho-bebe` | `bicicleta` | `carro`
- `priority`: `rapido` | `barato` | `acessivel`
- `urgencyMinutes` e `notes` são opcionais

Resposta (200):

```json
{
  "origin": { "label": "...", "lat": -29.67, "lon": -51.13 },
  "destination": { "label": "...", "lat": -29.79, "lon": -51.14 },
  "profile": "foot",
  "distanceMeters": 8200,
  "durationSeconds": 1980,
  "geometry": { "type": "LineString", "coordinates": [[lon, lat], ...] },
  "steps": [{ "instruction": "Siga por Rua Marechal Deodoro", "distanceMeters": 120 }],
  "narrative": "São 8.2 km até Unisinos, cerca de 33 min...",
  "narrativeSource": "ai",
  "suggestion": { "name": "Cafeteria Céu da Boca", "blurb": "...", "distanceMeters": 40 }
}
```

Erros de endereço não encontrado ou rota impossível voltam como `422`; qualquer outra falha,
como `500`.

### `GET /api/health`

Checagem simples — `{ "ok": true }`.

## Como cada peça funciona

- **`src/geocode.js`** — transforma texto em coordenadas via Nominatim (OpenStreetMap),
  gratuito, sem chave, favorecendo resultados no Vale do Sinos.
- **`src/routing.js`** — calcula a rota real via OSRM (instância pública da FOSSGIS e.V.).
  Só existem perfis de carro, bicicleta e a pé publicamente — perfis de mobilidade reduzida
  usam "a pé" como aproximação, já que não há um provedor público de rotas específicas para
  cadeira de rodas.
- **`src/suggestions.js`** — decide de forma determinística (nunca por IA) se um comércio
  parceiro aparece: só se estiver a até 250m da rota e só se a pessoa não estiver com pressa.
- **`src/narrative.js`** — chama a Anthropic para transformar os fatos da rota numa frase
  natural, com um texto-modelo como rede de segurança se a chamada falhar.

## Publicando (deploy)

Está publicado no Railway, com "Root Directory" = `mova-backend`, build `npm install` e
start `npm start`, público em:

```
https://hackaton-production-e0e5.up.railway.app
```

`API_URL` em `viagem.html` e `pcd.html` (raiz do repo) já aponta pra essa URL. Se recriar o
serviço em outro host, é só repetir os mesmos passos (Root Directory `mova-backend`, build
`npm install`, start `npm start`, variável `ANTHROPIC_API_KEY` opcional no painel do serviço
— nunca no código) e atualizar `API_URL` nos dois arquivos.
