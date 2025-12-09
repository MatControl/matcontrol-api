import express from 'express'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { subscribe, health } from '../controllers/billingController.js'

const router = express.Router()

router.post('/subscribe', authMiddleware, subscribe)
router.get('/health', health)

export default router