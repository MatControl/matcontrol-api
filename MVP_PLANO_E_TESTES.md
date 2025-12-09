# MVP MatControl — Plano, Status e Testes de Rotas (Postman)

## Visão Geral do MVP
- Gestor: cadastra-se, cria academia, define modalidades, planos, turmas; pode adicionar dependentes e também atuar como professor.
- Professor: cadastra-se, pode adicionar dependentes, gerencia aulas (geração semanal, edição/cancelamento) e faz chamada (RSVP manual já implementado; chamada via IA com reconhecimento facial será implementada depois).
- Aluno: cadastra-se, pode adicionar dependentes, entra na turma via link/código de convite ou botão no app, confirma presença, vê progresso de nível e histórico de aulas/faixas (parte estrutural existente; cálculo e visualização detalhada ficam para próxima etapa).
- Pagamento: o aluno paga diretamente ao gestor; a integração de pagamentos ficará para a última etapa (fora do escopo atual).

## O que já está implementado
- Autenticação e perfis:
  - Registro de Gestor, Professor, Aluno; login JWT; endpoint `me` para obter informações.
  - Perfis vinculados (dependentes/professor) com criação, listagem, atualização e deleção.
- Academias:
  - Cadastro com endereço global (compatível BR) e timezone automático por endereço/UF.
  - Busca por código e listagem de academias.
- Modalidades e Níveis:
  - Listagem base de modalidades e ativação na academia.
  - Listagem/atualização de níveis por modalidade.
- Planos:
  - CRUD de planos por academia.
- Turmas:
  - Criação de turma (gestor), código de convite; aluno entra via código.
- Aulas (semana e RSVP):
  - Geração semanal por turma e por academia; geração automática semanal via scheduler.
  - Listagem de aulas da semana por turma e “minhas aulas” (professor/aluno).
  - Edição/cancelamento de aula (professor/gestor) com campo `observacoes`.
  - Aluno confirma/remove presença (RSVP).
  - Persistência de datas em UTC com cálculos timezone-aware por academia.

## O que falta (próximas etapas)
- Chamada via IA com reconhecimento facial a partir de foto do treino.
- Progresso do aluno (cálculo de aulas restantes para próximo nível) e visualizações consolidadas.
- Histórico completo de faixas e presenças com relatórios/exportações.
- Matrícula em múltiplas modalidades condicionada ao plano (regras de negócio e validação cruzada).
- Integração de pagamentos (última etapa, fora do MVP inicial).

---

## Testes de Rotas (Postman)

### Pré-requisitos
- Base URL: `http://localhost:3000/api` (ajuste conforme seu server).
- Use um ambiente com variável `{{token}}` para o JWT.
- Headers padrão:
  - `Content-Type: application/json`
  - `Authorization: Bearer {{token}}` (nas rotas protegidas)

### Autenticação
- Registrar Gestor: `POST /auth/registrar-gestor`
  - Body: `{ "nome": "Gestor", "email":"gestor@ex.com", "senha":"123456" }`
  - Esperado: `201` com dados do usuário.
- Registrar Professor: `POST /auth/registrar-professor`
  - Body: `{ "nome": "Professor", "email":"prof@ex.com", "senha":"123456" }`
- Registrar Aluno: `POST /auth/registrar-aluno`
  - Body: `{ "nome": "Aluno", "email":"aluno@ex.com", "senha":"123456" }`
- Login: `POST /auth/login`
  - Body: `{ "email":"gestor@ex.com", "senha":"123456" }`
  - Esperado: `200` com `token` JWT.
- Usuário atual: `GET /auth/me`
  - Header: `Authorization`
  - Esperado: dados do usuário logado.

### Academias
- Cadastrar Academia: `POST /academias/registrar`
  - Header: `Authorization: Bearer {{token}}` (gestor)
  - Body (global BR):
    ```json
    {
      "nome": "Academia MatControl",
      "endereco": {
        "addressLine1": "Rua Exemplo, 123",
        "addressLine2": "Centro",
        "city": "São Paulo",
        "region": "SP",
        "postalCode": "01000-000",
        "country": "BR"
      },
      "telefone": "+55 11 99999-0000",
      "email": "contato@matcontrol.com"
    }
    ```
  - Esperado: `201` com academia e `codigoAcademia`.
- Buscar por código: `GET /academias/codigo/{{codigoAcademia}}`
  - Esperado: academia correspondente.
- Listar: `GET /academias`
  - Esperado: lista de academias.

### Modalidades
- Base de modalidades: `GET /modalidades/base`
  - Header: `Authorization`
  - Esperado: lista de modalidades base.
- Ativar modalidades na academia: `POST /modalidades/ativar`
  - Body: `{ "academiaId": "...", "modalidades": ["<idModalidade>", "..."] }`
  - Esperado: `200` com modalidades ativadas.

