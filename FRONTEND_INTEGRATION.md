# Integração do Frontend no MatControl

Este backend está pronto para receber e servir o build do frontend (SPA) em produção, com CORS configurável e fallback apropriado.

## Configuração
- `.env` (exemplos):
  - `NODE_ENV=production`
  - `SERVE_FRONTEND=true` — habilita o servidor estático do frontend
  - `FRONTEND_BUILD_DIR=../public` — diretório do build (relativo a `src/app.js`)
  - `CORS_ORIGINS=https://app.seudominio.com,https://admin.seudominio.com` — origens permitidas em produção
  - `APP_FRONTEND_ORIGIN=https://app.seudominio.com` — alternativa simples (usa um único origin)

Observação: Em desenvolvimento (`NODE_ENV=development`), o CORS é aberto para facilitar testes.

## Como servir o build
1. Gere o build do seu frontend (ex.: React/Vite): `npm run build` no projeto frontend.
2. Copie os arquivos gerados (ex.: `dist/`) para o diretório configurado:
   - Padrão: `public/` na raiz do repositório.
   - Ou configure `FRONTEND_BUILD_DIR` para apontar para seu `dist`.
3. Execute o servidor em produção:
   - `NODE_ENV=production SERVE_FRONTEND=true npm start`

## SPA fallback
- Qualquer rota que não comece com `/api` será respondida por `index.html` do build, permitindo rotas de SPA funcionarem (React Router, etc.).

## CORS
- Em produção, quando `CORS_ORIGINS` (ou `APP_FRONTEND_ORIGIN`) estiver definido, somente essas origens serão aceitas.
- Em desenvolvimento, qualquer origem é aceita para facilitar.

## Healthcheck
- `GET /api/healthz` retorna `{ ok: true, env: <NODE_ENV> }`.

## Dica de estrutura de frontend
- Recomendo organizar o frontend em um diretório próprio (ex.: `frontend/`) e apontar `FRONTEND_BUILD_DIR` para `../frontend/dist` após o build.