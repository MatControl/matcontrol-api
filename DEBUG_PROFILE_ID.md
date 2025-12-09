# 🔍 DEBUG - Profile ID não está sendo encontrado

## ✅ Correções Aplicadas

### 1. Middleware de Autenticação (`authMiddleware.js`)
- ✅ Agora popula os perfis do usuário: `.populate('perfis')`
- ✅ Lógica inteligente para encontrar o perfil correto baseado no tipo
- ✅ Popula `req.user.profileId` corretamente

### 2. Login Controller (`authController.js`)
- ✅ Agora popula os perfis no login: `.populate('perfis')`

## 🧪 Teste Completo para Verificar

### Passo 1: Verificar se o Usuário tem Perfis
```bash
# Faça login primeiro para obter o token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seu_email@exemplo.com",
    "password": "sua_senha"
  }'
```

**Verifique na resposta se os perfis estão sendo retornados:**
```json
{
  "mensagem": "Login bem-sucedido!",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "_id": "id_do_usuario",
    "nome": "Nome do Usuário",
    "email": "seu_email@exemplo.com",
    "tipo": "gestor",
    "perfis": [
      {
        "_id": "id_do_perfil_gestor",
        "tipo": "gestor",
        "nome": "Nome do Gestor",
        "academiaId": "id_da_academia"
      }
    ]
  }
}
```

### Passo 2: Testar Criação de Professor (Forma Simples)
```bash
curl -X POST http://localhost:3000/api/profiles/criar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "tipo": "professor",
    "telefone": "11999999999"
  }'
```

### Passo 3: Verificar Logs do Servidor
**Adicione este log temporário no `authMiddleware.js` para debug:**

```javascript
// Adicione esta linha após popular o user
console.log("🔍 Usuário com perfis populados:", JSON.stringify(user, null, 2));
console.log("🎯 Profile ID encontrado:", profileId);
```

### Passo 4: Teste Alternativo - Verificar Perfil Específico
```bash
# Descubra seus perfis
curl -X GET http://localhost:3000/api/profiles/user/SEU_USER_ID \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

## 🚨 Possíveis Causas e Soluções

### Causa 1: Usuário sem Perfis
**Sintoma:** `usuario.perfis` está vazio `[]`
**Solução:** Criar um perfil para o usuário

### Causa 2: Perfil não está vinculado ao User
**Sintoma:** Perfil existe mas não está no array `perfis` do User
**Solução:** Verificar relacionamento no banco

### Causa 3: Tipo de perfil não corresponde
**Sintoma:** Usuário é "gestor" mas perfil é "professor"
**Solução:** Verificar consistência dos dados

## 🔧 Verificação no Banco de Dados

### Verificar se o usuário tem perfis:
```javascript
// No MongoDB ou Mongoose
const user = await User.findById("SEU_USER_ID").populate('perfis');
console.log(user.perfis); // Deve mostrar os perfis
```

### Verificar se o perfil existe:
```javascript
const profiles = await Profile.find({ userId: "SEU_USER_ID" });
console.log(profiles); // Deve mostrar os perfis do usuário
```

## ✅ Se Ainda Não Funcionar

### Teste com ID explícito na URL:
```bash
# Use o ID do perfil que você descobriu
curl -X POST http://localhost:3000/api/profiles/ID_DO_SEU_PERFIL_GESTOR/criar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "tipo": "professor",
    "telefone": "11999999999"
  }'
```

### Verificar se o middleware está sendo chamado:
Adicione este log no início do `authMiddleware.js`:
```javascript
console.log("🔐 Middleware auth chamado");
console.log("📋 Headers:", req.headers);
```

## 🎯 Resultado Esperado

Após as correções, ao fazer login você deve ver:
- ✅ Usuário com perfis populados
- ✅ `req.user.profileId` preenchido corretamente
- ✅ Criação de professor funcionando sem ID na URL

**Se ainda tiver problemas, me diga o que aparece nos logs!** 🚀