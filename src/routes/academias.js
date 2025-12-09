import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { listarAcademias, pesquisaAcademia, registrarAcademia, atualizarPlanoAcademia, obterReferralLinkGestor, obterStatusCapacidadeGestor } from '../controllers/academiaController.js';


const router = express.Router();

// 📍 Cadastrar nova academia
router.post('/registrar', authMiddleware, registrarAcademia)
  

// 🔍 Buscar academia por código
router.get('/codigo/:codigo', pesquisaAcademia)


// 📍 Listar todas academias (opcional, para testes)
router.get('/', listarAcademias)

router.get('/gestor/referral-link', authMiddleware, obterReferralLinkGestor)
router.get('/gestor/capacity-status', authMiddleware, obterStatusCapacidadeGestor)

// Atualizar plano da academia (basico/intermediario/avancado)
router.patch('/planos/:academiaId', authMiddleware, atualizarPlanoAcademia)

export default router;
