# MatControl - App

Aplicação Node.js/Express para gestão de academias, perfis (aluno, professor, gestor, responsável e dependente), turmas e aulas, com integração ao Azure Face API para chamada automática por reconhecimento facial.

## Visão Geral
- Backend em `Node.js` (ES Modules) com `Express` e `Mongoose`.
- Autenticação via `JWT` e controle de permissão por tipo de usuário.
- Upload e armazenamento de fotos de perfil (URL externa ou base64 gravada localmente) servidas em `'/profile-photos'`.
- Integração com Azure Face API: criação de `Person` por aluno, adição de face e treinamento do `Person Group`.
- Geração de aulas semanais por turma e chamada automática por foto com fallback de confirmação do professor.

## Configuração
1. Node 18+ (necessário `globalThis.fetch`).
2. Dependências: `npm install`.
3. Variáveis de ambiente (arquivo `.env`):
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `APP_TIMEZONE` (ex.: `America/Sao_Paulo`)
   - `CORS_ORIGINS`/`APP_FRONTEND_ORIGIN` (produção)
   - `SERVE_FRONTEND=true|false` e `FRONTEND_BUILD_DIR` (opcional)
   - Integração Azure Face:
     - `AZURE_FACE_ENDPOINT` (ex.: `https://<region>.api.cognitive.microsoft.com`)
     - `AZURE_FACE_KEY`
     - `AZURE_FACE_PERSON_GROUP_ID`
   - Integração Mercado Pago (não comitar chaves):
     - `MERCADO_PAGO_ACCESS_TOKEN` (token da plataforma)
     - `MERCADO_PAGO_PUBLIC_KEY` (chave pública para integrações client-side)
     - `MP_NOTIFICATION_URL` (URL pública do webhook do backend)
     - `FRONTEND_URL` (origem do frontend para `back_urls`)
     - `MP_BACK_URL_SUCESSO` / `MP_BACK_URL_CANCELADO` / `MP_BACK_URL_PENDENTE` (opcionais; sobrescrevem redirecionamentos)
4. Scripts:
   - `npm run dev` (nodemon)
   - `npm start`
   - `npm run lint`
   - `docker compose up -d` (MongoDB local para desenvolvimento)

## Estrutura Principal
- `src/app.js`: inicialização do Express, CORS, rotas e estáticos. Servindo fotos de perfil: `src/app.js:70`.
- `src/server.js`: bootstrap do servidor HTTP.
- `src/config/db.js`: conexão MongoDB.
- `src/routes/*`: definição das rotas por contexto.
- `src/controllers/*`: lógica de negócios.
- `src/models/*`: esquemas Mongoose.
- `src/utils/*`: utilitários (timezone, scheduler).

## Modelos
### Profile
- Campos principais: `userId`, `nome`, `tipo`, `academiaId`, `faixaId`, `graus`, `aulasNoNivelAtual`, `nascimento`, `telefone`, `sexo`, `peso`, `categoriaPeso`, `statusTreino`, `dataInicioTreino`, `dataInicioFaixa`, `historicoProgresso`.
- Foto de perfil: `fotoUrl` `src/models/Profile.js:97`.
- Integração Azure: `azurePersonId` `src/models/Profile.js:103`, `azurePersistedFaces` `src/models/Profile.js:109`.
 - Cobrança e presença: `isentoVitalicio`, `ultimaPresencaEm`, `cobrancaPausada`, `motivoCobrancaPausada`, `cobrancaPausadaEm` `src/models/Profile.js:137`–`src/models/Profile.js:156`.

### Turma
- Professor (`User`), alunos (`User[]`), diasDaSemana, horário, academia.
- `src/models/Turma.js`.

### Aula
- `turmaId`, `dataHora`, `status`, `confirmados`, `chamadaFeita`.
- Índice único por `turmaId+dataHora`.
- `src/models/Aula.js`.

## Controladores
### Perfil (`src/controllers/profileController.js`)
- Sincronização de campos comuns entre perfis do mesmo usuário (exceto dependentes): `src/controllers/profileController.js:922`.
- Inicialização de perfil principal (aluno/professor): prepara datas, faixa e histórico.
- Upload de foto de perfil em criação/atualização (URL/base64) e propagação.
- Azure Face:
  - `azureSincronizarAlunos` cria `Person` por aluno, adiciona face e inicia treino: `src/controllers/profileController.js:967`.
  - `azureTreinarPersonGroup`: `src/controllers/profileController.js:1078`.
  - `azureStatusTreinamento`: `src/controllers/profileController.js:1101`.
 - Isenção vitalícia de aluno (gestor): `POST /api/perfis/:id/isentar-vitalicio` pausa cobrança e marca `isentoVitalicio`: `src/controllers/profileController.js:1085`.

