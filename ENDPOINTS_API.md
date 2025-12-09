# Documentação de Endpoints e CRUD (MatControl API)

- Base URL (dev): `http://localhost:5000`
- Autorização: enviar `Authorization: Bearer <token>` em rotas protegidas
- Content-Type: `application/json` para requisições com corpo

## Autenticação (`/api/auth`)
- `POST /registrar-gestor` — cria usuário gestor e perfil vinculado `src/routes/authRoutes.js:14`
- `POST /registrar-professor` — requer `codigoAcademia` `src/routes/authRoutes.js:15`
- `POST /registrar-aluno` — requer `codigoAcademia` e respeita o limite do plano `src/routes/authRoutes.js:16`
- `POST /registrar-responsavel` — cria usuário responsável e perfil `src/routes/authRoutes.js:17`
- `POST /login` — autentica e retorna JWT `src/routes/authRoutes.js:18`
- `GET /me` — retorna dados do usuário autenticado `src/routes/authRoutes.js:21`

CRUD (Autenticação): criação de usuários via `POST`, leitura do usuário via `GET /me`.

## Perfis (`/api/perfis`)
- `POST /criar` — cria perfil vinculado ao usuário autenticado `src/routes/profiles.js:23`
- `POST /:criadorPerfilId/criar` — cria informando explicitamente o perfil criador `src/routes/profiles.js:26`
- `GET /user/:userId` — lista perfis de um usuário `src/routes/profiles.js:29`
- `GET /user` — lista perfis do usuário atual `src/routes/profiles.js:31`
- `POST /inicializar-principal` — inicializa perfil principal (aluno/professor) `src/routes/profiles.js:37`
- `PATCH /:id` — atualiza um perfil `src/routes/profiles.js:52`
- `DELETE /:id` — remove um perfil `src/routes/profiles.js:57`
- `GET /:id/historico` — lista histórico de progressão `src/routes/profiles.js:60`
- `POST /:id/historico` — adiciona entrada ao histórico `src/routes/profiles.js:63`
- `POST /:id/isentar-vitalicio` — marca isenção vitalícia e pausa cobrança `src/routes/profiles.js:54`
- Azure Face:
  - `POST /azure/sincronizar-alunos` `src/routes/profiles.js:65`
  - `POST /azure/treinar` `src/routes/profiles.js:66`
  - `GET /azure/status-treinamento` `src/routes/profiles.js:67`

CRUD (Perfis):
- Criar: `POST /criar` (ou `/:criadorPerfilId/criar`)
- Ler: `GET /user` ou `GET /user/:userId`, `GET /:id/historico`
- Atualizar: `PATCH /:id`
- Excluir: `DELETE /:id`

Exemplo:
```
# Criar perfil aluno
curl -X POST "http://localhost:5000/api/perfis/criar" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{
    "tipo": "aluno",
    "nome": "Aluno Teste",
    "academiaId": "<academiaId>",
    "modalidadeId": "<modalidadeId>",
    "faixaId": "<nivelId>",
    "sexo": "masculino",
    "peso": 75
  }'
```

## Dependentes (`/api/dependentes`)
- `POST /` — cria um dependente (responsável autenticado) `src/routes/dependentes.js:17`
- `GET /` — lista dependentes do responsável `src/routes/dependentes.js:18`
- `GET /:dependenteId` — obtém detalhes `src/routes/dependentes.js:19`
- `PUT /:dependenteId` — atualiza dependente `src/routes/dependentes.js:20`
- `DELETE /:dependenteId` — exclui dependente `src/routes/dependentes.js:21`

CRUD (Dependentes): `POST`, `GET`, `PUT`, `DELETE`.

Exemplo:
```
curl -X POST "http://localhost:5000/api/dependentes" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{ "nome": "Filho", "nascimento": "2016-08-12", "modalidadeId": "<id>" }'
```

## Academias (`/api/academias`)
- `POST /registrar` — cadastra academia (gestor autenticado) `src/routes/academias.js:10`
- `GET /codigo/:codigo` — busca academia por código `src/routes/academias.js:14`
- `GET /` — lista academias (aberto) `src/routes/academias.js:18`
- `GET /gestor/referral-link` — link de indicação do gestor `src/routes/academias.js:20`
- `PATCH /planos/:academiaId` — atualiza plano da academia `src/routes/academias.js:23`

CRUD (Academias): criação (`POST /registrar`), leitura (`GET /`, `GET /codigo/:codigo`), atualização (`PATCH /planos/:academiaId`).

## Turmas (`/api/turmas`)
- `POST /` — cria turma (gestor) `src/routes/turmas.js:8`
- `POST /entrar` — aluno entra via código/link `src/routes/turmas.js:12`

CRUD (Turmas): criação (`POST /`); participação de alunos via `POST /entrar`.

