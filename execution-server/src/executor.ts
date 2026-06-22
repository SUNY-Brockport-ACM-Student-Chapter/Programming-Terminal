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

        this.ptyProc.onData((data: string) => {
            try{
                if(!this.stopped) this.send({type: 'output', data})
            }catch(err){
                console.error('[executor] Error sending output', err)
            }
        })

        this.ptyProc.onExit(async ({ exitCode }) => {
            this.clearTimeout()
            if(!this.stopped) 
                this.send({type: 'exit', code: exitCode})
            await this.cleanup()
        })

        this.timeoutId = setTimeout(() => {
            this.send({ type: 'output', data: '\r\n[Execution time limit reached]\r\n'})
            this.kill()
        }, MAX_EXECUTION_MS)
    }

    writeInput(data: string) {this.ptyProc?.write(data)}
    resize(cols: number, rows: number) { this.ptyProc?.resize(cols, rows)}

    async kill(): Promise<void>{
        this.stopped = true
        this.clearTimeout()
        try{
             this.ptyProc?.kill()
        }catch{}
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
        await this.cleanup()
    }

    private async cleanup(): Promise<void>{
        this.ptyProc = null
        if(this.poolId){
            await containerPool.realease(this.poolId)
            this.poolId = ''
        }
    }

    private clearTimeout(){
        if(this.timeoutId){
            clearTimeout(this.timeoutId); this.timeoutId = null
        }
    }

    private send(msg: ServerMessage){
        if(this.ws.readyState === WebSocket.OPEN){
            this.ws.send(JSON.stringify(msg))
        }
    }
}

async function copyFile(container: Dockerode.Container, filename: string, content: string): Promise<void>
{
        return new Promise((resolve, reject) => 
        {
            const pack = tar.pack()
            const buf = Buffer.from(content, 'utf8')
            pack.entry({name:filename, size: buf.length, mode: 0o644}, buf, (err: any) => 
            {
                if(err) return reject(err)
                pack.finalize()
            })
            const chunks: Buffer[] = []
            pack.on('data', (c: Buffer) => chunks.push(c))
            pack.on('error', reject)
            pack.on('end', async () => 
            {
                try{
                    await container.putArchive(Buffer.concat(chunks), {path: '/code'})
                    resolve()
                }catch (e) {
                    reject(e)
                }
            })
        })
}