### Aula (`src/controllers/aulaController.js`)
- Geração/listagem de aulas por turma/academia/usuário com timezone resolvido.
- Chamada automática por foto com fallback de confirmação:
  - Endpoint: `POST /api/aulas/:aulaId/chamada-automatica` `src/routes/aulas.js:34`.
  - Implementação: detecta faces e identifica via Azure; alunos acima do limiar (`threshold`, padrão 0.5) entram em `confirmados`; candidatos abaixo do limiar retornam em `pendentes` para confirmação do professor: `src/controllers/aulaController.js:457`.
- Reativação automática de aluno inativo: ao confirmar presença, atualiza `ultimaPresencaEm` e reativa (`statusTreino='ativo'`) se não houver pendências de pagamento: `src/controllers/aulaController.js:421`–`src/controllers/aulaController.js:437`.
 - Professor em outra academia: professor com perfil `ativo` pode gerar aulas, editar/cancelar e fazer chamada em turmas de qualquer academia desde que seja o professor atribuído à turma: `src/controllers/aulaController.js:107–121`, `src/controllers/aulaController.js:197–205`, `src/controllers/aulaController.js:465–473`.

### Dependente
- Criação/atualização com suporte a `fotoBase64` e `fotoUrl`.
- Fallback de contato/telefone conforme perfis associados.
- Exemplos de gravação de foto e erros: `src/controllers/dependenteController.js:185`, `src/controllers/dependenteController.js:375`.

### Autenticação (`src/controllers/authController.js`)
- Registro de gestor/professor/aluno/responsável com foto (URL/base64) e criação automática de perfil.
- Rotas: `src/routes/authRoutes.js:14`–`src/routes/authRoutes.js:17`.

## Rotas Principais
### Perfis (`/api/perfis`)
- Criar: `POST /criar`
- Criar por criador: `POST /:criadorPerfilId/criar`
- Listar por usuário: `GET /user/:userId` e `GET /user`
- Inicializar principal: `POST /inicializar-principal`
- Atualizar: `PATCH /:id`
 - Isentar vitalício (gestor): `POST /:id/isentar-vitalicio`
- Deletar: `DELETE /:id`
- Histórico: `GET /:id/historico`, `POST /:id/historico`
- Azure Face:
  - Sincronizar alunos: `POST /azure/sincronizar-alunos` `src/routes/profiles.js:62`
  - Treinar: `POST /azure/treinar` `src/routes/profiles.js:63`
  - Status: `GET /azure/status-treinamento` `src/routes/profiles.js:64`

### Aulas (`/api/aulas`)
- Gerar semana por turma: `POST /turmas/:turmaId/gerar-semana`
- Listar semana por turma: `GET /turmas/:turmaId/semana`
- Minhas aulas na semana: `GET /minhas/semana`
- Editar/cancelar: `PATCH /:aulaId`
- Confirmar presença: `POST /:aulaId/confirmar`
- Remover confirmação: `DELETE /:aulaId/confirmar`
- Chamada automática por foto (com fallback): `POST /:aulaId/chamada-automatica` `src/routes/aulas.js:34`

### Autenticação (`/api/auth`)
- Registrar gestor/professor/aluno/responsável: `src/routes/authRoutes.js:14`–`src/routes/authRoutes.js:17`
- Login: `POST /login`
- Dados do usuário (token): `GET /me`

## Integração Azure Face
- Pré-requisitos: Person Group existente (`AZURE_FACE_PERSON_GROUP_ID`), `AZURE_FACE_ENDPOINT`, `AZURE_FACE_KEY`.
- Sincronização automática (`/api/perfis/azure/sincronizar-alunos`):
  - Cria `Person` por aluno (usa `nome` e `_id`), adiciona face a partir de `fotoUrl` (HTTP ou arquivo local) e inicia treino.
  - Atualiza `Profile.azurePersonId` e `Profile.azurePersistedFaces`.
