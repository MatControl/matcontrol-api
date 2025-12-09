# 🐛 Solução de Problemas - Criação de Professor por Gestor

## Erro: "Criador do perfil não encontrado"

### Causas Possíveis:

1. **ID do criador incorreto** na URL
2. **Perfil do gestor não existe** no banco de dados
3. **Token JWT inválido ou expirado**

### Soluções:

#### ✅ Opção 1: Usar Perfil Logado (RECOMENDADO)
```bash
# Não precisa do ID na URL - usa o perfil logado automaticamente
curl -X POST http://localhost:3000/api/profiles/criar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "tipo": "professor",
    "telefone": "11999999999"
  }'
```

#### ✅ Opção 2: Especificar ID do Criador
```bash
# Verifique primeiro se o ID está correto
curl -X GET http://localhost:3000/api/profiles/user/ID_DO_USUARIO \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

# Depois use o ID correto do perfil gestor
curl -X POST http://localhost:3000/api/profiles/ID_DO_GESTOR/criar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "tipo": "professor",
    "telefone": "11999999999"
  }'
```

## Como Descobrir seu ID de Perfil

### 1. Listar seus perfis:
```bash
curl -X GET http://localhost:3000/api/profiles/user/SEU_USER_ID \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### 2. Ou use o endpoint de perfis criados:
```bash
curl -X GET http://localhost:3000/api/profiles/created-by/SEU_PERFIL_ID \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

## Verificar se o Token está Funcionando

### Teste seu token:
```bash
curl -X GET http://localhost:3000/api/auth/verify \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

## Fluxo Recomendado

1. **Login** → Obtenha o token JWT
2. **Descubra seu perfil** → Use `/api/profiles/user/:userId`
3. **Identifique o ID do gestor** → Geralmente é o primeiro perfil do tipo "gestor"
4. **Crie o professor** → Use `/api/profiles/criar` (forma mais simples)

## Exemplo Completo de Teste

```bash
# 1. Login (substitua com suas credenciais)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gestor@email.com",
    "password": "senha123"
  }'

# Resposta: {"token": "SEU_TOKEN_AQUI", "userId": "SEU_USER_ID"}

# 2. Listar perfis do usuário
curl -X GET http://localhost:3000/api/profiles/user/SEU_USER_ID \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

# 3. Criar professor (forma simples)
curl -X POST http://localhost:3000/api/profiles/criar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "tipo": "professor",
    "telefone": "11999999999"
  }'
```

## Status de Resposta

- `201 Created` - Professor criado com sucesso
- `400 Bad Request` - Dados inválidos ou gestor sem academia
- `401 Unauthorized` - Token inválido ou não fornecido
- `403 Forbidden` - Sem permissão para criar professor
- `404 Not Found` - Criador não encontrado

## Dicas Importantes

1. **Sempre use o token no header** `Authorization: Bearer SEU_TOKEN`
2. **Verifique se o gestor tem academia associada** antes de criar professor
3. **Use a forma simples** `/api/profiles/criar` para evitar problemas de ID
4. **Teste com curl ou Postman** antes de implementar no frontend