import express from "express";
import { authMiddleware } from '../middlewares/authMiddleware.js';
import {
  criarPlano,
  listarPlanosPorAcademia,
  atualizarPlano,
  deletarPlano,
} from "../controllers/planoController.js";


const router = express.Router();

router.post("/", authMiddleware, criarPlano);
router.get("/academia/:academiaId", authMiddleware, listarPlanosPorAcademia);
router.patch("/:id", authMiddleware, atualizarPlano);
router.delete("/:id", authMiddleware, deletarPlano);

export default router;