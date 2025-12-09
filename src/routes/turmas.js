import express from 'express'
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { codigoConvite, criarTurma, listarTurmasPorAcademia, listarMinhasTurmasProfessor } from '../controllers/turmaController.js';

const router = express.Router()

// Criar turma (somente gestor)
router.post('/', authMiddleware, criarTurma)


// Aluno entra na turma via link/código de convite
router.post('/entrar', authMiddleware, codigoConvite)

// Listar turmas da academia (gestor)
router.get('/academia/:academiaId', authMiddleware, listarTurmasPorAcademia)

// Listar turmas vinculadas ao professor
router.get('/minhas', authMiddleware, listarMinhasTurmasProfessor)


export default router
