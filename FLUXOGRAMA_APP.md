# Fluxograma Detalhado do MatControl

## Visão Geral de Componentes
```mermaid
flowchart TD
  subgraph Users[Usuários]
    G[Gestor]
    P[Professor]
    A[Aluno]
    R[Responsável]
  end

  subgraph Core[Backend MatControl]
    Auth[Autenticação]
    Profiles[Perfis]
    Academias[Academias]
    Modalidades[Modalidades]
    Niveis[Níveis]
    Turmas[Turmas]
    Aulas[Aulas]
    Pagamentos[Pagamentos]
    Azure[Azure Face]
    Schedulers[Agendadores]
  end

  subgraph Ext[Serviços Externos]
    Stripe[Stripe]
    SMTP[SMTP]
  end

  G-->Auth
  P-->Auth
  A-->Auth
  R-->Auth
  Auth-->Profiles
  G-->Academias
  Academias-->Turmas
  Turmas-->Aulas
  Profiles-->Azure
  Aulas-->Azure
  Pagamentos-->Stripe
  Schedulers-->Aulas
  Schedulers-->SMTP
```

## Autenticação e Perfis
```mermaid
sequenceDiagram
  participant U as Usuário
  participant API as /api/auth
  participant DB as MongoDB
  U->>API: POST /registrar-(gestor|professor|aluno|responsavel)
  API->>DB: Cria User + Profile
  API-->>U: 201 {usuario, perfil}
  U->>API: POST /login {email, senha}
  API->>DB: Valida User
  API-->>U: 200 {token, usuario}
  U->>API: GET /me (Authorization: Bearer)
  API->>DB: Busca dados do usuário
  API-->>U: 200 {usuario}
```

## Fluxo de Academia e Planos
```mermaid
flowchart LR
  G[Gestor]-->RegAcad[POST /api/academias/registrar]
  RegAcad-->Acad[Academia criada]
  G-->UpdPlano[PATCH /api/academias/planos/:academiaId]
  UpdPlano-->Acad
  Acad-- Limite alunos -->RegAluno[POST /api/auth/registrar-aluno]
  RegAluno-->|Se count >= alunosMax| Block[400 Troque de plano]
```

## Turmas e Aulas
```mermaid
sequenceDiagram
  participant G as Gestor
  participant P as Professor (ativo)
  participant API as /api/turmas & /api/aulas
  participant DB as MongoDB
  G->>API: POST /api/turmas {dados}
  API->>DB: Cria Turma
  API-->>G: 201 {turma, aulasProximaSemanaCriadas}
  P->>API: POST /api/aulas/turmas/:turmaId/gerar-semana
  API->>DB: Verifica professor atribuído & statusTreino=ativo
  API->>DB: Gera Aulas semana
  API-->>P: 200 {aulas}
  P->>API: PATCH /api/aulas/:aulaId {status}
  API->>DB: Atualiza aula (professor ativo ou gestor)
  API-->>P: 200 {aula}
```

## Presença e Status Automático
```mermaid
flowchart TD
  A[Aluno]-->Confirm[POST /api/aulas/:aulaId/confirmar]
  Confirm-->SetUltima[Atualiza ultimaPresencaEm]
  SetUltima-->Reativar[Se statusTreino=inativo e sem pendências, reativar]
  AulasSemChamada[Lista aulas]-->AutoStatus[Atualiza status (agendada/finalizada/aguardando chamada)]
```

## Reconhecimento Facial (Azure)
```mermaid
sequenceDiagram
  participant P as Professor/Gestor
  participant API as /api/perfis/azure/*
  participant Azure as Azure Face API
  P->>API: POST /api/perfis/azure/sincronizar-alunos
  API->>Azure: create person + add face + train
  API-->>P: 200 {pessoasCriadas, facesAdicionadas}
  P->>API: POST /api/aulas/:aulaId/chamada-automatica {imageUrl|imageBase64}
  API->>Azure: detect + identify
  API->>DB: Add confirmados; chamadaFeita
  API-->>P: 200 {confirmados, pendentes}
```

