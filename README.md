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

Publicado nas duas pontas, já que GitHub Pages só serve arquivos estáticos e o backend
precisa de um servidor Node de verdade:

- **Front-end**: GitHub Pages, servindo `index.html` na raiz do repositório.
- **Backend**: Railway, rodando `mova-backend` (Root Directory configurado pra essa pasta),
  público em `https://hackaton-production-e0e5.up.railway.app`.

`API_URL` em `viagem.html` e `pcd.html` já aponta pra essa URL do Railway — se o backend for
recriado ou mudar de endereço, é só editar essa constante nos dois arquivos, commitar e dar
push que o GitHub Pages atualiza sozinho.

## Rodando local

```bash
cd mova-backend
npm install
cp .env.example .env   # opcional: cole sua ANTHROPIC_API_KEY
npm start
```

Depois é só abrir `index.html` no navegador (o `API_URL` já aponta pro `localhost:3001`).
