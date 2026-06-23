import Dockerode from 'dockerode'
import * as pty from 'node-pty'
import * as tar from 'tar-stream'
import { WebSocket } from 'ws'
import { containerPool } from './pool'
import { Language, LANGUAGE_FILENAMES, LANGUAGE_RUN_COMMANDS, ServerMessage} from './types'

const docker = new Dockerode
const MAX_EXECUTION_MS = parseInt(process.env.MAX_EXECUTION_TIME ?? '15000', 10) // This timeout kills an infinite loop
console.log(`[executor] Timeout set to ${MAX_EXECUTION_MS}ms`) // this is for testing timeout, remove once finished

// Represents a user's run session. Each Websocket gets its own ExecutionSession instance
export class ExecutionSession
{
    private poolId: string = ''
    private ptyProc: pty.IPty | null = null
    private stopped = false
    private timeoutId: ReturnType<typeof setTimeout> | null = null
    private containerRef: Dockerode.Container | null = null

    // Websocket connection to the frontend
    constructor(private ws: WebSocket) {}

    // Run is called when the frontend signals that a user has hit the run button
    async run(language: Language, code: string): Promise<void>
    {
        // Prevent starting a new session if a session is already active
        if(this.ptyProc)
        {
            this.send({type: 'error', message: 'Already running. Stop it first.'})
            return
        }

        // Acquire container from the pool
        let container: Dockerode.Container
        let containerId: string = ''
        try{
            const entry = await containerPool.aquire()
            // Store poolId so we can release this container when done
            this.poolId = entry.poolId
            // Get a reference to Dockerode container handle
            container = docker.getContainer(entry.dockerId)
            containerId = entry.dockerId
            this.containerRef = container
        }catch{
            this.send({type:'error', message: 'No container available. Try again.'})
            return
        }

        // Copy source file into the container
        try{
            await copyFile(container, LANGUAGE_FILENAMES[language], code)
        }catch(err){
            this.send({type: 'error', message: `Failed to copy code: ${err}`})
            await containerPool.realease(this.poolId)
            this.poolId = ''
            return
        }

        // Spawn the PTY via docker exec 
        const [bin, ...args] = LANGUAGE_RUN_COMMANDS[language]
        // Notify the frontend that execution is about to start
        this.send({type: 'ready'})
        this.stopped = false

        try{
            // Create pseudo-terminal and run commands inside it
            this.ptyProc = pty.spawn('docker', ['exec', '-it', container.id, bin, ...args], {
                name: 'xterm-256color', // 256-color ANSI support 
                cols: 80, rows: 24, // Initialize terminal dimensions 
                cwd: process.cwd(), // sets working directory for node-pty process on the HOST
                env: process.env as Record<string, string>, // pass host environment variables to the docker process
            })
        }catch(err){
            this.send({ type: 'error', message: `Failed to start process: ${err}`})
            await containerPool.realease(this.poolId)
            this.poolId = ''
            return 
        }

        // Stream PTY output to the frontend. This fires whenever the running process writes to its stdout or stderr
        this.ptyProc.onData((data: string) => {
            try{
                // Only forward output if we haven't killed the process 
                if(!this.stopped) this.send({type: 'output', data})
            }catch(err){
                console.error('[executor] Error sending output', err)
            }
        })

        // Handles process exit. Fires when the docker exec process terminates.
        this.ptyProc.onExit(async ({ exitCode }) => {
            // Cancel the safety timeout since the process ended
            this.clearTimeout()
            // Only send the exit message if we didn't stop the process ourselves
            if(!this.stopped) 
                this.send({type: 'exit', code: exitCode})
            // Release the container back to the pool and clear the session
            await this.cleanup()
        })

        // Safety timeout for infinite loops or a program that runs for too long
        this.timeoutId = setTimeout(() => {
            // Alert the user that they have reached max session time
            this.send({ type: 'output', data: '\r\n[Execution time limit reached]\r\n'})
            // Kill the process
            this.kill()
        }, MAX_EXECUTION_MS)
    }

    // Forwards keystrokes from the terminal to the running process's stdin
    writeInput(data: string) {this.ptyProc?.write(data)}
    // Updates the PTY dimensions when the frontend terminal is resized 
    resize(cols: number, rows: number) { this.ptyProc?.resize(cols, rows)}

    // Forcefully terminate the running process
    async kill(): Promise<void>{
        this.stopped = true
        this.clearTimeout()
        try{
            // Send SIGKILL to the docker exec process, which terminates the program
             this.ptyProc?.kill()
        }catch{}

        // Clear the PTY reference 
        this.ptyProc = null

        // Notify the frontend that the process was stopped
        this.send({type: 'exit', code: null})

        // Kill all processes inside the container via docker exec
        if(this.containerRef)
        {
            try{
                const exec = await this.containerRef.exec({
                    Cmd: ['pkill', '-9', '-f', '/code/'], // kills any process whose command containes /code/
                    AttachStdout: false,
                    AttachStderr: false,
                })
                await exec.start({Detach: true})
            }catch{
                //  pkill returns exit code 1 if no processes matched, which is not a real error
            }
            this.containerRef = null
        }
        // Release the container
        await this.cleanup()
    }

    // Releases the container back to the pool and resets session state 
    private async cleanup(): Promise<void>{
        this.ptyProc = null
        if(this.poolId){
            await containerPool.realease(this.poolId)
            this.poolId = ''
        }
    }

    // Cancels safety timer
    private clearTimeout(){
        if(this.timeoutId){
            clearTimeout(this.timeoutId); this.timeoutId = null
        }
    }

    // Serializes a SErverMessage to JSON and sends it over the WebSocket
    private send(msg: ServerMessage){
        // Check if the connection is still active
        if(this.ws.readyState === WebSocket.OPEN){
            this.ws.send(JSON.stringify(msg))
        }
    }
}

// Copies a source code file into the /code/ directory inside a container
async function copyFile(container: Dockerode.Container, filename: string, content: string): Promise<void>
{
        return new Promise((resolve, reject) => 
        {
            // Create a tar archive builder
            const pack = tar.pack()
            // Convert the source code string to a Buffer (raw bytes) using UTF-8 encoding
            const buf = Buffer.from(content, 'utf8')
            // A a file entry to the tar archive
            pack.entry({name:filename, size: buf.length, mode: 0o644}, buf, (err: any) => 
            {
                // If adding the entry failed, reject the outer Promise
                if(err) return reject(err)
                // Signal we are done adding files to the archive
                pack.finalize()
            })
            // Collect the tar archive bytes as they're generated 
            const chunks: Buffer[] = []
            pack.on('data', (c: Buffer) => chunks.push(c))
            pack.on('error', reject) // Reject the Promise if the archive fails

            // When the archive is complete, upload it to the container
            pack.on('end', async () => 
            {
                try{
                    await container.putArchive(Buffer.concat(chunks), {path: '/code'})
                    // Resolve the outer Promise, the file is now in the container
                    resolve()
                }catch (e) {
                    reject(e)
                }
            })
        })
}




