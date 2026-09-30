import { Readable } from 'node:stream'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Runs api/agent.ts in the dev server, so the agent works without `vercel dev`. */
function agentApi(): Plugin {
  return {
    name: 'agent-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/agent', async (req, res) => {
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const request = new Request(`http://localhost${req.originalUrl ?? '/api/agent'}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
          })
          const mod = (await server.ssrLoadModule('/api/agent.ts')) as { POST: (r: Request) => Promise<Response> }
          const response = await mod.POST(request)
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          if (!response.body) return res.end()
          Readable.fromWeb(response.body as import('node:stream/web').ReadableStream).pipe(res)
        } catch (error) {
          res.statusCode = 500
          res.end(error instanceof Error ? error.message : String(error))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [react(), tailwindcss(), agentApi()],
  }
})
