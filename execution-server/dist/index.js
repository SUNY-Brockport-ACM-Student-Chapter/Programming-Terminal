"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
const ws_handler_1 = require("./ws-handler");
const pool_1 = require("./pool");
// Read the port from the enviroment variables, default to 3001
const PORT = parseInt(process.env.PORT ?? '3001', 10);
// Parse the CORS_ORIGIN env variable into an array of allowed origins
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? '').split(',').map(s => s.trim());
// Create Express application
const app = (0, express_1.default)();
// Register CORS middleware
app.use((0, cors_1.default)({ origin: CORS_ORIGINS }));
// Register JSON body parsing middleware
app.use(express_1.default.json());
// Mount our routes at the '/api' prefix
app.use('/api', routes_1.default);
// Create the HTTP server wrapping the express app. WebSocketServer needs to be attached to a Server instance, not an Express app
const server = http_1.default.createServer(app);
// Attach the Websocket server to the same HTTP server. 
(0, ws_handler_1.attachWebSocketServer)(server);
// main is async so we can await at the top level
async function main() {
    // Initialize the container pool
    await pool_1.containerPool.init();
    // Start listening for incoming connections on the specified port
    server.listen(PORT, () => console.log(`[server] Execution backend listening on :${PORT}`));
}
// Shutdown handler
const shutdown = async () => {
    // Destroy all managed containers
    await pool_1.containerPool.shutdown();
    // Exit with code 0 to signal that shutdown was not the result of an error
    process.exit(0);
};
// Register the shutdown handler for both signals
process.on('SIGTERM', shutdown); // SIGTERM is sent by process managers (Docker) when stopping the server
process.on('SIGINT', shutdown); // SIGINT is sent when Ctrl+C is pressed in the terminal
// Register any rejections
process.on('unhandledRejection', (reason) => {
    console.error('[server] Unhandled rejection', reason);
});
// Register any exceptions
process.on('uncaughtException', (err) => {
    console.error('[server] Uncaught exception', err);
});
// Call main and handle any startup errors
main().catch(err => { console.error('[server] Fatal:', err); process.exit(1); });
//# sourceMappingURL=index.js.map