- Treino manual (`/api/perfis/azure/treinar`) e status (`/api/perfis/azure/status-treinamento`).
- Chamada automática (`/api/aulas/:aulaId/chamada-automatica`):
  - Detecta faces e identifica com `confidenceThreshold`.
  - Fallback: retorna `pendentes` para confirmação do professor quando a confiança for insuficiente.

## Fotos de Perfil
- `fotoUrl` pode apontar para HTTP/HTTPS ou para arquivos locais gravados via `fotoBase64`.
- Servidos estáticos em `'/profile-photos'`: `src/app.js:70`.

## Convenções de Código
- ES Modules, `async/await` e validações simples antes de operações.
- `globalThis.fetch` e `globalThis.Buffer` para compatibilidade.
- Erros logados; sem vazamento de segredos.
- Lint: `eslint` (veja `package.json`).

## Exemplos de Uso
### Sincronizar alunos com Azure
```
curl -X POST "http://localhost:3000/api/perfis/azure/sincronizar-alunos" \
  -H "Authorization: Bearer <token>"
```

### Chamada automática por foto (com fallback)
```
curl -X POST "http://localhost:3000/api/aulas/<aulaId>/chamada-automatica" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://exemplo.com/foto.jpg",
    "threshold": 0.6
  }'
```
Resposta (exemplo quando há pendentes):
```
{
  "pendenteConfirmacao": true,
  "pendentes": [
    { "faceId": "...", "opcoes": [ { "userId": "...", "nome": "Aluno X", "confidence": 0.49 } ] }
  ],
  "confirmados": ["<userId acima do limiar>"]
}
```
Para confirmar pendentes:
```
curl -X POST "http://localhost:3000/api/aulas/<aulaId>/chamada-automatica" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "recognizedUserIds": ["<userId>"]
  }'
```

## Tarefas Agendadas
- Geração semanal de aulas por turma: `src/utils/aulasScheduler.js`.
- Timezone resolvido por academia: `src/utils/timezone.js`.
 - Verificação diária de inatividade e pausa de cobrança (02:00 app TZ): `src/utils/aulasScheduler.js:132`–`src/utils/aulasScheduler.js:135`.

## Boas Práticas
- Não commitar segredos.
- Manter `CORS_ORIGINS` configurado em produção.
- Ajustar `APP_TIMEZONE` e campos de endereço da academia para melhor cálculo de agenda.
 - Em produção, configure `STRIPE_WEBHOOK_SECRET` e use endpoints de webhook com `express.raw` (`src/app.js:29`).

## CI no GitHub
- Pipeline em `.github/workflows/ci.yml`.
- Executa `npm ci` (ou `npm install`) e `npm run lint` em pushes/PRs para `main/master`.
- Node 18 configurado.

## Ambiente com Docker
- Subir banco local: `docker compose up -d`.
- `MONGO_URI` sugerido: `mongodb://localhost:27017/matcontrol`.
- Encerrar: `docker compose down`.

## Versionamento
- `.gitignore` inclui `.env*`, `node_modules/`, `public/profile-photos/`, diretórios de build/cache e arquivos de log.
- `.gitattributes` normaliza EOL e marca imagens como binário.

## Próximos Passos (Sugestões)
- Endpoint para confirmação explícita dos `pendentes` separado, se desejado.
- Logs estruturados e métricas.
- Testes automatizados.
### Pagamentos (`/api/pagamentos`) — Mercado Pago
- Gestor: checkout de assinatura da plataforma via Preapproval: `POST /gestor/checkout` com `tier` (`basico|intermediario|avancado`) retorna `url` para aprovação
- Aluno: checkout de assinatura do plano da academia via Preapproval: `POST /aluno/checkout` com `planoId` retorna `url`
- Assinatura com cupom/trial: `POST /aluno/assinatura` com `couponCode` (`VITALICIO50`, `BETA100_3M`, `TRIAL7`) ajusta valor ou período grátis
- Configurar Mercado Pago da academia: `PATCH /academias/:academiaId/stripe` com `mercadoPagoAccessToken`
- Conectar Mercado Pago: `POST /academias/:id/stripe/connect` retorna instruções para obter o token via OAuth
- Pagamento único: `POST /pagamentos/criar` cria Preference com `external_reference` e retorna `init_point`
- Webhook Mercado Pago: `POST /api/pagamentos/mercadopago/webhook` atualiza `Pagamento` por `external_reference`
- Consultar pagamentos: `GET /academias/:academiaId` e `GET /alunos/:alunoId`
- Isentar mensalidade do aluno: `POST /academias/:academiaId/isentar`
- Preços da plataforma: `GET /plataforma/precos` retorna valores por tier (`99`, `150`, `250`)

