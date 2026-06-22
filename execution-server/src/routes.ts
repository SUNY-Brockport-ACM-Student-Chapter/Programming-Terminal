import { Router } from 'express'
import { containerPool } from './pool'

const router = Router()

router.get('/health', (_req, res) =>{
    res.json({status: 'ok', pool: containerPool.status() })
})

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