import Dockerode from 'dockerode'
import {EventEmitter} from 'events'
import { v4 as uuidv4 } from 'uuid'
import { RUNNER_IMAGE} from './types'

const docker = new Dockerode()
const POOL_SIZE = parseInt(process.env.POOL_SIZE ?? '5', 10)

type ContainerState = 'warming' | 'ready' | 'in-use'

interface PooledContainer{
    poolId: string
    dockerId: string
    state: ContainerState
    createdAt: Date
}

class ContainerPool extends EventEmitter {
    private pool: Map<string, PooledContainer> = new Map()
    private waitQueue: Array<(c: PooledContainer) => void> = []
    private initialized = false

    async init(): Promise<void>{
        if(this.initialized) return
        console.log('[pool] Initializing - ${POOL_SIZE} containers')
        await this.cleanupStaleManagedContainers()
        await Promise.all(Array.from({length: POOL_SIZE}, () => this.spawnContainer()))
        this.initialized = true
        console.log('[pool] Initialization complete. ${this.pool.size} containers warmed')
    }

    async aquire(): Promise<PooledContainer>{
        const ready = [...this.pool.values()].find(e=> e.state === 'ready')
        if(ready){
            ready.state = 'in-use'
            return ready
        }
        return new Promise(resolve => this.waitQueue.push(resolve))
    }

    async realease(poolId:string): Promise<void>{
        const entry = this.pool.get(poolId)
        if(!entry) return
        this.pool.delete(poolId)
        this.destroyContainer(entry.dockerId).catch(err =>
            console.error('[pool] Replenish error:', err)
        )
    }

    status(): {total: number; ready: number; inUse:number; warming: number}{
        let ready = 0, inUse = 0, warming = 0
        for(const e of this.pool.values()){
            if(e.state === 'ready') ready++
            if(e.state === 'in-use') inUse++
            if(e.state === 'warming') warming++
        }
        return {total: this.pool.size, ready, inUse, warming}
    }

    async shutdown(): Promise<void>{
        console.log('[pool] Shutting down. Destroying all managed containers')
        await Promise.allSettled(
            [...this.pool.values()].map(e => this.destroyContainer(e.dockerId))
        )
        this.pool.clear()
    }

    private async spawnContainer(): Promise<void> {
        const poolId = uuidv4()
        const entry: PooledContainer = {
            poolId, dockerId: '', state: 'warming', createdAt: new Date(), 
        }
        this.pool.set(poolId, entry)

        try{
            const container = await docker.createContainer({
                Image: RUNNER_IMAGE,
                Tty: true,
                OpenStdin: true,
                Labels: {'programming.managed': 'true'},
                HostConfig:{
                    Memory: 256 * 1024 * 1024, // 256MB
                    CpuPeriod: 100_000, // 100ms
                    CpuQuota: 50_000, // 50% of a CPU
                    NetworkMode: 'none',
                    AutoRemove: false, // We'll remove manually to ensure cleanup
                },
            })
            await container.start()
            entry.dockerId = container.id
            entry.state = 'ready'

            if(this.waitQueue. length > 0){
                const resolve = this.waitQueue.shift()!
                entry.state = 'in-use'
                resolve(entry)
            }
        } catch(err){
            console.log('[pool] Failed to spawn container. Retrying in 5 seconds:', err)
            this.pool.delete(poolId)

            setTimeout(() =>{
                this.spawnContainer().catch(e=>
                    console.error('[pool] Retry to spawn containers in the pool failed', e)
                )
            }, 5000)
        }
        }

    private async destroyContainer(dockerId: string): Promise<void>{
        if(!dockerId) return
        try{
            const c = docker.getContainer(dockerId)
            await c.stop({t:0}).catch(() => {})
            await c.remove({ force: true})
        } catch { /* already gone */}
    }

    private async cleanupStaleManagedContainers(): Promise<void> {
        try{
            const stale = await docker.listContainers({
                all: true,
                filters: JSON.stringify({label: ['programming.managed=true']}),
            })
            await Promise.all(
                stale.map(c => docker.getContainer(c.Id).remove({force: true}).catch(() => {}))
            )
            if(stale.length > 0)
                console.log('[pool] Cleaned up ${stale.length} stale containers')
        } catch(err){
            console.warn('[pool] Could not clean stale containers:', err)
        }
    }

}

export const containerPool = new ContainerPool()