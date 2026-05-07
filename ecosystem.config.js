module.exports = {
  apps: [
    {
      name: 'h2oasis-api',
      script: 'lib/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'webhook-worker',
      script: 'lib/src/workers/webhook-consumer.worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
