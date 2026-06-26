import { Router } from 'express'
import { GoogleGenAI } from '@google/genai'
import { containerPool } from './pool'

interface GeminiResponse{
    candidates:{
        content: {
            parts: {
                text:string;
            }[];
        };
    }[];
}

const router = Router()

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
})

// GET /api/health returns the current pool status
router.get('/health', (_req, res) =>{
    res.json({status: 'ok', pool: containerPool.status() })
})

// GET /api/recover returns whether the the pool is healthy or if there was a crash attempts to recover from it
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

// Using Google Gemini to test AI Feedback 
router.post('/analyze', async(req, res) =>{
    console.log('[analyze] API key loaded:', !!process.env.GEMINI_API_KEY)
    const { code, output } = req.body

    const testQuestion = "Write a program that uses a for loop to print the numbers 1 to 10"

    try{
        const analysis = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: `You are a code analysis assistant for an educational platform.
                    Analyze the user's code and its output in the context of the given question.
                    
                    Question: ${testQuestion}
                    Code: ${code}
                    Output: ${output}`,
        })

        console.log('[analyze] Response:', analysis.text)
        res.status(200).json({analysis: analysis.text})
    } catch(err){
        console.error('[analyze] Error:', err)
        res.status(500).json({error: 'Failed to contact Gemini API'})
    }
})

export default router