#### Comportamento Dev vs Prod
- Desenvolvimento: quando a academia não possui `mercadoPagoAccessToken`, o backend usa `MERCADO_PAGO_ACCESS_TOKEN` do `.env` para facilitar testes.
- Produção: o fallback é desativado; cada academia deve ter seu próprio `mercadoPagoAccessToken` (configure via `PATCH /api/pagamentos/academias/:academiaId/stripe`).

### Regras
- Cada academia só pode utilizar um cupom (qualquer código). Ao usar `couponCode`, bloqueia novos usos para a academia.
- Consultas de pagamentos têm controle de autorização:
  - Gestor só visualiza os pagamentos da sua própria academia
- Aluno só visualiza os seus próprios pagamentos

## Regras de Cobrança e Inatividade
- Isentar mensalidade: registra pagamento `isento` com `valor=0` e `mesReferencia` opcional.
- Isentar vitalício: marca `isentoVitalicio`, pausa cobrança e agenda cancelamento da assinatura no fim do ciclo.
- Inatividade: aluno sem presença por mais de 30 dias é marcado `inativo` e tem cobrança pausada.
- Reativação: aluno volta a `ativo` na próxima presença somente se não houver `Pagamento` com `status` `pendente` ou `falhou` para a academia.

## Programa de Indicação (Gestor)
- Objetivo: cada novo gestor que assina usando seu link concede 10% de desconto acumulativo na sua assinatura (até 100%).
- Modelo de usuário: `referralCode`, `referredBy`, `referralCount`, `referralRewardApplied` (`src/models/User.js`).
- Link de indicação:
  - Endpoint: `GET /api/academias/gestor/referral-link` retorna `link` e `referralCode` do gestor (`src/routes/academias.js`).
  - Frontend usa `?ref=<referralCode>` no cadastro.
- Registro com indicação:
  - `POST /api/auth/registrar-gestor` aceita `ref` no body e vincula `referredBy` (`src/controllers/authController.js`).
- Aplicação do desconto: via lógica interna e assinatura Mercado Pago com valores ajustados (sem cupons nativos). 
- Pré-requisitos: `MERCADO_PAGO_ACCESS_TOKEN` para a plataforma e `mercadoPagoAccessToken` por academia.

## Planos da Plataforma (Academia)
- Básico: até 30 alunos — R$ 99,00/mês
- Intermediário: até 100 alunos — R$ 150,00/mês
- Avançado: mais de 100 alunos — R$ 250,00/mês
- Campos na academia: `planoTier` (`basico` | `intermediario` | `avancado`), `alunosMax` (30 | 100 | 999999) em `src/models/Academia.js`.
- Seleção/alteração de plano:
  - `PATCH /api/academias/planos/:academiaId` com body `{ "planoTier": "basico|intermediario|avancado" }` (`src/routes/academias.js`, `src/controllers/academiaController.js`).
- Validação de limite:
  - No cadastro de aluno (`POST /api/auth/registrar-aluno`), bloqueia quando `count(alunos) >= alunosMax` e retorna aviso para trocar de plano (`src/controllers/authController.js`).
 - Checkout do gestor por tier:
   - `POST /api/pagamentos/gestor/checkout` aceita `tier: basico|intermediario|avancado` e cria assinatura Mercado Pago (Preapproval)

## Documentação de Endpoints e CRUD

- Base URL (desenvolvimento): `http://localhost:5000`
- Autorização: enviar `Authorization: Bearer <token>` em rotas protegidas
- Content-Type: `application/json` quando houver body

