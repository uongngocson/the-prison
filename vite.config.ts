import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Dev: chạy các Vercel Function trong /api ngay trên dev server (production do Vercel chạy). Key đọc từ .env, KHÔNG vào bundle. */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      for (const k of ['GROQ_API_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) if (env[k] && !process.env[k]) process.env[k] = env[k];
      server.middlewares.use(async (req, res, next) => {
        const m = req.url?.match(/^\/api\/([a-z0-9/_-]+?)(\?.*)?$/i);
        if (!m) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`) as Record<string, (r: Request) => Promise<Response>>;
          const handler = mod[req.method ?? 'GET'];
          if (!handler) { res.statusCode = 405; res.end(); return; }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const r = await handler(new Request(`http://localhost${req.url}`, { method: req.method, headers, body: chunks.length && req.method !== 'GET' ? Buffer.concat(chunks) : undefined }));
          res.statusCode = r.status;
          r.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await r.arrayBuffer()));
        } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: (e as Error).message })); }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as never);
