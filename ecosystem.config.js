module.exports = {
  apps: [{
    name: 'ping',
    script: 'npm',
    args: 'start -- -p 3004',
    cwd: '/root/Projetos/geengoo/ping',
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://ping:ping_2026@187.77.56.138:5432/geengoo_ping',
      JWT_SECRET: 'ping_jwt_prod_6214d827508d02f29cbc3508f420c2d8',
      SUPER_ADMIN_EMAIL: 'fabio@geengoo.com.br',
      SUPER_ADMIN_SENHA: '#Ideashake10',
      NEXT_PUBLIC_BASE_URL: 'https://ping.geengoo.com.br'
    }
  }]
}
