import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { registrarGestor, loginUsuario } from '../controllers/authController.js';
import { registrarAcademia, obterMinhaAcademia } from '../controllers/academiaController.js';
import { listarModalidades, ativarModalidadesNaAcademia, listarModalidadesDaMinhaAcademia } from '../controllers/modalidadeController.js';
import { criarPlano, listarMeusPlanosGestor } from '../controllers/planoController.js';
import { criarPerfilProfessorParaGestor } from '../controllers/profileController.js';
import { criarCheckoutGestor } from '../controllers/paymentsMpController.js';

const router = express.Router();

router.post('/cadastro', registrarGestor);
router.post('/login', loginUsuario);

router.get('/academia', authMiddleware, obterMinhaAcademia);
router.post('/academia', authMiddleware, registrarAcademia);

router.get('/modalidades', authMiddleware, listarModalidadesDaMinhaAcademia);
router.get('/modalidades/base', authMiddleware, listarModalidades);
router.post('/modalidades/ativar', authMiddleware, ativarModalidadesNaAcademia);

router.post('/planos', authMiddleware, criarPlano);
router.get('/planos', authMiddleware, listarMeusPlanosGestor);

router.post('/professor', authMiddleware, criarPerfilProfessorParaGestor);

router.post('/checkout', authMiddleware, criarCheckoutGestor);

export default router;