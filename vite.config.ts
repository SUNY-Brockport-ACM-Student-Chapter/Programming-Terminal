import {defineConfig} from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig(({ mode }) => {
    if(mode === 'lib'){
        return{
            plugins: [dts({include: ['src'], outDirs: 'dist' })], // might be outDir, changed to OutDirs since it threw an error
            build:{
                lib:{
                    entry: 'src/component/CodeEditorElement.ts',
                    name: 'CodeEditor',
                    fileName: 'code-editor',
                    formats: ['es', 'umd'],
                },
            },
        }
    }
    
    return{
        build:{
            rollupOptions:{
                input:{main: 'index.html', iframe: 'iframe/index.html'},
            },
        },
    }
})