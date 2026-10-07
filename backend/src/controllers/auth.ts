import { Request, Response } from 'express';
import { ethers } from 'ethers';
import { blockchainService } from '../blockchain/service';
import { storageService } from '../storage/service';
import { query, queryOne } from '../database/connection';
import { createUserSession, generateNonce, createAuthMessage, verifySignature } from '../services/auth';
import { logger } from '../utils/logger';
import { UserRole, ConsentStatus, AuditAction, AuditStatus } from '../blockchain/service';

export async function getNonce(req: Request, res: Response): Promise<void> {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress || !ethers.utils.isAddress(walletAddress)) {
      res.status(400).json({ error: 'Invalid wallet address' });
      return;
    }

    const nonce = generateNonce();
    const message = createAuthMessage(walletAddress, nonce);

    // Store nonce temporarily (in production, use Redis with TTL)
    // For now, we'll include it in the response for the frontend to use
    res.json({ 
      nonce, 
      message,
      walletAddress: walletAddress.toLowerCase()
    });
  } catch (error) {
    logger.error('Error generating nonce', { error });
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
}

export async function verifyWalletAuth(req: Request, res: Response): Promise<void> {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !ethers.utils.isAddress(walletAddress)) {
      res.status(400).json({ error: 'Invalid wallet address' });
      return;
    }

    if (!signature) {
      res.status(400).json({ error: 'Signature required' });
      return;
    }

    if (!message) {
      res.status(400).json({ error: 'Message required' });
      return;
    }

    // Verify signature
    const isValid = await verifySignature(walletAddress, message, signature);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Check if user exists and is active
    const session = await createUserSession(walletAddress);
    if (!session) {
      res.status(403).json({ 
        error: 'Wallet not registered or inactive. Contact administrator.' 
      });
      return;
    }

    // Log audit
    await blockchainService.logAudit(
      walletAddress,
      session.user.role,
      AuditAction.USER_LOGIN,
      'USER',
      0n,
      session.user.wallet_address,
      AuditStatus.SUCCESS,
      '',
      { loginMethod: 'metamask' }
    );

    res.json({
      user: {
        id: session.user.id,
        name: session.user.name,
        walletAddress: session.user.wallet_address,
        role: session.user.role,
        email: session.user.email,
        identifier: session.user.identifier
      },
      tokens: session.tokens
    });
  } catch (error) {
    logger.error('Error verifying wallet auth', { error });
    res.status(500).json({ error: 'Authentication failed' });
  }
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    // In a real implementation, you'd verify the refresh token and issue new tokens
    // For now, we'll just return an error to force re-authentication
    res.status(401).json({ error: 'Please re-authenticate' });
  } catch (error) {
    logger.error('Error refreshing token', { error });
    res.status(500).json({ error: 'Token refresh failed' });
  }
}

export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as any;
    if (!authReq.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await queryOne(
      'SELECT id, name, wallet_address, role, email, identifier, status, created_at FROM users WHERE wallet_address = $1',
      [authReq.user.walletAddress]
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    logger.error('Error getting current user', { error });
    res.status(500).json({ error: 'Failed to get user' });
  }
}