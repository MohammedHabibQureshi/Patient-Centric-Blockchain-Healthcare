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
    password: getOptionalEnv('DB_PASSWORD', 'postgres'),
    ssl: getOptionalEnv('DB_SSL', 'false') === 'true'
  },
  blockchain: {
    rpcUrl: getOptionalEnv('RPC_URL', 'http://localhost:7548'),
    chainId: parseInt(getOptionalEnv('CHAIN_ID', '1339'), 10),
    mnemonic: getOptionalEnv('GANACHE_MNEMONIC', 'test test test test test test test test test test test junk'),
    contracts: {
      userRegistry: getOptionalEnv('CONTRACT_USER_REGISTRY', ''),
      medicalRecordRegistry: getOptionalEnv('CONTRACT_MEDICAL_RECORD_REGISTRY', ''),
      consentManager: getOptionalEnv('CONTRACT_CONSENT_MANAGER', ''),
      auditLog: getOptionalEnv('CONTRACT_AUDIT_LOG', '')
    },
    backendPrivateKey: getOptionalEnv('BACKEND_PRIVATE_KEY', '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
  },
  encryption: {
    masterKey: Buffer.from(getOptionalEnv('ENCRYPTION_MASTER_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'), 'hex'),
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
    secret: getOptionalEnv('JWT_SECRET', 'your-super-secret-jwt-key-change-in-production-min-32-characters-long'),
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