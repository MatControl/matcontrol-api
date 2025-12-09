## Visão Geral
Criaremos um fluxo de testes para o gestor com páginas distintas, design moderno e navegação orientada, simulando uma aplicação real. Cada etapa terá validação, feedback visual (toasts/alerts), e persistência de estado (token e academiaId) via localStorage.

## Páginas e Rotas
1. Cadastro: `/test/gestor/cadastro`
2. Login: `/test/gestor/login`
3. Academia: `/test/gestor/academia`
4. Modalidades: `/test/gestor/modalidades`
5. Planos: `/test/gestor/planos`
6. Professor: `/test/gestor/professor`
7. Checkout: `/test/gestor/checkout`

Cada página terá seu HTML e utilizará um JS compartilhado para chamadas à API. Vamos adicionar rotas no `app.js` para servir cada arquivo estático.

## Design/UX
- Layout responsivo em cards, com cabeçalho persistente e barra de progresso (7 etapas).
- Paleta neutra (cinza/azul), tipografia legível, espaçamento confortável.
- Componentes:
  - Header com título “Fluxo Gestor”, indicador de etapa e botões “Voltar/Avançar”.
  - Formulários com labels flutuantes, mensagens de validação inline.
  - Toasters para sucesso/erro e área de log minimizada.
  - Botões primários/secundários consistentes e desabilitados durante requisições.

## Comportamento e Navegação
- Guardas de rota:
  - Sem token → redireciona para `/test/gestor/login`.
  - Sem cadastro concluído → volta para `/test/gestor/cadastro`.
- Persistência:
  - `localStorage.token` após login.
  - `localStorage.academiaId` ao criar/obter academia.
- Flow:
  - Cadastro → Login (auto-preencher email/senha).
  - Login → Academia (criar/obter e salvar id).
  - Academia → Modalidades (listar base e ativar IDs).
  - Modalidades → Planos (criar e listar meus planos).
  - Planos → Professor (opcional criar perfil).
  - Professor → Checkout (tier e link).

## Integração com API (existentes)
- Cadastro: `POST /api/gestor/cadastro`
- Login: `POST /api/gestor/login`
- Academia: `POST /api/gestor/academia`, `GET /api/gestor/academia`
- Modalidades: `GET /api/gestor/modalidades/base`, `POST /api/gestor/modalidades/ativar`
- Planos: `POST /api/gestor/planos`, `GET /api/gestor/planos`
- Professor: `POST /api/gestor/professor`
- Checkout: `POST /api/gestor/checkout`

## Segurança e Validações
- Headers com `Authorization: Bearer <token>` via util compartilhado.
- Sanitização básica de campos (trim, número válido).
- Bloqueio de botões durante requisição; mensagens de erro claras.
- Redirecionamentos automáticos caso pré-requisitos não atendidos (ex.: sem academiaId ao ativar modalidades).

## Implementação Técnica
- Arquivos:
  - `public/test/gestor/assets/styles.css` (tema, cards, barra de progresso, toasts)
  - `public/test/gestor/assets/api.js` (request wrapper, authHeader, guards, storage)
  - `public/test/gestor/layout.html` (header + progress; páginas importam como base via include simples ou repetem header)
  - Páginas HTML: `cadastro.html`, `login.html`, `academia.html`, `modalidades.html`, `planos.html`, `professor.html`, `checkout.html`
- Servir páginas: adicionar `app.get('/test/gestor/<etapa>')` para cada etapa.
- Comportamento:
  - Cada página importa `api.js` e `styles.css`.
  - Submete formulários via `fetch`, exibe toasts e navega para próxima etapa.

## Verificação
- Smoke manual: percorrer todas as etapas e confirmar:
  - Cadastro/login geram token.
  - Academia retorna id.
  - Modalidades base listadas; ativação bem-sucedida.
  - Plano criado e listado.
  - Perfil professor criado (ou detectado existente).
  - Checkout retorna `preapprovalId` e `url`.
- Lint: `npm run lint` sem erros.

## Entregáveis
- Conjunto de páginas em `/test/gestor/*` com estilo e fluxo completo.
- Rotas adicionadas em `app.js` para servir cada etapa.
- Util e CSS compartilhados para consistência e manutenção.

Confirma essa abordagem para eu implementar as páginas e rotas? 