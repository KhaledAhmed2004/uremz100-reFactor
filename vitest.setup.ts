import config from './src/config';

// Ensure config has a JWT secret during all tests
if (!config.jwt) config.jwt = {} as any;
if (!config.jwt.jwt_secret) {
  config.jwt.jwt_secret = 'global-test-secret-key-123';
}
if (!config.jwt.jwt_expires_in) {
  config.jwt.jwt_expires_in = '1d';
}

// Fallback for process.env just in case
process.env.JWT_SECRET = process.env.JWT_SECRET || 'global-test-secret-key-123';
