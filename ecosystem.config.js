module.exports = {
  apps: [
    {
      name: 'ping-api',
      script: 'node',
      args: 'dist/server.js',
      cwd: '/root/Projetos/geengoo/ping/api',
      // secrets loaded from api/.env via dotenv/config
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'ping-worker',
      script: 'node',
      args: 'dist/worker.js',
      cwd: '/root/Projetos/geengoo/ping/api',
      // secrets loaded from api/.env via dotenv/config
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'ping-web',
      script: 'npm',
      args: 'start',
      cwd: '/root/Projetos/geengoo/ping/web',
      // secrets loaded from web/.env.local by Next.js
      env: { NODE_ENV: 'production', PORT: '3043' },
    },
  ],
}
