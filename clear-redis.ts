import { redisClient } from './src/shared/redisClient';
redisClient.flushall().then(() => {
  console.log('Redis flushed');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
