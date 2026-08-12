"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.containerPool = void 0;
const dockerode_1 = __importDefault(require("dockerode"));
const events_1 = require("events");
const uuid_1 = require("uuid");
const types_1 = require("./types");
const docker = new dockerode_1.default();
const POOL_SIZE = parseInt(process.env.POOL_SIZE ?? '5', 10); // 5 is the fallback size, 10 is base 10 (decimal, type of value we want)
class ContainerPool extends events_1.EventEmitter {
    pool = new Map();
    waitQueue = [];
    initialized = false;
    // Initialize the pool
    async init() {
        if (this.initialized)
            return;
        console.log(`[pool] Initializing - ${POOL_SIZE} containers`);
        await this.cleanupStaleManagedContainers();
        await Promise.all(Array.from({ length: POOL_SIZE }, () => this.spawnContainer()));
        this.initialized = true;
        console.log(`[pool] Initialization complete. ${this.pool.size} containers warmed`);
    }
    // Returns a ready container or waits until one is available
    async aquire() {
        const ready = [...this.pool.values()].find(e => e.state === 'ready');
        if (ready) {
            ready.state = 'in-use';
            return ready;
        }
        return new Promise(resolve => this.waitQueue.push(resolve));
    }
    // Remove used contianer from the pool and create a replacement
    async realease(poolId) {
        const entry = this.pool.get(poolId);
        if (!entry)
            return;
        this.pool.delete(poolId);
        this.destroyContainer(entry.dockerId).catch(err => console.error('[pool] Replenish error:', err));
        this.spawnContainer().catch(err => {
            console.error('[pool] replenish error: ', err);
        });
    }
    // Returns a snapshot of the current pool state
    status() {
        let ready = 0, inUse = 0, warming = 0;
        for (const e of this.pool.values()) {
            if (e.state === 'ready')
                ready++;
            if (e.state === 'in-use')
                inUse++;
            if (e.state === 'warming')
                warming++;
        }
        return { total: this.pool.size, ready, inUse, warming };
    }
    // Destroy all containers when the server stops
    async shutdown() {
        console.log('[pool] Shutting down. Destroying all managed containers');
        await Promise.allSettled([...this.pool.values()].map(e => this.destroyContainer(e.dockerId)));
        this.pool.clear();
    }
    // Create a new container and add it to the pool
    async spawnContainer() {
        const poolId = (0, uuid_1.v4)();
        // Reserve a slot in the pool
        const entry = {
            poolId, dockerId: '', state: 'warming', createdAt: new Date(),
        };
        // Add to the pool
        this.pool.set(poolId, entry);
        try {
            // Create a container with our configuration
            const container = await docker.createContainer({
                Image: types_1.RUNNER_IMAGE,
                Tty: true,
                OpenStdin: true,
                Labels: { 'programming.managed': 'true' },
                HostConfig: {
                    Memory: 256 * 1024 * 1024, // 256MB
                    CpuPeriod: 100_000, // 100ms
                    CpuQuota: 50_000, // 50% of a CPU
                    NetworkMode: 'none', // Network access is disabled
                    AutoRemove: false, // We'll remove the container manually to ensure cleanup
                },
            });
            await container.start();
            entry.dockerId = container.id;
            entry.state = 'ready';
            // If a user is waiting for a container, hand it to them instead of placing in the pool
            if (this.waitQueue.length > 0) {
                const resolve = this.waitQueue.shift();
                entry.state = 'in-use';
                resolve(entry);
            }
        }
        catch (err) {
            console.log('[pool] Failed to spawn container. Retrying in 5 seconds:', err);
            this.pool.delete(poolId);
            setTimeout(() => {
                this.spawnContainer().catch(e => console.error('[pool] Retry to spawn containers in the pool failed', e));
            }, 5000);
        }
    }
    // Forcefully stops and removes a container
    async destroyContainer(dockerId) {
        if (!dockerId)
            return;
        try {
            const c = docker.getContainer(dockerId);
            await c.stop({ t: 0 }).catch(() => { });
            await c.remove({ force: true });
        }
        catch { /* already gone */ }
    }
    // Removes containers from previous server runs
    async cleanupStaleManagedContainers() {
        try {
            const stale = await docker.listContainers({
                all: true,
                filters: JSON.stringify({ label: ['programming.managed=true'] }),
            });
            await Promise.all(stale.map(c => docker.getContainer(c.Id).remove({ force: true }).catch(() => { })));
            if (stale.length > 0)
                console.log(`[pool] Cleaned up ${stale.length} stale containers`);
        }
        catch (err) {
            console.warn('[pool] Could not clean stale containers:', err);
        }
    }
}
// A single instance of the pool will be used to manage the containers
exports.containerPool = new ContainerPool();
//# sourceMappingURL=pool.js.map