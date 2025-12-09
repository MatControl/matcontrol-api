import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import {
  registrarGestor,
  registrarProfessor,
  registrarAluno,
  registrarResponsavel,
  loginUsuario,
  obterUsuario
} from '../controllers/authController.js';

const router = express.Router();

router.post('/registrar-gestor', registrarGestor);
router.post('/registrar-professor', registrarProfessor);
router.post('/registrar-aluno', registrarAluno);
router.post('/registrar-responsavel', registrarResponsavel);
router.post('/login', loginUsuario);

// 👤 Obter dados do usuário logado (precisa de token JWT)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const usuario = await obterUsuario(req.user.id);
    res.json(usuario); // retorna todos os dados do gestor autenticado
  } catch (erro) {
    res.status(500).json({ mensagem: 'Erro ao buscar usuário.', erro: erro.message });
  }
});


export default router;
