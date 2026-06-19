import Dockerode from 'dockerode'
import * as pty from 'node-pty'
import * as tar from 'tar-stream'
import { WebSocket } from 'ws'
import { containerPool } from './pool'
import { Language, LANGUAGE_FILENAMES, LANGUAGE_RUN_COMMANDS, ServerMessage} from './types'

const docker = new Dockerode
const MAX_EXECUTION_MS = parseInt(process.env.MAX_EXECUTION_TIME ?? '15000', 10)

export class ExecutionSession
{
    private poolId: string = ''
    private ptyProc: pty.IPty | null = null
    private stopped = false
    private timeoutId: ReturnType<typeof setTimeout> | null = null

    constructor(private ws: WebSocket) {}

    async run(language: Language, code: string): Promise<void>
    {
        if(this.ptyProc)
        {
            this.send({type: 'error', message: 'Already running. Stop it first.'})
            return
        }

        let container: Dockerode.Container
        let containerId: string = ''
        try{
            const entry = await containerPool.aquire()
            this.poolId = entry.poolId
            container = docker.getContainer(entry.dockerId)
            containerId = entry.dockerId
        }catch{
            this.send({type:'error', message: 'No container available. Try again.'})
            return
        }

        try{
            await copyFile(container, LANGUAGE_FILENAMES[language], code)
        }catch(err){
            this.send({type: 'error', message: `Failed to copy code: ${err}`})
            await containerPool.realease(this.poolId)
            this.poolId = ''
            return
        }

        const [bin, ...args] = LANGUAGE_RUN_COMMANDS[language]
        this.send({type: 'ready'})
        this.stopped = false

        try{
            this.ptyProc = pty.spawn('docker', ['exec', '-it', container.id, bin, ...args], {
                name: 'xterm-256color',
                cols: 80, rows: 24,
                cwd: process.cwd(),
                env: process.env as Record<string, string>,
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
            if(!this.stopped) this.send({type: 'exit', code: exitCode})
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
        this.ptyProc?.kill()
        this.ptyProc = null
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




