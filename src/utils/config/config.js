const config = {
  app: {
    host: process.env.HOST || 'localhost',
    port: process.env.PORT || 3000,
  },
  rabbitMq: {
    server: process.env.RABBITMQ_SERVER || 'amqp://localhost',
  },
  redis: {
    host: process.env.REDIS_SERVER || 'localhost',
  },
};

module.exports = config;
