# 🎯 Exemplo de Uso - Sistema de Responsáveis e Dependentes

## 📋 Fluxo Completo: Pai/Mãe Criando Perfil de Filho

### 1. Primeiro, o responsável precisa se registrar para login
```http
POST /api/auth/registrar-responsavel
Content-Type: application/json

{
  "nome": "João Silva (Pai)",
  "email": "joao.silva@email.com",
  "senha": "senha123"
}
```

### 1.1 Login do Responsável
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "joao.silva@email.com",
  "senha": "senha123"
}
```

### 2. Criar Perfil de Dependente (Filho)
```http
POST /api/dependentes
Content-Type: application/json
Authorization: Bearer <token_do_pai>

{
  "nome": "Pedro Silva",
  "nascimento": "2015-03-15",
  "academiaId": "<id_da_academia>",
  "modalidadeId": "<id_da_modalidade>",
  "contatoResponsavel": {
    "nome": "João Silva",
    "telefone": "(11) 98765-4321",
    "email": "joao.silva@email.com",
    "parentesco": "pai"
  }
}
```

### 3. Listar Meus Dependentes
```http
GET /api/dependentes
Authorization: Bearer <token_do_pai>
```

### 4. Atualizar Dependente
```http
PUT /api/dependentes/<id_dependente>
Content-Type: application/json
Authorization: Bearer <token_do_pai>

{
  "nome": "Pedro Silva Santos",
  "contatoResponsavel": {
    "telefone": "(11) 91234-5678"
  }
}
```

### 5. Obter Detalhes de um Dependente
```http
GET /api/dependentes/<id_dependente>
Authorization: Bearer <token_do_pai>
```

### 6. Excluir Dependente
```http
DELETE /api/dependentes/<id_dependente>
Authorization: Bearer <token_do_pai>
```

## 📱 Exemplo de Resposta

```json
{
  "success": true,
  "message": "Dependente criado com sucesso",
  "data": {
    "_id": "657f1a2b3c4d5e6f7g8h9i0j",
    "nome": "Pedro Silva",
    "tipo": "dependente",
    "nascimento": "2015-03-15T00:00:00.000Z",
    "academiaId": {
      "_id": "657f1a2b3c4d5e6f7g8h9i0k",
      "nome": "Academia Central de Jiu-Jitsu",
      "endereco": "Rua das Flores, 123"
    },
    "modalidadeId": {
      "_id": "657f1a2b3c4d5e6f7g8h9i0l",
      "nome": "Jiu-Jitsu",
      "descricao": "Arte marcial brasileira"
    },
    "contatoResponsavel": {
      "nome": "João Silva",
      "telefone": "(11) 98765-4321",
      "email": "joao.silva@email.com",
      "parentesco": "pai"
    },
    "statusTreino": "ativo",
    "responsavelId": "657f1a2b3c4d5e6f7g8h9i0m"
  }
}
```

## 🎯 Benefícios do Sistema

✅ **Facilidade para Pais**: Pais que não treinam podem gerenciar perfis dos filhos
✅ **Contato Direto**: Professores têm acesso às informações de contato dos responsáveis
✅ **Segurança**: Apenas o responsável pode criar/editar/excluir dependentes
✅ **Organização**: Cada dependente vinculado ao responsável correto
✅ **Flexibilidade**: Suporta diferentes tipos de parentesco (pai, mãe, avô, tio, etc.)

## 🔒 Permissões

- **Responsável**: Pode criar, listar, atualizar e excluir SEUS dependentes
- **Professor/Gestor**: Pode visualizar dependentes e contatar responsáveis
- **Aluno**: Pode criar dependentes (se for pai/mãe que também treina)

## 📞 Informações de Contato

Os professores podem acessar:
- Nome do responsável
- Telefone para contato
- Email (opcional)
- Parentesco com o aluno dependente