## Aulas (`/api/aulas`)
- `POST /turmas/:turmaId/gerar-semana` — gera aulas da semana para a turma `src/routes/aulas.js:18`
- `GET /turmas/:turmaId/semana` — lista aulas da semana da turma `src/routes/aulas.js:21`
- `GET /minhas/semana` — lista aulas da semana do usuário `src/routes/aulas.js:24`
- `PATCH /:aulaId` — editar/cancelar aula `src/routes/aulas.js:27`
- `POST /:aulaId/confirmar` — aluno confirma presença `src/routes/aulas.js:30`
- `DELETE /:aulaId/confirmar` — remove confirmação `src/routes/aulas.js:31`
- `POST /:aulaId/chamada-automatica` — chamada por reconhecimento facial `src/routes/aulas.js:34`
- `POST /academias/:academiaId/gerar-semana` — gera aulas da semana por academia (gestor) `src/routes/aulas.js:37`
- `GET /academias/:academiaId/semana` — lista aulas da semana por academia (gestor) `src/routes/aulas.js:40`

CRUD (Aulas): atualizar com `PATCH /:aulaId`; operações adicionais de geração/listagem/confirmar.

## Níveis (`/api/niveis`)
- `GET /:modalidadeId` — lista níveis da modalidade `src/routes/niveis.js:8`
- `PATCH /:id` — atualiza nível (gestor) `src/routes/niveis.js:11`

CRUD (Níveis): leitura e atualização.

## Modalidades (`/api/modalidades`)
- `GET /base` — lista modalidades disponíveis `src/routes/modalidades.js:12`
- `POST /ativar` — ativa modalidades na academia do gestor `src/routes/modalidades.js:13`
- `GET /minhas` — lista modalidades ativas da minha academia `src/routes/modalidades.js:16`
- `DELETE /minhas/:modalidadeId` — remove modalidade ativa da academia (gestor) `src/routes/modalidades.js:19`

CRUD (Modalidades na academia): ativar (`POST`), listar (`GET`), remover (`DELETE`).

## Planos de Academia (`/api/planos`)
- `POST /` — cria plano `src/routes/planos.js:13`
- `GET /academia/:academiaId` — lista planos da academia `src/routes/planos.js:14`
- `PATCH /:id` — atualiza plano `src/routes/planos.js:15`
- `DELETE /:id` — exclui plano `src/routes/planos.js:16`

CRUD (Planos): `POST`, `GET`, `PATCH`, `DELETE`.

Exemplo:
```
curl -X POST "http://localhost:5000/api/planos" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{
    "nome": "Mensal BJJ",
    "descricao": "Plano padrão",
    "valor": 150,
    "modalidadesDisponiveis": ["<modalidadeId>"],
    "academiaId": "<academiaId>"
  }'
```

## Pagamentos (`/api/pagamentos`) — Mercado Pago
- `POST /gestor/checkout` — cria assinatura Preapproval da plataforma (opcional `tier`) `src/routes/pagamentos.js:10`
- `POST /aluno/checkout` — cria assinatura Preapproval do plano da academia `src/routes/pagamentos.js:14`
- `POST /aluno/assinatura` — assinatura com cupom/trial (ajusta valor/período grátis) `src/routes/pagamentos.js:18`
- `PATCH /academias/:academiaId/stripe` — configurar `mercadoPagoAccessToken` da academia `src/routes/pagamentos.js:22`
- `POST /academias/:id/stripe/connect` — instruções para obter token via OAuth `src/routes/pagamentos.js:26`
- `POST /criar` — cria Preference para pagamento único com `external_reference` `src/routes/pagamentos.js:30`
- `GET /academias/:academiaId` — listar pagamentos da academia (gestor) `src/routes/pagamentos.js:33`
- `GET /alunos/:alunoId` — listar pagamentos do aluno `src/routes/pagamentos.js:36`
- `POST /academias/:academiaId/isentar` — isentar mensalidade do aluno (gestor) `src/routes/pagamentos.js:40`
- `GET /plataforma/precos` — listar preços por tier `src/routes/pagamentos.js:42`
- Webhook Mercado Pago:
  - `POST /api/pagamentos/mercadopago/webhook` `src/app.js:29`

## Saúde
- `GET /api/healthz` — verificação de saúde da aplicação `src/app.js:59`

## Forma de Fazer CRUD
- Criar: `POST` no recurso (ex.: `POST /api/planos`)
- Ler: `GET` do recurso (lista ou item — ex.: `GET /api/planos/academia/:academiaId`)
- Atualizar: `PATCH` para atualização parcial; `PUT` quando definido (ex.: dependentes)
- Excluir: `DELETE` usando o identificador do recurso
- Permissões: variam por recurso e tipo de usuário; seguir regras nos controladores e middlewares