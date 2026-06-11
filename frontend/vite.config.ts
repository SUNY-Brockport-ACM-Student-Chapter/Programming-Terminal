import {defineConfig} from 'vite'

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                iframe: 'iframe/index.html',
            },
        },
    },
})