const { criadorPerfilId } = req.params;# Criação de Professor por Gestor - Exemplos Atualizados

## Mudanças Implementadas

### 1. **Academia Automática**
- Quando um gestor cria um professor, a academia é herdada automaticamente do gestor
- Não é necessário enviar `academiaId` no body da requisição

### 2. **Nome Herdado**
- O nome do professor será herdado do nome do gestor que está criando
- Você pode opcionalmente enviar um nome diferente, mas se não enviar, usará o do gestor

## Exemplos de Requisições

### ✅ Forma 1: Usando Perfil Logado (RECOMENDADO)
```bash
curl -X POST http://localhost:3000/api/profiles/criar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DO_GESTOR" \
  -d '{
    "tipo": "professor",
    "telefone": "11999999999"
  }'
```

### ✅ Forma 2: Especificando ID do Criador
```bash
curl -X POST http://localhost:3000/api/profiles/ID_DO_GESTOR/criar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DO_GESTOR" \
  -d '{
    "tipo": "professor",
    "telefone": "11999999999"
  }'
```

**Response:**
```json
{
  "message": "Perfil criado com sucesso.",
  "perfil": {
    "nome": "Nome do Gestor",
    "tipo": "professor", 
    "academiaId": "ID_DA_ACADEMIA_DO_GESTOR",
    "telefone": "11999999999",
    "userId": "ID_DO_USUARIO"
  }
}
```

### ✅ Criar Professor com Nome Personalizado
```bash
curl -X POST http://localhost:3000/api/perfis/ID_DO_GESTOR \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DO_GESTOR" \
  -d '{
    "tipo": "professor",
    "nome": "Prof. João Silva",
    "telefone": "11999999999",
    "modalidadeId": "ID_DA_MODALIDADE"
  }'
```

### ❌ Erro - Gestor sem Academia
```bash
curl -X POST http://localhost:3000/api/profiles/criar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DO_GESTOR" \
  -d '{
    "tipo": "professor"
  }'
```

**Response:** `400 Bad Request`
```json
{
  "message": "Gestor deve ter uma academia associada para criar professores."
}
```

### ❌ Erro - Tentar usar Academia Diferente (Forma com ID)
```bash
curl -X POST http://localhost:3000/api/profiles/ID_DO_GESTOR/criar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DO_GESTOR" \
  -d '{
    "tipo": "professor",
    "academiaId": "OUTRA_ACADEMIA_ID"
  }'
```

**Response:** `400 Bad Request`
```json
{
  "message": "Gestores devem usar sua própria academia ao criar professores."
}
```

## Benefícios das Mudanças

1. **Mais Simples** - Gestor não precisa lembrar o ID da academia
2. **Mais Seguro** - Impede que gestor crie professores em academias erradas
3. **Padrão Consistente** - Todos professores de um gestor estarão na mesma academia
4. **Flexível** - Ainda permite nome personalizado se necessário

## Fluxo Completo

1. **Gestor loga no sistema** → Obtém token JWT
2. **Sistema verifica** → Gestor tem academia associada?
3. **Cria professor** → Usa academia do gestor automaticamente
4. **Nome definido** → Herda do gestor ou usa nome personalizado
5. **Professor criado** → Pronto para uso!

## Códigos de Status

- `201 Created` - Professor criado com sucesso
- `400 Bad Request` - Gestor sem academia ou academia inválida
- `403 Forbidden` - Sem permissão para criar professor
- `404 Not Found` - Perfil do gestor não encontrado
- `409 Conflict` - Já existe um professor criado por este gestor