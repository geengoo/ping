# Task 3 Report — Auth Magic Link

**Status:** DONE_WITH_CONCERNS

**Commit:** 1c78614

**Build result:** `npm run build` — Compiled successfully, TypeScript passed (4.4s), 8 pages/routes generated without errors.

## Concerns

### 1. `middleware.ts` → `proxy.ts` (Next.js 16 breaking change)
In Next.js 16, `middleware.ts` is deprecated and renamed to `proxy.ts`. The brief specified `web/middleware.ts` but the correct file for Next.js 16 is `web/proxy.ts` with a named export `proxy` (not `middleware`). The file was created as `proxy.ts` per the Next.js 16 convention.

### 2. Prisma 7 requires `@prisma/adapter-pg`
Prisma 7's generated client uses a WASM-based engine (`engineType = "client"`) by default, which requires either `adapter` or `accelerateUrl` in the PrismaClient constructor. The old pattern of relying on `DATABASE_URL` env var directly no longer works. Two changes were required:
- Added `@prisma/adapter-pg` + `pg` to `web/package.json`
- Updated `web/lib/prisma.ts` to use `new PrismaPg({ connectionString: process.env.DATABASE_URL! })` as adapter

The generator block in `web/prisma/schema.prisma` stays clean (no deprecated `previewFeatures = ["driverAdapters"]` needed in Prisma 7).

### 3. Resend lazy initialization
`new Resend(undefined)` throws at module load time. Changed to lazy init (`getResend()` getter) with `'placeholder'` fallback so the module can be imported without `RESEND_API_KEY` at build time. At runtime, if `RESEND_API_KEY` is unset, the actual send will fail — but `NODE_ENV=test` guard prevents that in tests.

## Files produced
- `web/lib/auth.ts` — `criarToken`, `verificarToken`, `getSessao`, `Sessao` interface
- `web/lib/resend.ts` — `enviarCodigoLogin`
- `web/lib/prisma.ts` — updated for Prisma 7 adapter pattern
- `web/proxy.ts` — route protection for `/a/*` and `/admin/*` (Next.js 16 proxy)
- `web/app/api/auth/request/route.ts` — POST /api/auth/request
- `web/app/api/auth/verify/route.ts` — POST /api/auth/verify
- `web/app/api/auth/logout/route.ts` — POST /api/auth/logout
- `web/app/a/login/page.tsx` — login form
- `web/app/a/login/verificar/page.tsx` — code verification form
