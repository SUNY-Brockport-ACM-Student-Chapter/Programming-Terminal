"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachWebSocketServer = attachWebSocketServer;
const ws_1 = require("ws");
const executor_1 = require("./executor");
const types_1 = require("./types");
// Adds WebSocket handling to an existing HTTP server
function attachWebSocketServer(server) {
    // Create a Websocket server attached to the HTTP
    const wss = new ws_1.WebSocketServer({ server, path: '/ws' });
    // Fires each time a new WebSocket client connects
    wss.on('connection', (ws) => {
        // Create a new ExecutionSession for this connection. Each user gets their own session
        const session = new executor_1.ExecutionSession(ws);
        // Fires each time the client sends a message
        ws.on('message', async (raw) => {
            let msg;
            try {
                // Parse the raw bytes/string as JSON to ClientMessage
                msg = JSON.parse(raw.toString());
            }
            catch {
                return;
            }
            // Route each message to the appropriate session method
            switch (msg.type) {
                case 'run':
                    // Validate the language before running
                    if (!types_1.LANGUAGES.includes(msg.language)) {
                        ws.send(JSON.stringify({ type: 'error', message: `Unknown language: ${msg.language}` }));
                        return;
                    }
                    // Start the execution. This is async so we await it
                    await session.run(msg.language, msg.files, msg.entryPoint);
                    break;
                case 'input':
                    // Forward the keystrokes to the running process's stdin
                    session.writeInput(msg.data);
                    break;
                case 'resize':
                    // Update the PTY dimensions to match the frontend terminal
                    session.resize(msg.cols, msg.rows);
                    break;
                case 'stop':
                    // Forcefully terminate the running process
                    await session.kill();
                    break;
            }
        });
        // Fires when the client disconnects
        ws.on('close', async () => { await session.kill(); });
        // Fires when a WebSocket error occurs
        ws.on('error', err => { console.error('[ws] error', err); });
    });
    console.log('[ws] WebSocket server attached at /ws');
}
//# sourceMappingURL=ws-handler.js.map