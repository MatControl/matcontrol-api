import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import {
  listarModalidades,
  ativarModalidadesNaAcademia,
  listarModalidadesDaMinhaAcademia,
  removerModalidadeDaMinhaAcademia,
} from '../controllers/modalidadeController.js';

const router = express.Router();

router.get('/base', authMiddleware, listarModalidades);
router.post('/ativar', authMiddleware, ativarModalidadesNaAcademia);

// Listar modalidades ativas da academia resolvida pelo token
router.get('/minhas', authMiddleware, listarModalidadesDaMinhaAcademia);

// Remover uma modalidade ativa da academia do gestor
router.delete('/minhas/:modalidadeId', authMiddleware, removerModalidadeDaMinhaAcademia);

export default router;
