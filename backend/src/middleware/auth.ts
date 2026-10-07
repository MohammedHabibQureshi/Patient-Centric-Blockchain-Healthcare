import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../services/auth';
import { logger } from '../utils/logger';
import { queryOne } from '../database/connection';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }

  // Enforce that the account is still ACTIVE (e.g. not removed/suspended by admin).
  // A removed user keeps their JWT until it expires, so we must not let them use it.
  try {
    const dbUser = await queryOne(
      'SELECT status FROM users WHERE wallet_address = $1',
      [payload.walletAddress]
    );
    if (!dbUser || dbUser.status !== 'ACTIVE') {
      res.status(401).json({ error: 'Account is not active. Contact the administrator.' });
      return;
    }
  } catch (e) {
    logger.error('Failed to verify account status during auth', { error: e, walletAddress: payload.walletAddress });
    res.status(500).json({ error: 'Failed to verify account status' });
    return;
  }

  req.user = payload;
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Access denied: insufficient role', { 
        walletAddress: req.user.walletAddress, 
        userRole: req.user.role, 
        requiredRoles: allowedRoles 
      });
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
}