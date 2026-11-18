import fs from "fs"
import path from "path"
import type { IncomingMessage, ServerResponse } from "http"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite"

type Backend = "api" | "appwrite" | "demo"

// Which backend the frontend talks to:
// 1. VITE_BACKEND if set ("api" | "appwrite" | "demo")
// 2. `npm run dev` -> "api" (own backend with a local database)
// 3. build with DATABASE_URL (Neon connected on Vercel) -> "api"
// 4. otherwise -> "demo" (everything in the browser)
// Appwrite only with VITE_BACKEND=appwrite: old Appwrite variables (e.g. still
// set in a Vercel project from 2023) must not switch to a deleted project.
function chooseBackend(env: Record<string, string>, command: "serve" | "build"): Backend {
  const wanted = env.VITE_BACKEND as Backend | undefined
  if (wanted === "api" || wanted === "appwrite" || wanted === "demo") return wanted
  if (env.VITE_DEMO_MODE === "true") return "demo"
  if (command === "serve" || env.DATABASE_URL || env.POSTGRES_URL) return "api"
  return "demo"
}

// Runs the Vercel Functions from /api inside the Vite dev server, so
// `npm run dev` is the full app. Without DATABASE_URL it uses PGlite, a real
// Postgres compiled to WebAssembly, stored in the folder .data/pglite.
function apiDevServer(env: Record<string, string>): Plugin {
  let localDb: Promise<unknown> | null = null

  const createLocalDb = async () => {
    const { PGlite } = await import("@electric-sql/pglite")
    const dataDir = path.resolve(__dirname, ".data/pglite")
    fs.mkdirSync(path.dirname(dataDir), { recursive: true })
    const pg = await PGlite.create(dataDir)
    return {
      kind: "local" as const,
      async query(text: string, params: unknown[] = []) {
        return (await pg.query(text, params)).rows
      },
      async transaction(statements: Array<{ text: string; params?: unknown[] }>) {
        await pg.transaction(async (tx) => {
          for (const s of statements) await tx.query(s.text, s.params ?? [])
        })
      },
    }
  }

  const handle = async (server: ViteDevServer, req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
    const name = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "")
    if (!/^[a-z]+$/.test(name)) {
      res.statusCode = 404
      return res.end("Not found")
    }

    for (const key of ["DATABASE_URL", "POSTGRES_URL", "DEMO_RESET_HOURS"]) {
      if (env[key] && !process.env[key]) process.env[key] = env[key]
    }

    // read by api/_lib/db.ts when DATABASE_URL is not set
    const devGlobal = globalThis as { __snapgramDevDatabase?: () => Promise<unknown> }
    devGlobal.__snapgramDevDatabase = () =>
      (localDb ??= createLocalDb().catch((error) => {
        localDb = null // try again on the next request
        throw error
      }))

    const mod = await server.ssrLoadModule(`/api/${name}.ts`)
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)

    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(key, value)
    }

    const response: Response = await mod.default.fetch(
      new Request(url, {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks),
      })
    )

    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))
    res.end(Buffer.from(await response.arrayBuffer()))
  }

  return {
    name: "snapgram-api-dev",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next()
        handle(server, req, res).catch((error) => {
          server.config.logger.error(String(error?.stack ?? error))
          res.statusCode = 500
          res.end("API error")
        })
      })
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env } as Record<string, string>
  const backend = chooseBackend(env, command)

  return {
    plugins: [react(), ...(backend === "api" ? [apiDevServer(env)] : [])],
    define: {
      __SNAPGRAM_BACKEND__: JSON.stringify(backend),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