## Pagamentos e Assinaturas (Stripe)
```mermaid
sequenceDiagram
  participant G as Gestor
  participant A as Aluno
  participant API as /api/pagamentos
  participant Stripe as Stripe
  G->>API: POST /gestor/checkout {tier|priceId}
  API->>Stripe: create checkout (subscription)
  Stripe-->>G: URL de checkout
  A->>API: POST /aluno/checkout {planoId}
  API->>Stripe: create checkout (subscription, Connect)
  Stripe-->>A: URL de checkout
  Stripe->>API: POST /api/pagamentos/stripe/webhook
  API->>DB: Concilia Pagamento (pago/falhou)
  API->>DB: Grava stripeSubscriptionId do usuário
```

## Programa de Indicação (Gestor)
```mermaid
sequenceDiagram
  participant G as Gestor (indicador)
  participant N as Novo Gestor
  participant API as /api/academias & /api/pagamentos
  participant Stripe as Stripe
  G->>API: GET /api/academias/gestor/referral-link
  API-->>G: {link, referralCode}
  N->>API: POST /api/auth/registrar-gestor {ref}
  N->>API: POST /api/pagamentos/gestor/checkout
  Stripe->>API: webhook checkout.session.completed
  API->>Stripe: Aplica cupom % (10% por indicação, acumula até 100%) na assinatura do G
```

## Isenções e Inatividade
```mermaid
flowchart LR
  G[Gestor]-->IsentarMensal[POST /api/pagamentos/academias/:academiaId/isentar]
  G-->IsentarVital[POST /api/perfis/:id/isentar-vitalicio]
  Schedulers-->Inativar[Scheduler diário: marca inativo se >30 dias sem presença & pausa cobrança]
  ConfirmarPresenca-->Reativar[Reativa se sem pendências]
```

## Felicitações de Aniversário
```mermaid
sequenceDiagram
  participant Sch as Scheduler 08:00
  participant API as birthdayScheduler
  participant SMTP as SMTP
  Sch->>API: Executa
  API->>DB: Busca perfis com nascimento==hoje
  API->>DB: Seleciona modalidade preferida por usuário
  API->>SMTP: Envia e-mail personalizado por modalidade
```

## Professor em Outra Academia
```mermaid
flowchart TD
  P[Professor ativo]-->TurmaOutraAcad[Turma pertence a outra academia]
  TurmaOutraAcad-->PermGerar[Pode gerar aulas]
  TurmaOutraAcad-->PermEditar[Pode editar/cancelar]
  TurmaOutraAcad-->PermChamada[Pode fazer chamada]
  note right of TurmaOutraAcad: Desde que seja o professor atribuído à turma
```

## Endpoints-Chave
- Autenticação: `/api/auth/registrar-*`, `/api/auth/login`, `/api/auth/me`
- Perfis: `/api/perfis/*`, inicialização e histórico
- Academias: `/api/academias/registrar`, `/api/academias/planos/:academiaId`, `/api/academias/gestor/referral-link`
- Turmas/Aulas: `/api/turmas/*`, `/api/aulas/*`
- Pagamentos: `/api/pagamentos/*`, webhook Stripe
- Azure Face: `/api/perfis/azure/*`
- Schedulers: Aulas semanais, inatividade, aniversários

## Variáveis de Ambiente (Principais)
- Banco/segurança: `MONGO_URI`, `JWT_SECRET`
- Frontend/CORS: `FRONTEND_URL`, `CORS_ORIGINS`, `APP_TIMEZONE`
- Azure: `AZURE_FACE_ENDPOINT`, `AZURE_FACE_KEY`, `AZURE_FACE_KEY_2`, `AZURE_FACE_PERSON_GROUP_ID`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PLATFORM_PRICE_ID`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`