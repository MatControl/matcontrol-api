# 🧪 Teste Completo - Criação de Professor por Gestor

## ✅ Agora com Correção do Profile ID

### 📋 Passo a Passo para Testar

#### 1️⃣ Primeiro: Faça Login e Obtenha o Token
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "email_do_gestor@exemplo.com",
    "password": "senha_do_gestor"
  }'
```

**Resposta esperada:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "id_do_usuario"
}
```

#### 2️⃣ Teste 1: Forma Simples (Sem ID na URL) ✅
```bash
curl -X POST http://localhost:3000/api/profiles/criar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "tipo": "professor",
    "telefone": "11999999999"
  }'
```

#### 3️⃣ Teste 2: Forma com ID na URL ✅
```bash
curl -X POST http://localhost:3000/api/profiles/ID_DO_PERFIL_GESTOR/criar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "tipo": "professor",
    "telefone": "11999999999"
  }'
```

### 🔍 Como Descobrir seu Profile ID

#### Opção A: Via Login (Automático)
O sistema agora pega automaticamente o primeiro perfil do usuário logado.

#### Opção B: Consultar seus Perfis
```bash
curl -X GET http://localhost:3000/api/profiles/user/SEU_USER_ID \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### 📊 Respostas Esperadas

#### ✅ Sucesso (201 Created)
```json
{
  "message": "Perfil criado com sucesso.",
  "perfil": {
    "_id": "id_do_novo_professor",
    "nome": "Nome do Gestor",
    "tipo": "professor",
    "userId": "id_do_usuario",
    "academiaId": "id_da_academia_do_gestor",
    "telefone": "11999999999",
    ...
  }
}
```

#### ❌ Erros Comuns

**401 Unauthorized**
```json
{ "mensagem": "Token não fornecido." }
```

**404 Not Found - Criador não encontrado**
```json
{ "message": "Criador do perfil não encontrado." }
```

**400 Bad Request - Gestor sem academia**
```json
{ "message": "Gestor deve ter uma academia associada para criar professores." }
```

**403 Forbidden - Sem permissão**
```json
{ "message": "Perfis do tipo "aluno" não podem criar perfis do tipo "professor"." }
```

### 🎯 Funcionalidades Automáticas

#### ✅ Herança de Academia
O professor criado **automaticamente herda** a academia do gestor.

#### ✅ Herança de Nome
O professor criado **automaticamente herda** o nome do gestor.

#### ✅ Validações Automáticas
- Gestor deve ter academia associada
- Não permite criar professor com academia diferente
- Verifica permissões do criador
- Impede duplicação de perfis

### 🚀 Teste Rápido no Postman

1. **URL:** `POST http://localhost:3000/api/profiles/criar`
2. **Headers:**
   - `Content-Type: application/json`
   - `Authorization: Bearer SEU_TOKEN`
3. **Body:**
```json
{
  "tipo": "professor",
  "telefone": "11999999999"
}
```

### 📌 Observações Importantes

- **Não é necessário** enviar `nome` ou `academiaId` - são herdados automaticamente
- **O token JWT** deve estar válido e conter um perfil associado
- **O gestor** deve ter uma academia vinculada ao seu perfil
- **Funciona com qualquer perfil** que tenha permissão (gestor, professor, aluno para dependentes)

**✅ Agora o sistema está completo e funcionando corretamente!**