import { Router } from 'express'
import { containerPool } from './pool.js'

const router = Router()

router.get('/health', (_req, res) =>{
    res.json({status: 'ok', pool: containerPool.status() })
})

export default router