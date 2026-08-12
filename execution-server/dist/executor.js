"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionSession = void 0;
const dockerode_1 = __importDefault(require("dockerode"));
const pty = __importStar(require("node-pty"));
const tar = __importStar(require("tar-stream"));
const ws_1 = require("ws");
const pool_1 = require("./pool");
const types_1 = require("./types");
const docker = new dockerode_1.default;
const MAX_EXECUTION_MS = parseInt(process.env.MAX_EXECUTION_TIME ?? '15000', 10); // This timeout kills an infinite loop
console.log(`[executor] Timeout set to ${MAX_EXECUTION_MS}ms`); // this is for testing timeout, remove once finished
// Represents a user's run session. Each Websocket gets its own ExecutionSession instance
class ExecutionSession {
    ws;
    poolId = '';
    ptyProc = null;
    stopped = false;
    timeoutId = null;
    containerRef = null;
    // Websocket connection to the frontend
    constructor(ws) {
        this.ws = ws;
    }
    // Run is called when the frontend signals that a user has hit the run button
    async run(language, files, entryPoint) {
        // Prevent starting a new session if a session is already active
        if (this.ptyProc) {
            this.send({ type: 'error', message: 'Already running. Stop it first.' });
            return;
        }
        // Acquire container from the pool
        let container;
        let containerId = '';
        try {
            const entry = await pool_1.containerPool.aquire();
            // Store poolId so we can release this container when done
            this.poolId = entry.poolId;
            // Get a reference to Dockerode container handle
            container = docker.getContainer(entry.dockerId);
            containerId = entry.dockerId;
            this.containerRef = container;
        }
        catch {
            this.send({ type: 'error', message: 'No container available. Try again.' });
            return;
        }
        // Copy source file into the container
        try {
            for (const file of files) {
                await copyFile(container, file.filename, file.content);
            }
        }
        catch (err) {
            this.send({ type: 'error', message: `Failed to copy code: ${err}` });
            await pool_1.containerPool.realease(this.poolId);
            this.poolId = '';
            return;
        }
        // Spawn the PTY via docker exec 
        const [bin, ...args] = types_1.LANGUAGE_RUN_COMMANDS[language](entryPoint);
        // Notify the frontend that execution is about to start
        this.send({ type: 'ready' });
        this.stopped = false;
        try {
            // Create pseudo-terminal and run commands inside it
            this.ptyProc = pty.spawn('docker', ['exec', '-it', container.id, bin, ...args], {
                name: 'xterm-256color', // 256-color ANSI support 
                cols: 80, rows: 24, // Initialize terminal dimensions 
                cwd: process.cwd(), // sets working directory for node-pty process on the HOST
                env: process.env, // pass host environment variables to the docker process
            });
        }
        catch (err) {
            this.send({ type: 'error', message: `Failed to start process: ${err}` });
            await pool_1.containerPool.realease(this.poolId);
            this.poolId = '';
            return;
        }
        // Stream PTY output to the frontend. This fires whenever the running process writes to its stdout or stderr
        this.ptyProc.onData((data) => {
            try {
                // Only forward output if we haven't killed the process 
                if (!this.stopped)
                    this.send({ type: 'output', data });
            }
            catch (err) {
                console.error('[executor] Error sending output', err);
            }
        });
        // Handles process exit. Fires when the docker exec process terminates.
        this.ptyProc.onExit(async ({ exitCode }) => {
            // Cancel the safety timeout since the process ended
            this.clearTimeout();
            // Only send the exit message if we didn't stop the process ourselves
            if (!this.stopped)
                this.send({ type: 'exit', code: exitCode });
            // Release the container back to the pool and clear the session
            await this.cleanup();
        });
        // Safety timeout for infinite loops or a program that runs for too long
        this.timeoutId = setTimeout(() => {
            // Alert the user that they have reached max session time
            this.send({ type: 'output', data: '\r\n[Execution time limit reached]\r\n' });
            // Kill the process
            this.kill();
        }, MAX_EXECUTION_MS);
    }
    // Forwards keystrokes from the terminal to the running process's stdin
    writeInput(data) { this.ptyProc?.write(data); }
    // Updates the PTY dimensions when the frontend terminal is resized 
    resize(cols, rows) { this.ptyProc?.resize(cols, rows); }
    // Forcefully terminate the running process
    async kill() {
        this.stopped = true;
        this.clearTimeout();
        try {
            // Send SIGKILL to the docker exec process, which terminates the program
            this.ptyProc?.kill();
        }
        catch { }
        // Clear the PTY reference 
        this.ptyProc = null;
        // Notify the frontend that the process was stopped
        this.send({ type: 'exit', code: null });
        // Kill all processes inside the container via docker exec
        if (this.containerRef) {
            try {
                const exec = await this.containerRef.exec({
                    Cmd: ['pkill', '-9', '-f', '/code/'], // kills any process whose command containes /code/
                    AttachStdout: false,
                    AttachStderr: false,
                });
                await exec.start({ Detach: true });
            }
            catch {
                //  pkill returns exit code 1 if no processes matched, which is not a real error
            }
            this.containerRef = null;
        }
        // Release the container
        await this.cleanup();
    }
    // Releases the container back to the pool and resets session state 
    async cleanup() {
        this.ptyProc = null;
        if (this.poolId) {
            await pool_1.containerPool.realease(this.poolId);
            this.poolId = '';
        }
    }
    // Cancels safety timer
    clearTimeout() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }
    // Serializes a SErverMessage to JSON and sends it over the WebSocket
    send(msg) {
        // Check if the connection is still active
        if (this.ws.readyState === ws_1.WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }
}
exports.ExecutionSession = ExecutionSession;
// Copies a source code file into the /code/ directory inside a container
async function copyFile(container, filename, content) {
    return new Promise((resolve, reject) => {
        // Create a tar archive builder
        const pack = tar.pack();
        // Convert the source code string to a Buffer (raw bytes) using UTF-8 encoding
        const buf = Buffer.from(content, 'utf8');
        // A a file entry to the tar archive
        pack.entry({ name: filename, size: buf.length, mode: 0o644 }, buf, (err) => {
            // If adding the entry failed, reject the outer Promise
            if (err)
                return reject(err);
            // Signal we are done adding files to the archive
            pack.finalize();
        });
        // Collect the tar archive bytes as they're generated 
        const chunks = [];
        pack.on('data', (c) => chunks.push(c));
        pack.on('error', reject); // Reject the Promise if the archive fails
        // When the archive is complete, upload it to the container
        pack.on('end', async () => {
            try {
                await container.putArchive(Buffer.concat(chunks), { path: '/code' });
                // Resolve the outer Promise, the file is now in the container
                resolve();
            }
            catch (e) {
                reject(e);
            }
        });
    });
}
//# sourceMappingURL=executor.js.map