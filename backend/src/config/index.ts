import dotenv from 'dotenv';
dotenv.config();

interface Config {
  server: {
    port: number;
    host: string;
    nodeEnv: string;
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  blockchain: {
    rpcUrl: string;
    chainId: number;
    mnemonic: string;
    contracts: {
      userRegistry: string;
      medicalRecordRegistry: string;
      consentManager: string;
      auditLog: string;
    };
    backendPrivateKey: string;
  };
  encryption: {
    masterKey: Buffer;
    algorithm: string;
  };
  storage: {
    type: 'local' | 'ipfs';
    localPath: string;
    maxFileSize: number;
    ipfsApiUrl?: string;
    ipfsGatewayUrl?: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  cors: {
    origin: string | string[];
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  logging: {
    level: string;
    file: string;
  };
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function isProduction(): boolean {
  return (process.env.NODE_ENV || 'development') === 'production';
}

// Publicly-known development placeholders. These ship in the repo's
// .env.example files and docs, so they must never authenticate a
// production deployment.
const DEV_PLACEHOLDERS: Record<string, string[]> = {
  DB_PASSWORD: ['postgres', 'postgrey'],
  GANACHE_MNEMONIC: ['test test test test test test test test test test test junk'],
  BACKEND_PRIVATE_KEY: ['0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'],
  ENCRYPTION_MASTER_KEY: ['0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'],
  JWT_SECRET: [
    'your-super-secret-jwt-key-change-in-production-min-32-chars',
    'your-super-secret-jwt-key-change-in-production-min-32-characters-long'
  ]
};

// In production, secrets must be explicitly set and must not be a known
// dev placeholder. In development/test, falls back to the dev default so
// local setup keeps working out of the box.
function getSecretEnv(key: string, devDefault: string): string {
  const value = process.env[key];
  if (isProduction()) {
    if (!value) {
      throw new Error(
        `Missing required environment variable in production: ${key}. ` +
        `Refusing to start with a development default.`
      );
    }
    if ((DEV_PLACEHOLDERS[key] || []).includes(value)) {
      throw new Error(
        `Environment variable ${key} uses a publicly-known development placeholder. ` +
        `Generate a fresh secret for production. Refusing to start.`
      );
    }
    return value;
  }
  return value || devDefault;
}

function parseMasterKey(hex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

function getJwtSecret(): string {
  const secret = getSecretEnv(
    'JWT_SECRET',
    'your-super-secret-jwt-key-change-in-production-min-32-characters-long'
  );
  if (isProduction() && secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long in production. Refusing to start.');
  }
  return secret;
}

export const config: Config = {
  server: {
    port: parseInt(getOptionalEnv('PORT', '3000'), 10),
    host: getOptionalEnv('HOST', '0.0.0.0'),
    nodeEnv: getOptionalEnv('NODE_ENV', 'development')
  },
  database: {
    host: getOptionalEnv('DB_HOST', 'localhost'),
    port: parseInt(getOptionalEnv('DB_PORT', '5432'), 10),
    name: getOptionalEnv('DB_NAME', 'patient_healthcare'),
    user: getOptionalEnv('DB_USER', 'postgres'),
    password: getSecretEnv('DB_PASSWORD', 'postgres'),
    ssl: getOptionalEnv('DB_SSL', 'false') === 'true'
  },
  blockchain: {
    rpcUrl: getOptionalEnv('RPC_URL', 'http://localhost:7548'),
    chainId: parseInt(getOptionalEnv('CHAIN_ID', '1339'), 10),
    mnemonic: getSecretEnv('GANACHE_MNEMONIC', 'test test test test test test test test test test test junk'),
    contracts: {
      userRegistry: getOptionalEnv('CONTRACT_USER_REGISTRY', ''),
      medicalRecordRegistry: getOptionalEnv('CONTRACT_MEDICAL_RECORD_REGISTRY', ''),
      consentManager: getOptionalEnv('CONTRACT_CONSENT_MANAGER', ''),
      auditLog: getOptionalEnv('CONTRACT_AUDIT_LOG', '')
    },
    backendPrivateKey: getSecretEnv('BACKEND_PRIVATE_KEY', '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
  },
  encryption: {
    masterKey: parseMasterKey(getSecretEnv('ENCRYPTION_MASTER_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')),
    algorithm: getOptionalEnv('ENCRYPTION_ALGORITHM', 'aes-256-gcm')
  },
  storage: {
    type: (getOptionalEnv('STORAGE_TYPE', 'local') as 'local' | 'ipfs'),
    localPath: getOptionalEnv('STORAGE_LOCAL_PATH', './storage/encrypted'),
    maxFileSize: parseInt(getOptionalEnv('STORAGE_MAX_FILE_SIZE', '52428800'), 10),
    ipfsApiUrl: getOptionalEnv('IPFS_API_URL', ''),
    ipfsGatewayUrl: getOptionalEnv('IPFS_GATEWAY_URL', '')
  },
  jwt: {
    secret: getJwtSecret(),
    expiresIn: getOptionalEnv('JWT_EXPIRES_IN', '24h'),
    refreshExpiresIn: getOptionalEnv('JWT_REFRESH_EXPIRES_IN', '7d')
  },
  cors: {
    origin: getOptionalEnv('CORS_ORIGIN', 'http://localhost:5173').split(',').map(s => s.trim())
  },
  rateLimit: {
    windowMs: parseInt(getOptionalEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    maxRequests: parseInt(getOptionalEnv('RATE_LIMIT_MAX_REQUESTS', '100'), 10)
  },
  logging: {
    level: getOptionalEnv('LOG_LEVEL', 'info'),
    file: getOptionalEnv('LOG_FILE', './logs/app.log')
  }
};

export default config;