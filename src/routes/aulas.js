import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import {
  gerarAulasSemanaPorTurma,
  listarAulasSemanaPorTurma,
  atualizarAula,
  confirmarPresenca,
  removerConfirmacao,
  listarMinhasAulasSemana,
  gerarAulasSemanaPorAcademia,
  listarAulasSemanaPorAcademia,
  chamadaAutomaticaPorFoto,
} from '../controllers/aulaController.js';

const router = express.Router();

// Gerar aulas da semana para uma turma
router.post('/turmas/:turmaId/gerar-semana', authMiddleware, gerarAulasSemanaPorTurma);

// Listar aulas da semana por turma
router.get('/turmas/:turmaId/semana', authMiddleware, listarAulasSemanaPorTurma);

// Listar minhas aulas da semana (professor/aluno)
router.get('/minhas/semana', authMiddleware, listarMinhasAulasSemana);

// Editar/cancelar aula (professor/gestor)
router.patch('/:aulaId', authMiddleware, atualizarAula);

// RSVP (aluno)
router.post('/:aulaId/confirmar', authMiddleware, confirmarPresenca);
router.delete('/:aulaId/confirmar', authMiddleware, removerConfirmacao);

// Chamada automática por foto (professor/gestor)
router.post('/:aulaId/chamada-automatica', authMiddleware, chamadaAutomaticaPorFoto);

// Gerar aulas para todas turmas da academia (gestor)
router.post('/academias/:academiaId/gerar-semana', authMiddleware, gerarAulasSemanaPorAcademia);

// Listar aulas da semana por academia (gestor)
router.get('/academias/:academiaId/semana', authMiddleware, listarAulasSemanaPorAcademia);

export default router;