### Níveis
- Listar níveis por modalidade: `GET /niveis/{{modalidadeId}}`
  - Header: `Authorization`
  - Esperado: níveis da modalidade.
- Atualizar nível: `PATCH /niveis/{{id}}`
- Body: campos a atualizar (ex.: `{"tempoPadraoAulas": 120}`)
  - Esperado: `200` com nível atualizado.

### Planos
- Criar plano: `POST /planos`
  - Body: `{ "academiaId":"...", "nome":"Plano Ouro", "permiteMultimodalidade": true, "valor": 199 }`
  - Esperado: `201` com plano.
- Listar planos por academia: `GET /planos/academia/{{academiaId}}`
- Atualizar plano: `PATCH /planos/{{id}}`
- Deletar plano: `DELETE /planos/{{id}}`

### Perfis
- Inicializar perfil principal: `POST /profiles/inicializar-principal`
  - Body exemplo: `{ "telefone": "+55...", "nascimento":"2000-01-01", "academiaId":"..." }`
  - Esperado: `200` com perfil do usuário atualizado.
- Criar perfil vinculado: `POST /profiles/criar`
  - Body: `{ "tipo":"dependente", "nome":"Filho" }`
  - Observação faixa preta (IBJJF): ao criar/atualizar perfil com `faixaId` da Preta, informe `pretaDataReferencia` no body (data da preta se 0 grau; data do último grau se já possui graus). Ex.: `{ "faixaId": "<idPreta>", "pretaDataReferencia": "2018-06-01" }`. O sistema calculará e manterá os graus automaticamente conforme os períodos em anos da IBJJF.
- Listar perfis do usuário: `GET /profiles/user` (usa token) ou `GET /profiles/user/{{userId}}`
- Atualizar perfil: `PATCH /profiles/{{id}}`
- Deletar perfil: `DELETE /profiles/{{id}}`

### Dependentes
- Criar dependente: `POST /dependentes`
  - Body: `{ "nome":"Fulano", "nascimento":"2015-06-01" }`
- Listar meus dependentes: `GET /dependentes`
- Obter dependente: `GET /dependentes/{{dependenteId}}`
- Atualizar dependente: `PUT /dependentes/{{dependenteId}}`
- Excluir dependente: `DELETE /dependentes/{{dependenteId}}`

### Turmas
- Criar turma (gestor): `POST /turmas`
  - Body (exemplo):
    ```json
    {
      "nome": "Turma Kids",
      "modalidade": "<idModalidade>",
      "professor": "<idProfessor>",
      "diasDaSemana": ["segunda", "quarta"],
      "horario": "18:30",
      "academia": "<idAcademia>"
    }
    ```
- Entrar via código de convite (aluno): `POST /turmas/entrar`
  - Body: `{ "codigoConvite": "<codigo>" }`

### Aulas (semana/RSVP)
- Gerar semana por turma (professor/gestor): `POST /aulas/turmas/{{turmaId}}/gerar-semana`
  - Query opcional: `?timezone=America/Sao_Paulo`
  - Esperado: `200` com aulas criadas/atualizadas.
- Listar semana por turma: `GET /aulas/turmas/{{turmaId}}/semana`
- Minhas aulas da semana (professor/aluno): `GET /aulas/minhas/semana`
- Editar/cancelar aula (professor/gestor): `PATCH /aulas/{{aulaId}}`
  - Body: `{ "status":"cancelada", "observacoes":"Feriado" }`
- Confirmar presença (aluno): `POST /aulas/{{aulaId}}/confirmar`
- Remover confirmação (aluno): `DELETE /aulas/{{aulaId}}/confirmar`
- Gerar semana por academia (gestor): `POST /aulas/academias/{{academiaId}}/gerar-semana`

### Scheduler Automático
- O scheduler gera as aulas todo domingo às 00:05 (fuso `APP_TIMEZONE`), mas calcula `dataHora` em UTC baseado no timezone da academia de cada turma.
- Para validar manualmente com Postman, use os endpoints de geração acima.

---

## Dicas de Teste
- Ordem sugerida:
  1) Registrar gestor, login, criar academia.
  2) Ativar modalidades e criar níveis/plano.
  3) Registrar professor e aluno; inicializar perfis.
  4) Criar turma e enviar código para aluno; aluno entra.
  5) Gerar semana de aulas e listar; confirmar presença; editar/cancelar.
- Verifique timezone: passe `?timezone=` diferente e confira horários gerados.
- Consulte `GET /auth/me` para confirmar identidade antes de chamadas protegidas.

---

## Observações
- Pagamentos e chamada via IA serão adicionados em etapas futuras.
- Endereço global e `timezone` por academia já estão suportados; fora do Brasil, recomendo informar `timezone` explícito até ampliarmos o mapeamento.