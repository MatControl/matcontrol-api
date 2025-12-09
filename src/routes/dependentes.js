import express from "express";
import {authMiddleware} from "../middlewares/authMiddleware.js";
import {
  criarDependente,
  listarMeusDependentes,
  atualizarDependente,
  excluirDependente,
  obterDependente
} from "../controllers/dependenteController.js";

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Rotas para gerenciamento de dependentes
router.post("/", criarDependente); // Criar novo dependente
router.get("/", listarMeusDependentes); // Listar todos os dependentes do responsável logado
router.get("/:dependenteId", obterDependente); // Obter detalhes de um dependente específico
router.put("/:dependenteId", atualizarDependente); // Atualizar dependente
router.delete("/:dependenteId", excluirDependente); // Excluir dependente

export default router;