### Autenticação (`/api/auth`)
- Registrar gestor: `POST /registrar-gestor` — cria usuário tipo gestor e perfil vinculado (`src/routes/authRoutes.js:14`)
- Registrar professor: `POST /registrar-professor` — requer `codigoAcademia` (`src/routes/authRoutes.js:15`)
- Registrar aluno: `POST /registrar-aluno` — requer `codigoAcademia` e respeita limite por plano (`src/routes/authRoutes.js:16`)
- Registrar responsável: `POST /registrar-responsavel` (`src/routes/authRoutes.js:17`)
- Login: `POST /login` — retorna `token` JWT (`src/routes/authRoutes.js:18`)
- Usuário atual: `GET /me` — dados do usuário autenticado (`src/routes/authRoutes.js:21`)

### Perfis (`/api/perfis`)
- Criar perfil: `POST /criar` ou `POST /:criadorPerfilId/criar` (`src/routes/profiles.js:23`, `src/routes/profiles.js:26`)
- Listar perfis por usuário: `GET /user/:userId` ou `GET /user` (`src/routes/profiles.js:29`–`src/routes/profiles.js:31`)
- Inicializar perfil principal: `POST /inicializar-principal` (`src/routes/profiles.js:37`)
- Atualizar perfil: `PATCH /:id` (`src/routes/profiles.js:52`)
- Deletar perfil: `DELETE /:id` (`src/routes/profiles.js:57`)
- Histórico de progresso: `GET /:id/historico`, `POST /:id/historico` (`src/routes/profiles.js:60`–`src/routes/profiles.js:63`)
- Isentar vitalício (gestor): `POST /:id/isentar-vitalicio` (`src/routes/profiles.js:54`)
- Azure Face: `POST /azure/sincronizar-alunos`, `POST /azure/treinar`, `GET /azure/status-treinamento` (`src/routes/profiles.js:65`–`src/routes/profiles.js:67`)

- CRUD exemplo (criar/ler/editar/excluir):
```
# Criar (ex.: aluno criado por gestor/professor)
curl -X POST "http://localhost:5000/api/perfis/criar" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{
    "tipo": "aluno",
    "nome": "Aluno Teste",
    "academiaId": "<id>",
    "modalidadeId": "<id>",
    "faixaId": "<id>",
    "sexo": "masculino",
    "peso": 75
  }'

# Listar por usuário atual
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/perfis/user"

# Atualizar
curl -X PATCH "http://localhost:5000/api/perfis/<perfilId>" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{ "telefone": "+55 11 99999-0000" }'

# Deletar
curl -X DELETE "http://localhost:5000/api/perfis/<perfilId>" \
  -H "Authorization: Bearer <token>"
```

### Dependentes (`/api/dependentes`)
- Criar: `POST /` — campos mínimos `nome`, `nascimento`; herda `academiaId` do responsável se não enviado (`src/routes/dependentes.js:17`)
- Listar meus: `GET /` — dependentes do responsável logado (`src/routes/dependentes.js:18`)
- Obter: `GET /:dependenteId` (`src/routes/dependentes.js:19`)
- Atualizar: `PUT /:dependenteId` (`src/routes/dependentes.js:20`)
- Excluir: `DELETE /:dependenteId` (`src/routes/dependentes.js:21`)

- CRUD exemplo:
```
curl -X POST "http://localhost:5000/api/dependentes" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{ "nome": "Filho", "nascimento": "2016-08-12", "modalidadeId": "<id>" }'

curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/dependentes"

curl -X PUT "http://localhost:5000/api/dependentes/<id>" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{ "modalidadeId": "<nova>" }'

curl -X DELETE "http://localhost:5000/api/dependentes/<id>" \
  -H "Authorization: Bearer <token>"
```

### Academias (`/api/academias`)
- Cadastrar: `POST /registrar` (gestor) (`src/routes/academias.js:10`)
- Buscar por código: `GET /codigo/:codigo` (`src/routes/academias.js:14`)
- Listar todas: `GET /` (`src/routes/academias.js:18`)
- Link de indicação do gestor: `GET /gestor/referral-link` (gestor) (`src/routes/academias.js:20`)
- Atualizar plano: `PATCH /planos/:academiaId` (gestor) (`src/routes/academias.js:23`)

### Turmas (`/api/turmas`)
- Criar turma: `POST /` (gestor) (`src/routes/turmas.js:8`)
- Entrar via convite/código: `POST /entrar` (aluno) (`src/routes/turmas.js:12`)

