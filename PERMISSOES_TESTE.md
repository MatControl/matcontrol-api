# Teste de Permissões - Fluxo de Criação de Perfis

## Resumo das Permissões

### Gestor
- ✅ Pode criar: `professor`, `aluno` e `dependente`
- ❌ Não pode criar: `gestor`

### Professor  
- ✅ Pode criar: `aluno`, `dependente`
- ❌ Não pode criar: `gestor`, `professor`

### Aluno
- ✅ Pode criar: `dependente` 
- ❌ Não pode criar: `gestor`, `professor`, `aluno`

### Responsável
- ✅ Pode criar: `dependente`
- ❌ Não pode criar: `gestor`, `professor`, `aluno`

### Dependente
- ❌ Não pode criar nenhum tipo de perfil

## Testes de API

### 1. Gestor criando Professor
```bash
curl -X POST http://localhost:3000/api/perfis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DO_GESTOR" \
  -d '{
    "nome": "Prof. João Silva",
    "tipo": "professor",
    "academiaId": "ID_DA_ACADEMIA",
    "telefone": "11999999999"
  }'
```

**Expected Response:** `201 Created`

### 1.1 Gestor criando Aluno
```bash
curl -X POST http://localhost:3000/api/perfis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DO_GESTOR" \
  -d '{
    "nome": "Gestor que treina",
    "tipo": "aluno",
    "academiaId": "ID_DA_ACADEMIA"
  }'
```

**Expected Response:** `201 Created`

### 2. Gestor criando Dependente
```bash
curl -X POST http://localhost:3000/api/dependentes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DO_GESTOR" \
  -d '{
    "nome": "Filho do Gestor",
    "nascimento": "2015-01-01",
    "academiaId": "ID_DA_ACADEMIA",
    "modalidadeId": "ID_DA_MODALIDADE",
    "contatoResponsavel": {
      "nome": "Gestor Pai",
      "telefone": "11999999999",
      "email": "gestor@email.com",
      "parentesco": "pai"
    }
  }'
```

**Expected Response:** `201 Created`

### 3. Professor criando Dependente
```bash
curl -X POST http://localhost:3000/api/dependentes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DO_PROFESSOR" \
  -d '{
    "nome": "Filho do Professor",
    "nascimento": "2018-01-01",
    "academiaId": "ID_DA_ACADEMIA",
    "modalidadeId": "ID_DA_MODALIDADE",
    "contatoResponsavel": {
      "nome": "Professor Pai",
      "telefone": "11888888888",
      "email": "professor@email.com",
      "parentesco": "pai"
    }
  }'
```

**Expected Response:** `201 Created`

### 3.1 Professor criando Aluno (para treinar)
```bash
curl -X POST http://localhost:3000/api/perfis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DO_PROFESSOR" \
  -d '{
    "nome": "Professor que treina",
    "tipo": "aluno",
    "academiaId": "ID_DA_ACADEMIA"
  }'
```

**Expected Response:** `201 Created`

### 4. Aluno criando Dependente
```bash
curl -X POST http://localhost:3000/api/dependentes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DO_ALUNO" \
  -d '{
    "nome": "Filho do Aluno",
    "nascimento": "2020-01-01",
    "academiaId": "ID_DA_ACADEMIA",
    "modalidadeId": "ID_DA_MODALIDADE",
    "contatoResponsavel": {
      "nome": "Aluno Pai",
      "telefone": "11777777777",
      "email": "aluno@email.com",
      "parentesco": "pai"
    }
  }'
```

**Expected Response:** `201 Created`

### 5. Teste de Permissão Negada - Dependente tentando criar
```bash
curl -X POST http://localhost:3000/api/dependentes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DO_DEPENDENTE" \
  -d '{
    "nome": "Tentativa de Dependente",
    "nascimento": "2019-01-01",
    "academiaId": "ID_DA_ACADEMIA",
    "contatoResponsavel": {
      "nome": "Responsável",
      "telefone": "11666666666"
    }
  }'
```

**Expected Response:** `403 Forbidden` - "Perfis do tipo "dependente" não podem criar dependentes"

### 6. Teste de Criação de Perfil Inválido - Dependente tentando criar Aluno
```bash
curl -X POST http://localhost:3000/api/perfis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DO_DEPENDENTE" \
  -d '{
    "nome": "Aluno inválido",
    "tipo": "aluno",
    "academiaId": "ID_DA_ACADEMIA"
  }'
```

**Expected Response:** `403 Forbidden` - "Perfis do tipo \"dependente\" não podem criar perfis do tipo \"aluno\""

## Validações Implementadas

1. **dependenteController.js** verifica se o responsável é dos tipos permitidos: `["gestor", "professor", "aluno", "responsavel"]`
2. **profileController.js** verifica as permissões através do objeto `permissoes` (atualizado para permitir criação de `aluno` por `gestor` e `professor`)
3. **authMiddleware** garante que apenas usuários autenticados possam acessar as rotas

## Rotas Disponíveis

### Perfis Gerais
- `POST /api/perfis/criar` - Criar perfil vinculado usando o perfil do usuário logado
- `POST /api/perfis/:criadorPerfilId/criar` - Criar perfil vinculado informando o perfil criador na URL
- `GET /api/perfis/user/:userId` - Listar perfis de um usuário
- `PATCH /api/perfis/:id` - Atualizar perfil
- `DELETE /api/perfis/:id` - Deletar perfil

### Dependentes (Rotas Específicas)
- `POST /api/dependentes` - Criar dependente (gestor, professor, aluno)
- `GET /api/dependentes` - Listar meus dependentes
- `PUT /api/dependentes/:dependenteId` - Atualizar dependente
- `DELETE /api/dependentes/:dependenteId` - Deletar dependente
- `GET /api/dependentes/:dependenteId` - Obter detalhes de um dependente

## Status: ✅ IMPLEMENTADO E FUNCIONANDO