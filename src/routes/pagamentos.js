import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { criarCheckoutGestor, criarCheckoutAluno, configurarStripeAcademia, conectarStripeAcademia, criarPagamento, criarCheckoutAssinaturaAluno, listarPagamentosPorAcademia, listarPagamentosPorAluno, isentarMensalidadeAluno, listarPrecosPlataforma, statusConfigAcademia, obterMpPublicKey, criarPagamentoGestorCheckoutApi, criarAssinaturaGestorCartao } from "../controllers/paymentsMpController.js";

const router = express.Router();
// Rotas de pagamentos: checkout/assinatura, configuração Stripe e consultas

// Inicia checkout de assinatura da plataforma para o gestor
// Autenticação: exige token de gestor; usa priceId ou STRIPE_PLATFORM_PRICE_ID
router.post("/gestor/checkout", authMiddleware, criarCheckoutGestor);

// Inicia checkout do plano da academia para o aluno (Stripe Connect)
// Autenticação: exige token de aluno; usa Plano.stripePriceId e transfere receita para a academia
router.post("/aluno/checkout", authMiddleware, criarCheckoutAluno);

// Cria assinatura do aluno com suporte a cupom/trial
// Observação: stripeSubscriptionId é persistido via webhook checkout.session.completed
router.post("/aluno/assinatura", authMiddleware, criarCheckoutAssinaturaAluno);

// Configura stripeAccountId da academia (Stripe Connect)
// Autenticação: exige token de gestor vinculado à academia
router.patch("/academias/:academiaId/stripe", authMiddleware, configurarStripeAcademia);

// Cria conta Stripe Connect Express e retorna link de onboarding
// Autenticação: exige token de gestor vinculado à academia
router.post("/academias/:id/stripe/connect", authMiddleware, conectarStripeAcademia);

// Cria PaymentIntent direto para a academia
// Body: valor (BRL), academiaId; retorna client_secret e registra Pagamento pendente
router.post("/criar", authMiddleware, criarPagamento);

// Lista pagamentos da academia (somente gestor da academia)
router.get("/academias/:academiaId", authMiddleware, listarPagamentosPorAcademia);

// Lista pagamentos do aluno (próprio aluno ou gestor da academia do aluno)
router.get("/alunos/:alunoId", authMiddleware, listarPagamentosPorAluno);

// Registra isenção de mensalidade (valor 0) para aluno da academia
// Autenticação: gestor da academia; body: alunoId, motivo opcional, mesReferencia opcional
router.post("/academias/:academiaId/isentar", authMiddleware, isentarMensalidadeAluno);

router.get("/plataforma/precos", authMiddleware, listarPrecosPlataforma);
router.get("/academias/:academiaId/config", authMiddleware, statusConfigAcademia);
router.get("/mp/public-key", obterMpPublicKey);
router.post("/gestor/pagamento", authMiddleware, criarPagamentoGestorCheckoutApi);
router.post("/gestor/assinatura", authMiddleware, criarAssinaturaGestorCartao);

export default router;
