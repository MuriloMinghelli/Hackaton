# MOVA

Protótipo de mobilidade acessível pro Vale do Sinos (RS) — rota geral e rota pensada
especificamente pra pessoas PCD, com narrativa gerada por IA sempre honesta sobre o que
realmente se sabe (ou não) sobre o caminho.

## Estrutura

```
index.html          página inicial (logo animado + botão "Viajar")
viagem.html          planejador de rota geral
pcd.html              planejador de rota PCD
mova-backend/        API Node/Express (geocodificação, rota via OSRM, narrativa via Anthropic)
```

O front-end é HTML/CSS/JS puro, sem build — abre direto no navegador ou é servido como
site estático. O backend é uma API separada (veja `mova-backend/README.md`).

## Publicando o site

Publicar isso "de verdade" tem duas partes, porque GitHub Pages só serve arquivos estáticos
e o backend precisa rodar num servidor Node.

### 1. Front-end → GitHub Pages (grátis)

1. No GitHub, abra o repositório → **Settings → Pages**.
2. Em "Build and deployment", escolha **Deploy from a branch**.
3. Selecione a branch onde este código está (ex: `main`, depois de mesclar) e a pasta `/ (root)`.
4. Salve. Em alguns minutos o site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

O GitHub Pages serve `index.html` automaticamente na raiz — por isso a home foi renomeada
pra `index.html`.

### 2. Backend → um host de Node (Render, Railway, Fly.io...)

GitHub Pages não roda `server.js`. Siga o passo a passo em `mova-backend/README.md` (seção
"Publicando (deploy)") pra subir o backend separadamente e pegar uma URL pública.

### 3. Ligar as duas pontas

Depois que o backend estiver publicado, edite `API_URL` em `viagem.html` e `pcd.html` (raiz
do repo) trocando `http://localhost:3001/api/route` pela URL pública do backend, faça commit
e push de novo — o GitHub Pages atualiza sozinho.

Sem esse passo, o site abre e navega normalmente, mas "Traçar rota" mostra o erro de que não
conseguiu falar com o backend (esperado, já que `localhost:3001` só existe na sua máquina).

## Rodando local

```bash
cd mova-backend
npm install
cp .env.example .env   # opcional: cole sua ANTHROPIC_API_KEY
npm start
```

Depois é só abrir `index.html` no navegador (o `API_URL` já aponta pro `localhost:3001`).
