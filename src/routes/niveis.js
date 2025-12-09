import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { listarNiveisPorModalidade, atualizarNivel } from '../controllers/nivelController.js';

const router = express.Router();

// 🔹 Listar níveis de uma modalidade
router.get('/:modalidadeId', authMiddleware, listarNiveisPorModalidade);

// 🔹 Atualizar um nível (somente gestor)
router.patch('/:id', authMiddleware, atualizarNivel);

export default router;
