"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("./pool");
const router = (0, express_1.Router)();
// GET /api/health returns the current pool status
router.get('/health', (_req, res) => {
    res.json({ status: 'ok', pool: pool_1.containerPool.status() });
});
// GET /api/recover returns whether the the pool is healthy or if there was a crash attempts to recover from it
router.get('/recover', async (_req, res) => {
    const status = pool_1.containerPool.status();
    const needed = 5 - status.total;
    if (needed <= 0) {
        res.json({ message: 'Pool is healthy', status });
        return;
    }
    await pool_1.containerPool.init();
    res.json({ message: `Recovering from pool crash. Spawning ${needed} containers `, status: pool_1.containerPool.status() });
});
exports.default = router;
//# sourceMappingURL=routes.js.map