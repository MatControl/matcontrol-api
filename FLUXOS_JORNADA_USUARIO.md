# Fluxos de Jornada do Usuário

## Visão Geral
- Perfis: gestor, professor, aluno, responsável e dependente.
- Rotas principais em `src/routes/*` e controladores em `src/controllers/*`.
- Pagamentos via Stripe (Checkout, Subscription, PaymentIntent) e Webhooks.
- Reconhecimento facial (Azure Face) para chamada automática.
- Schedulers: geração semanal de aulas e verificação diária de inatividade.

## Fluxo do Gestor
- Registrar gestor: `POST /api/auth/registrar-gestor` (`src/routes/authRoutes.js:14`).
- Login gestor: `POST /api/auth/login` (`src/routes/authRoutes.js:18`).
- Usuário logado: `GET /api/auth/me` (`src/routes/authRoutes.js:21`).
- Registrar academia: `POST /api/academias/registrar` (`src/routes/academias.js`), consumo citado em collections.
- Modalidades e níveis:
  - Base de modalidades: `GET /api/modalidades/base` (`src/routes/modalidades.js`).
  - Ativar modalidades na academia: `POST /api/modalidades/ativar` (`src/routes/modalidades.js`).
  - Listar níveis por modalidade: `GET /api/niveis/:modalidadeId` (`src/routes/niveis.js`).
- Planos da academia:
  - Criar plano: `POST /api/planos` (`src/routes/planos.js`).
  - Listar por academia: `GET /api/planos/academia/:academiaId` (`src/routes/planos.js`).
- Stripe Connect (academia):
  - Configurar `stripeAccountId`: `PATCH /api/pagamentos/academias/:academiaId/stripe` (`src/routes/pagamentos.js:10`).
  - Conectar (Express) e obter onboarding link: `POST /api/pagamentos/academias/:id/stripe/connect` (`src/routes/pagamentos.js:11`).
  - Criar onboarding link: `POST /api/pagamentos/academias/:academiaId/onboarding-link` (`src/controllers/paymentsController.js:184`).
- Fluxos de aulas da academia:
  - Gerar aulas da semana: `POST /api/aulas/academias/:academiaId/gerar-semana` (`src/routes/aulas.js:37`).
  - Listar aulas da semana: `GET /api/aulas/academias/:academiaId/semana` (`src/routes/aulas.js:40`).
- Criar professor/aluno (como criador): `POST /api/perfis/criar` (`src/routes/profiles.js:22`).
- Isentar mensalidade do aluno: `POST /api/pagamentos/academias/:academiaId/isentar` (`src/routes/pagamentos.js:15`, `src/controllers/paymentsController.js:427`).
- Isentar aluno vitalício: `POST /api/perfis/:id/isentar-vitalicio` (`src/routes/profiles.js:54`, `src/controllers/profileController.js:1085`).

## Fluxo do Professor
- Registrar professor: `POST /api/auth/registrar-professor` (`src/routes/authRoutes.js:15`).
- Login professor: `POST /api/auth/login` (`src/routes/authRoutes.js:18`).
- Usuário logado: `GET /api/auth/me` (`src/routes/authRoutes.js:21`).
- Aulas por turma:
  - Gerar semana: `POST /api/aulas/turmas/:turmaId/gerar-semana` (`src/routes/aulas.js:18`).
  - Listar semana: `GET /api/aulas/turmas/:turmaId/semana` (`src/routes/aulas.js:21`).
- Minhas aulas da semana: `GET /api/aulas/minhas/semana` (`src/routes/aulas.js:24`).
- Editar/cancelar aula: `PATCH /api/aulas/:aulaId` (`src/routes/aulas.js:27`, `src/controllers/aulaController.js:189`).
- Chamada automática por foto: `POST /api/aulas/:aulaId/chamada-automatica` (`src/routes/aulas.js:34`, `src/controllers/aulaController.js:457`).
- Criar aluno via perfil (como criador professor): `POST /api/perfis/criar` (`src/routes/profiles.js:22`).

