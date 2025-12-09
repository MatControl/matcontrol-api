import mongoose from "mongoose";

const ProfileSchema = new mongoose.Schema(
  {
    // 🔗 Referência ao usuário base (login)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 👤 Nome completo (vem do user, mas armazenamos para buscas rápidas)
    nome: {
      type: String,
      required: true,
      trim: true,
    },

    // 🧩 Tipo de perfil: "aluno", "professor", "gestor" ou "dependente"
    // -> usado para definir permissões de criação de outros perfis
    tipo: {
      type: String,
      required: true,
      enum: ["aluno", "professor", "gestor", "dependente", "responsavel"],
    },

    // 👨‍👩‍👧‍👦 Vincula dependentes (filhos) ao responsável (pai)
    // -> se o perfil for principal (gestor/professor/aluno), fica null
    // -> se for dependente, guarda o _id do perfil responsável
    responsavelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
      default: null,
    },

    // 🏫 Associação com academia (para aluno ou professor)
    academiaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academia",
      default: null,
    },

    

    // ⚔️ Modalidade do professor (ex: Jiu-Jitsu, Judô, Muay Thai)
    modalidadeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Modalidade",
      default: null,
    },

    // 🥋 Faixa atual (referência ao nível)
    faixaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nivel",
      default: null,
    },

    // 🔢 Número de graus (0 a 6 geralmente no Jiu-Jitsu)
    graus: {
      type: Number,
      default: 0,
      min: 0,
    },

    pretaDataReferencia: {
      type: Date,
      default: null,
    },

    // 📚 Aulas acumuladas no nível atual (desde o início da faixa)
    aulasNoNivelAtual: {
      type: Number,
      default: 0,
      min: 0,
    },

    // 📅 Data do último grau recebido (quando aplicável)
    dataUltimoGrau: {
      type: Date,
      default: null,
    },

    // 📅 Data de nascimento
    nascimento: {
      type: Date,
      required: false,
    },

    // ☎️ Telefone de contato
    telefone: {
      type: String,
      required: false,
      trim: true,
    },

    fotoUrl: {
      type: String,
      default: null,
      trim: true,
    },

    azurePersonId: {
      type: String,
      default: null,
      trim: true,
    },

    azurePersistedFaces: {
      type: [String],
      default: [],
    },

    // 👤 Sexo biológico (para categorias de peso IBJJF)
    sexo: {
      type: String,
      enum: ["masculino", "feminino"],
      default: null,
    },

    // ⚖️ Peso corporal (kg)
    peso: {
      type: Number,
      required: false,
      min: 0,
      default: null,
    },

    // 🏷️ Categoria de peso (IBJJF Adult Gi)
    categoriaPeso: {
      type: String,
      required: false,
      default: null,
      trim: true,
    },

    // ⚙️ Status de treino (para alunos/professores)
    statusTreino: {
      type: String,
      enum: ["ativo", "inativo", "suspenso"],
      default: "ativo",
    },

    isentoVitalicio: {
      type: Boolean,
      default: false,
    },

    ultimaPresencaEm: {
      type: Date,
      default: null,
    },

    cobrancaPausada: {
      type: Boolean,
      default: false,
    },

    motivoCobrancaPausada: {
      type: String,
      default: null,
      trim: true,
    },

    cobrancaPausadaEm: {
      type: Date,
      default: null,
    },

    // 📆 Data de início no treino
    dataInicioTreino: {
      type: Date,
      default: Date.now,
    },

    // 📆 Data de início da faixa atual (para requisitos mínimos de tempo por faixa)
    dataInicioFaixa: {
      type: Date,
      default: null,
    },

    // 🧭 Histórico de progressão (faixas e graus)
    // Permite registrar eventos como início do treino, início de faixa, grau recebido e graduação
    historicoProgresso: [
      new mongoose.Schema(
        {
          tipo: {
            type: String,
            enum: ["inicio_treino", "inicio_faixa", "grau", "graduacao"],
            required: true,
          },
          data: { type: Date, required: true },
          faixaId: { type: mongoose.Schema.Types.ObjectId, ref: "Nivel", default: null },
          grauNumero: { type: Number, default: null },
          origem: { type: String, enum: ["auto", "manual"], default: "auto" },
          observacao: { type: String, trim: true, default: null },
        },
        { _id: false }
      ),
    ],

    // 👶 Dependentes (virtual — não armazenado diretamente)
    dependentes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Profile",
      },
    ],

    // 📞 Informações de contato do responsável (para dependentes)
    // Usado quando o professor precisa entrar em contato sobre o dependente
    contatoResponsavel: {
      nome: {
        type: String,
        trim: true,
        default: null,
      },
      telefone: {
        type: String,
        trim: true,
        default: null,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: null,
      },
      parentesco: {
        type: String,
        enum: ["pai", "mae", "avo", "tio", "outro"],
        default: null,
      },
    },

    // 🕒 Data de criação
    criadoEm: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // cria createdAt e updatedAt automaticamente
  }
);

// ✅ Virtual para listar dependentes automaticamente
ProfileSchema.virtual("filhos", {
  ref: "Profile",
  localField: "_id",
  foreignField: "responsavelId",
});

// 🔄 Inclui virtuais quando usar .toJSON() ou .toObject()
ProfileSchema.set("toJSON", { virtuals: true });
ProfileSchema.set("toObject", { virtuals: true });

export default mongoose.model("Profile", ProfileSchema);
