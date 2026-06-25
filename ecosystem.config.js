module.exports = {
  apps: [
    {
      name: 'ping-api',
      script: 'node',
      args: 'dist/server.js',
      cwd: '/root/Projetos/geengoo/ping/api',
      env: {
        NODE_ENV: 'production',
        PORT: '3042',
        DATABASE_URL: 'postgresql://ping:ping_2026@187.77.56.138:5432/ping',
        JWT_SECRET: 'ping_jwt_prod_6214d827508d02f29cbc3508f420c2d8',
        RESEND_API_KEY: '',
        RESEND_FROM_EMAIL: 'noreply@geengoo.com.br',
        BASE_URL: 'https://ping.geengoo.io',
      },
    },
    {
      name: 'ping-worker',
      script: 'node',
      args: 'dist/worker.js',
      cwd: '/root/Projetos/geengoo/ping/api',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://ping:ping_2026@187.77.56.138:5432/ping',
        JWT_SECRET: 'ping_jwt_prod_6214d827508d02f29cbc3508f420c2d8',
        RESEND_API_KEY: '',
        RESEND_FROM_EMAIL: 'noreply@geengoo.com.br',
        BASE_URL: 'https://ping.geengoo.io',
      },
    },
    {
      name: 'ping-web',
      script: 'npm',
      args: 'start',
      cwd: '/root/Projetos/geengoo/ping/web',
      env: {
        NODE_ENV: 'production',
        PORT: '3043',
        DATABASE_URL: 'postgresql://ping:ping_2026@187.77.56.138:5432/ping',
        JWT_SECRET: 'ping_jwt_prod_6214d827508d02f29cbc3508f420c2d8',
        SUPERADMIN_EMAIL: 'fabio@geengoo.com.br',
        RESEND_API_KEY: '',
        RESEND_FROM_EMAIL: 'noreply@geengoo.com.br',
        NEXT_PUBLIC_BASE_URL: 'https://ping.geengoo.io',
      },
    },
  ],
}
