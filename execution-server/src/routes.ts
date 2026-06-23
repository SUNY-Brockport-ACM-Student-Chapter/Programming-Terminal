import { Router } from 'express'
import { containerPool } from './pool'

const router = Router()

// GET /api/health returns the current pool status
router.get('/health', (_req, res) =>{
    res.json({status: 'ok', pool: containerPool.status() })
})

// GET /api/recover returns whether the the pool is healthy or if there was a crash attempts to recover from it
router.get('/recover', async(_req, res) => {
    const status = containerPool.status()
    const needed = 5 - status.total
    if(needed <= 0){
        res.json({message: 'Pool is healthy', status})
        return
    }
    await containerPool.init()
    res.json({message: `Recovering from pool crash. Spawning ${needed} containers `, status: containerPool.status()})
})

export default router