## Fluxo do Aluno
- Registrar aluno: `POST /api/auth/registrar-aluno` (`src/routes/authRoutes.js:16`).
- Login aluno: `POST /api/auth/login` (`src/routes/authRoutes.js:18`).
- Usuário logado: `GET /api/auth/me` (`src/routes/authRoutes.js:21`).
- Entrar em turma por código: `POST /api/turmas/entrar` (via corpo com `codigoConvite`) (`src/routes/turmas.js`).
- Minhas aulas da semana: `GET /api/aulas/minhas/semana` (`src/routes/aulas.js:24`).
- Confirmar presença: `POST /api/aulas/:aulaId/confirmar` (`src/routes/aulas.js:30`, `src/controllers/aulaController.js:403`).
- Remover confirmação: `DELETE /api/aulas/:aulaId/confirmar` (`src/routes/aulas.js:31`).
- Pagamentos (Stripe):
  - Checkout de plano da academia: `POST /api/pagamentos/aluno/checkout` (`src/routes/pagamentos.js:8`, `src/controllers/paymentsController.js:66`).
  - Assinatura com cupom/trial: `POST /api/pagamentos/aluno/assinatura` (`src/routes/pagamentos.js:9`, `src/controllers/paymentsController.js:320`).
  - Persistência de assinatura (webhook): evento `checkout.session.completed` grava `stripeSubscriptionId` no usuário (`src/controllers/paymentsController.js:168`).
- Regras de status/cobrança:
  - Inatividade (>30 dias sem presença) marca aluno `inativo` e pausa cobrança (`src/utils/aulasScheduler.js:98`).
  - Reativação ao confirmar presença se não houver pendências (`Pagamento.status` em `pendente`/`falhou`): `src/controllers/aulaController.js:421`–`src/controllers/aulaController.js:437`.

## Fluxo do Responsável (Pai/Mãe)
- Registrar responsável: `POST /api/auth/registrar-responsavel` (`src/routes/authRoutes.js:17`).
- Login responsável: `POST /api/auth/login` (`src/routes/authRoutes.js:18`).
- Usuário logado: `GET /api/auth/me` (`src/routes/authRoutes.js:21`).
- Dependentes:
  - Criar dependente: `POST /api/dependentes` (`src/routes/dependentes.js:17`, `src/controllers/dependenteController.js`).
  - Listar dependentes: `GET /api/dependentes` (`src/routes/dependentes.js:18`).
  - Obter dependente: `GET /api/dependentes/:dependenteId` (`src/routes/dependentes.js:19`).
  - Atualizar dependente: `PUT /api/dependentes/:dependenteId` (`src/routes/dependentes.js:20`).
  - Excluir dependente: `DELETE /api/dependentes/:dependenteId` (`src/routes/dependentes.js:21`).

## Fluxos de Pagamento
- Gestor (plataforma): `POST /api/pagamentos/gestor/checkout` (`src/routes/pagamentos.js:7`, `src/controllers/paymentsController.js:17`).
- Aluno (plano da academia): `POST /api/pagamentos/aluno/checkout` (`src/routes/pagamentos.js:8`, `src/controllers/paymentsController.js:66`).
- Assinatura com cupom/trial: `POST /api/pagamentos/aluno/assinatura` (`src/routes/pagamentos.js:9`, `src/controllers/paymentsController.js:320`).
- Criar pagamento direto (PaymentIntent): `POST /api/pagamentos/criar` (`src/routes/pagamentos.js:12`, `src/controllers/paymentsController.js:261`).
- Consultar pagamentos:
  - Por academia: `GET /api/pagamentos/academias/:academiaId` (`src/routes/pagamentos.js:13`, `src/controllers/paymentsController.js:392`).
  - Por aluno: `GET /api/pagamentos/alunos/:alunoId` (`src/routes/pagamentos.js:14`, `src/controllers/paymentsController.js:406`).