### Aulas (`/api/aulas`)
- Gerar semana por turma: `POST /turmas/:turmaId/gerar-semana` (gestor/professor da turma) (`src/routes/aulas.js:18`)
- Listar semana por turma: `GET /turmas/:turmaId/semana` (`src/routes/aulas.js:21`)
- Minhas aulas na semana: `GET /minhas/semana` (`src/routes/aulas.js:24`)
- Editar/cancelar aula: `PATCH /:aulaId` (`src/routes/aulas.js:27`)
- Confirmar presença: `POST /:aulaId/confirmar` (`src/routes/aulas.js:30`)
- Remover confirmação: `DELETE /:aulaId/confirmar` (`src/routes/aulas.js:31`)
- Chamada automática por foto: `POST /:aulaId/chamada-automatica` (`src/routes/aulas.js:34`)
- Gerar semana por academia: `POST /academias/:academiaId/gerar-semana` (gestor) (`src/routes/aulas.js:37`)
- Listar semana por academia: `GET /academias/:academiaId/semana` (gestor) (`src/routes/aulas.js:40`)

### Níveis (`/api/niveis`)
- Listar por modalidade: `GET /:modalidadeId` (`src/routes/niveis.js:8`)
- Atualizar nível: `PATCH /:id` (gestor) (`src/routes/niveis.js:11`)

### Modalidades (`/api/modalidades`)
- Listar base de modalidades: `GET /base` (`src/routes/modalidades.js:12`)
- Ativar na academia: `POST /ativar` (gestor) (`src/routes/modalidades.js:13`)
- Minhas modalidades ativas: `GET /minhas` (`src/routes/modalidades.js:16`)
- Remover modalidade ativa: `DELETE /minhas/:modalidadeId` (gestor) (`src/routes/modalidades.js:19`)

### Planos de Academia (`/api/planos`)
- Criar: `POST /` (`src/routes/planos.js:13`)
- Listar por academia: `GET /academia/:academiaId` (`src/routes/planos.js:14`)
- Atualizar: `PATCH /:id` (`src/routes/planos.js:15`)
- Deletar: `DELETE /:id` (`src/routes/planos.js:16`)

- CRUD exemplo (planos):
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

curl "http://localhost:5000/api/planos/academia/<academiaId>" -H "Authorization: Bearer <token>"

curl -X PATCH "http://localhost:5000/api/planos/<planoId>" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{ "valor": 180 }'

curl -X DELETE "http://localhost:5000/api/planos/<planoId>" -H "Authorization: Bearer <token>"
```

### Pagamentos (`/api/pagamentos`) — Mercado Pago
- Gestor: checkout assinatura da plataforma: `POST /gestor/checkout` (opcional `tier`) (`src/routes/pagamentos.js:10`)
- Aluno: checkout do plano da academia: `POST /aluno/checkout` (`src/routes/pagamentos.js:14`)
- Aluno: assinatura com cupom/trial: `POST /aluno/assinatura` (`src/routes/pagamentos.js:18`)
- Configurar Mercado Pago da academia: `PATCH /academias/:academiaId/stripe` (gestor) (`src/routes/pagamentos.js:22`)
- Conectar Mercado Pago: `POST /academias/:id/stripe/connect` (gestor) (`src/routes/pagamentos.js:26`)
- Criar pagamento direto: `POST /criar` (`src/routes/pagamentos.js:30`)
- Listar pagamentos da academia: `GET /academias/:academiaId` (`src/routes/pagamentos.js:33`)
- Listar pagamentos do aluno: `GET /alunos/:alunoId` (`src/routes/pagamentos.js:36`)
- Isentar mensalidade do aluno: `POST /academias/:academiaId/isentar` (gestor) (`src/routes/pagamentos.js:40`)
- Preços da plataforma: `GET /plataforma/precos` (`src/routes/pagamentos.js:42`)

### Saúde
- Health check: `GET /api/healthz` — verifica status do serviço (`src/app.js:59`)

### CRUD: Forma de uso
- Criar: `POST` no recurso (ex.: `POST /api/planos`).
- Ler: `GET` do recurso (lista ou item — ex.: `GET /api/planos/academia/:academiaId`).
- Atualizar: `PATCH` para atualização parcial; `PUT` para atualização integral onde definido (dependentes usam `PUT`).
- Excluir: `DELETE` no identificador do recurso.
- Regras de permissão variam por rota e tipo de usuário (gestor/professor/aluno/responsável); ver observações nas rotas acima.
