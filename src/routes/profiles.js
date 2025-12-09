import express from "express";
import {
  criarPerfil,
  listarPerfisPorUsuario,
  listarPerfisCriadosPorPerfil,
  atualizarPerfil,
  deletarPerfil,
  inicializarPerfilPrincipal,
  listarHistoricoPerfil,
  adicionarHistoricoPerfil,
  azureSincronizarAlunos,
  azureTreinarPersonGroup,
  azureStatusTreinamento,
  isentarVitalicioPerfil,
  listarProfessoresPorAcademia
} from "../controllers/profileController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Rotas de perfis

// Criar perfil vinculado (usa perfil autenticado como criador)
router.post("/criar", authMiddleware, criarPerfil);

// Criar perfil vinculado por ID do criador
router.post("/:criadorPerfilId/criar", authMiddleware, criarPerfil);

// Listar perfis do usuário (fallback para token)
router.get("/user/:userId", authMiddleware, listarPerfisPorUsuario);
// Fallback: permitir GET sem parâmetro e resolver userId pelo token
router.get("/user", authMiddleware, listarPerfisPorUsuario);

// Perfis criados por um perfil
router.get("/created-by/:criadorPerfilId", authMiddleware, listarPerfisCriadosPorPerfil);

// Inicializar perfil principal (professor/aluno)
router.post("/inicializar-principal", authMiddleware, inicializarPerfilPrincipal);

// Proteção: orientar uso de POST em /inicializar-principal
router.patch("/inicializar-principal", authMiddleware, (req, res) => {
  return res.status(405).json({
    mensagem: "Use POST em /api/perfis/inicializar-principal para inicializar o perfil.",
  });
});
router.get("/inicializar-principal", authMiddleware, (req, res) => {
  return res.status(405).json({
    mensagem: "Use POST em /api/perfis/inicializar-principal para inicializar o perfil.",
  });
});

// Atualizar perfil
router.patch("/:id", authMiddleware, atualizarPerfil);

router.post("/:id/isentar-vitalicio", authMiddleware, isentarVitalicioPerfil);

// Deletar perfil
router.delete("/:id", authMiddleware, deletarPerfil);

// Histórico de progressão (GET)
router.get("/:id/historico", authMiddleware, listarHistoricoPerfil);

// Histórico de progressão (POST)
router.post("/:id/historico", authMiddleware, adicionarHistoricoPerfil);

router.post("/azure/sincronizar-alunos", authMiddleware, azureSincronizarAlunos);
router.post("/azure/treinar", authMiddleware, azureTreinarPersonGroup);
router.get("/azure/status-treinamento", authMiddleware, azureStatusTreinamento);

// Listar professores por academia
router.get("/professores/academia/:academiaId", authMiddleware, listarProfessoresPorAcademia);

 
export default router;