- Isentar mensalidade (registro administrativo): `POST /api/pagamentos/academias/:academiaId/isentar` (`src/routes/pagamentos.js:15`, `src/controllers/paymentsController.js:427`).
- Isentar aluno vitalício (pausa cobrança): `POST /api/perfis/:id/isentar-vitalicio` (`src/routes/profiles.js:54`, `src/controllers/profileController.js:1085`).
- Webhooks Stripe:
  - Endpoint bruto: `POST /api/pagamentos/stripe/webhook` (`src/app.js:29`).
  - Eventos:
    - `payment_intent.succeeded` → marca `Pagamento.status = "pago"` (`src/controllers/paymentsController.js:159`).
    - `payment_intent.payment_failed` → marca `Pagamento.status = "falhou"` (`src/controllers/paymentsController.js:168`).
    - `checkout.session.completed` → grava `stripeSubscriptionId` no `User` (`src/controllers/paymentsController.js:168`).

## Aulas e Chamada
- Gerar semana por turma: `POST /api/aulas/turmas/:turmaId/gerar-semana` (`src/routes/aulas.js:18`).
- Listar semana por turma: `GET /api/aulas/turmas/:turmaId/semana` (`src/routes/aulas.js:21`).
- Minhas aulas da semana (professor/aluno): `GET /api/aulas/minhas/semana` (`src/routes/aulas.js:24`).
- Editar/cancelar aula: `PATCH /api/aulas/:aulaId` (`src/routes/aulas.js:27`).
- Confirmar presença (aluno): `POST /api/aulas/:aulaId/confirmar` (`src/routes/aulas.js:30`).
- Remover confirmação: `DELETE /api/aulas/:aulaId/confirmar` (`src/routes/aulas.js:31`).
- Chamada automática por foto: `POST /api/aulas/:aulaId/chamada-automatica` (`src/routes/aulas.js:34`, `src/controllers/aulaController.js:457`).

## Reconhecimento Facial (Azure)
- Sincronizar alunos no Person Group: `POST /api/perfis/azure/sincronizar-alunos` (`src/routes/profiles.js:62`, `src/controllers/profileController.js:967`).
- Treinar Person Group: `POST /api/perfis/azure/treinar` (`src/routes/profiles.js:63`, `src/controllers/profileController.js:1078`).
- Status de treinamento: `GET /api/perfis/azure/status-treinamento` (`src/routes/profiles.js:64`, `src/controllers/profileController.js:1101`).

## Schedulers
- Geração automática de aulas semanais: `startAulasWeeklyScheduler()` (`src/server.js:12`, `src/utils/aulasScheduler.js:86`).
- Verificação diária de inatividade e pausa de cobrança: `startDailyInatividadeScheduler()` (`src/server.js:12`, `src/utils/aulasScheduler.js:132`).

## Regras de Status e Cobrança
- `Profile.statusTreino`: `ativo | inativo | suspenso` (`src/models/Profile.js:137`).
- Campos de cobrança/presença: `isentoVitalicio`, `ultimaPresencaEm`, `cobrancaPausada`, `motivoCobrancaPausada`, `cobrancaPausadaEm` (`src/models/Profile.js:137`–`src/models/Profile.js:156`).
- Inatividade (>30 dias): marca `inativo`, pausa cobrança de assinatura Stripe ao fim do ciclo (`src/utils/aulasScheduler.js:98`).
- Reativação: presença registra `ultimaPresencaEm` e volta a `ativo` se não houver `Pagamento` pendente ou falho (`src/controllers/aulaController.js:421`–`src/controllers/aulaController.js:437`).

## Notas
- Endpoints de Webhook devem usar `express.raw` para validação de assinatura (`src/app.js:29`).
- `User.stripeSubscriptionId` é persistido para controle de pausa/cancelamento de assinatura (`src/models/User.js:11`, `src/controllers/paymentsController.js:168`).
