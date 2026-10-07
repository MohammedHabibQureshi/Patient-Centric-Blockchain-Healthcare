import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';
import { queryOne } from '../database/connection';
import { randomBytes } from 'crypto';

export interface JWTPayload {
  walletAddress: string;
  role: string;
  userId: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export async function generateTokens(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<AuthTokens> {
  const accessTokenOptions: SignOptions = { expiresIn: config.jwt.expiresIn as any };
  const refreshTokenOptions: SignOptions = { expiresIn: config.jwt.refreshExpiresIn as any };
  const accessToken = jwt.sign(payload, config.jwt.secret, accessTokenOptions);
  const refreshToken = jwt.sign(payload, config.jwt.secret, refreshTokenOptions);
  return { accessToken, refreshToken };
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, config.jwt.secret) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export async function verifySignature(
  walletAddress: string,
  message: string,
  signature: string
): Promise<boolean> {
  try {
    const { ethers } = await import('ethers');
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch (error) {
    logger.error('Signature verification failed', { error, walletAddress });
    return false;
  }
}

export function generateNonce(): string {
  return randomBytes(32).toString('hex');
}

export function createAuthMessage(walletAddress: string, nonce: string): string {
  return `Patient Healthcare Blockchain Authentication\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;
}

export async function getUserByWallet(walletAddress: string): Promise<any> {
  return queryOne(
    'SELECT * FROM users WHERE LOWER(wallet_address) = LOWER($1) AND status = \'ACTIVE\'',
    [walletAddress]
  );
}

export async function createUserSession(walletAddress: string): Promise<{ user: any; tokens: AuthTokens } | null> {
  const user = await getUserByWallet(walletAddress);
  if (!user) {
    return null;
  }

  // Update last login
  await queryOne(
    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
    [user.id]
  );

  const tokens = await generateTokens({
    walletAddress: user.wallet_address,
    role: user.role,
    userId: user.id
  });

  return { user, tokens };
}