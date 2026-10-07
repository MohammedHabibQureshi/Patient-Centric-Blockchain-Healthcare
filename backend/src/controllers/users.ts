import { Request, Response } from 'express';
import { ethers } from 'ethers';
import { blockchainService, UserRole, UserStatus, AuditAction, AuditStatus } from '../blockchain/service';
import { query, queryOne } from '../database/connection';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

export async function registerPatient(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { walletAddress, name, email, patientId } = req.body;

    // Validation
    if (!walletAddress || !ethers.utils.isAddress(walletAddress)) {
      res.status(400).json({ error: 'Invalid wallet address' });
      return;
    }

    if (!name || !email || !patientId) {
      res.status(400).json({ error: 'Name, email, and patient ID are required' });
      return;
    }

    const normalizedWallet = ethers.utils.getAddress(walletAddress);
    const normalizedId = patientId.trim();

    // Check if patient ID is already used (off-chain duplicate check)
    const idExists = await queryOne('SELECT id FROM users WHERE LOWER(identifier) = LOWER($1)', [normalizedId]);
    if (idExists) {
      res.status(409).json({ error: `Patient ID ${normalizedId} is already registered.` });
      return;
    }

    // Check if already registered (both DB and blockchain to avoid desync)
    const existing = await queryOne('SELECT id FROM users WHERE wallet_address = $1', [normalizedWallet.toLowerCase()]);
    if (existing) {
      res.status(409).json({ error: 'This wallet address is already registered.' });
      return;
    }

    const onChain = await blockchainService.isRegistered(normalizedWallet);
    if (onChain) {
      res.status(409).json({ error: 'This wallet address is already registered on the blockchain. Please use an unregistered wallet or the existing account.' });
      return;
    }

    // Register on blockchain
    const blockchainUserId = await blockchainService.registerPatient(
      normalizedWallet,
      name,
      email,
      normalizedId
    );

    // Store in database
    const user = await queryOne(
      `INSERT INTO users (name, wallet_address, role, email, identifier, status, blockchain_user_id, registered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, normalizedWallet.toLowerCase(), 'PATIENT', email, normalizedId, 'ACTIVE', blockchainUserId.toString(), req.user!.userId]
    );

    // Log audit
    await blockchainService.logAudit(
      req.user!.walletAddress,
      'ADMIN',
      AuditAction.USER_REGISTERED,
      'USER',
      BigInt(0),
      normalizedId,
      AuditStatus.SUCCESS,
      '',
      { registeredWallet: normalizedWallet, role: 'PATIENT', blockchainUserId: blockchainUserId.toString() }
    );

    logger.info('Patient registered', { walletAddress: normalizedWallet, patientId: normalizedId, blockchainUserId: blockchainUserId.toString() });
    res.status(201).json({ user, blockchainUserId: blockchainUserId.toString() });
  } catch (error: any) {
    logger.error('Error registering patient', { error });
    const message = error?.message || 'Failed to register patient';
    res.status(500).json({ error: `Patient registration failed: ${message}` });
  }
}

export async function registerDoctor(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { walletAddress, name, email, licenseNumber } = req.body;

    if (!walletAddress || !ethers.utils.isAddress(walletAddress)) {
      res.status(400).json({ error: 'Invalid wallet address' });
      return;
    }

    if (!name || !email || !licenseNumber) {
      res.status(400).json({ error: 'Name, email, and license number are required' });
      return;
    }

    const normalizedWallet = ethers.utils.getAddress(walletAddress);
    const normalizedId = licenseNumber.trim();

    const idExists = await queryOne('SELECT id FROM users WHERE LOWER(identifier) = LOWER($1)', [normalizedId]);
    if (idExists) {
      res.status(409).json({ error: `License number ${normalizedId} is already registered.` });
      return;
    }

    const existing = await queryOne('SELECT id FROM users WHERE wallet_address = $1', [normalizedWallet.toLowerCase()]);
    if (existing) {
      res.status(409).json({ error: 'This wallet address is already registered.' });
      return;
    }

    const onChain = await blockchainService.isRegistered(normalizedWallet);
    if (onChain) {
      res.status(409).json({ error: 'This wallet address is already registered on the blockchain. Please use an unregistered wallet or the existing account.' });
      return;
    }

    const blockchainUserId = await blockchainService.registerDoctor(
      normalizedWallet,
      name,
      email,
      normalizedId
    );

    const user = await queryOne(
      `INSERT INTO users (name, wallet_address, role, email, identifier, status, blockchain_user_id, registered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, normalizedWallet.toLowerCase(), 'DOCTOR', email, normalizedId, 'ACTIVE', blockchainUserId.toString(), req.user!.userId]
    );

    await blockchainService.logAudit(
      req.user!.walletAddress,
      'ADMIN',
      AuditAction.USER_REGISTERED,
      'USER',
      BigInt(0),
      normalizedId,
      AuditStatus.SUCCESS,
      '',
      { registeredWallet: normalizedWallet, role: 'DOCTOR', blockchainUserId: blockchainUserId.toString() }
    );

    logger.info('Doctor registered', { walletAddress: normalizedWallet, licenseNumber: normalizedId, blockchainUserId: blockchainUserId.toString() });
    res.status(201).json({ user, blockchainUserId: blockchainUserId.toString() });
  } catch (error: any) {
    logger.error('Error registering doctor', { error });
    const message = error?.message || 'Failed to register doctor';
    res.status(500).json({ error: `Doctor registration failed: ${message}` });
  }
}

export async function deactivateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress || !ethers.utils.isAddress(walletAddress)) {
      res.status(400).json({ error: 'Invalid wallet address' });
      return;
    }

    // Check if user exists
    const user = await queryOne('SELECT * FROM users WHERE wallet_address = $1', [walletAddress.toLowerCase()]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.wallet_address.toLowerCase() === req.user!.walletAddress.toLowerCase()) {
      res.status(400).json({ error: 'Cannot deactivate yourself' });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(409).json({ error: 'User is already removed (not active).' });
      return;
    }

    // Deactivate on blockchain
    await blockchainService.deactivateUser(walletAddress);

    // Update database
    await query('UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE wallet_address = $2', ['SUSPENDED', walletAddress.toLowerCase()]);

    await blockchainService.logAudit(
      req.user!.walletAddress,
      'ADMIN',
      AuditAction.USER_DEACTIVATED,
      'USER',
      BigInt(0),
      user.identifier || '',
      AuditStatus.SUCCESS,
      '',
      { deactivatedWallet: walletAddress, previousStatus: user.status }
    );

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    logger.error('Error deactivating user', { error });
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
}

export async function reactivateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress || !ethers.utils.isAddress(walletAddress)) {
      res.status(400).json({ error: 'Invalid wallet address' });
      return;
    }

    const user = await queryOne('SELECT * FROM users WHERE wallet_address = $1', [walletAddress.toLowerCase()]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await blockchainService.reactivateUser(walletAddress);
    await query('UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE wallet_address = $2', ['ACTIVE', walletAddress.toLowerCase()]);

    await blockchainService.logAudit(
      req.user!.walletAddress,
      'ADMIN',
      AuditAction.USER_REACTIVATED,
      'USER',
      BigInt(0),
      user.identifier || '',
      AuditStatus.SUCCESS,
      '',
      { reactivatedWallet: walletAddress }
    );

    res.json({ message: 'User reactivated successfully' });
  } catch (error) {
    logger.error('Error reactivating user', { error });
    res.status(500).json({ error: 'Failed to reactivate user' });
  }
}

export async function getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { role, status, page = 1, limit = 20 } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (role) {
      whereClause += ` AND role = $${paramIndex++}`;
      params.push(role);
    }
    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit), offset);

    const users = await query(
      `SELECT id, name, wallet_address, role, email, identifier, status, created_at, last_login_at
       FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    const total = await queryOne(
      `SELECT COUNT(*) as count FROM users ${whereClause}`,
      params.slice(0, -2)
    );

    res.json({
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(total?.count || 0),
        totalPages: Math.ceil(Number(total?.count || 0) / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error getting users', { error });
    res.status(500).json({ error: 'Failed to get users' });
  }
}

export async function getPatients(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const patients = await query(
      `SELECT id, name, wallet_address, email, identifier, status, created_at, last_login_at
       FROM users WHERE role = 'PATIENT' AND status = 'ACTIVE'
       ORDER BY created_at DESC`
    );

    res.json({ patients });
  } catch (error) {
    logger.error('Error getting patients', { error });
    res.status(500).json({ error: 'Failed to get patients' });
  }
}

export async function getDoctors(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const doctors = await query(
      `SELECT id, name, wallet_address, email, identifier, status, created_at, last_login_at
       FROM users WHERE role = 'DOCTOR' AND status = 'ACTIVE'
       ORDER BY created_at DESC`
    );

    res.json({ doctors });
  } catch (error) {
    logger.error('Error getting doctors', { error });
    res.status(500).json({ error: 'Failed to get doctors' });
  }
}

export async function getUserByWallet(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { walletAddress } = req.params;

    if (!ethers.utils.isAddress(walletAddress)) {
      res.status(400).json({ error: 'Invalid wallet address' });
      return;
    }

    const user = await queryOne(
      `SELECT id, name, wallet_address, role, email, identifier, status, created_at, last_login_at
       FROM users WHERE wallet_address = $1`,
      [walletAddress.toLowerCase()]
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Also get blockchain info
    const blockchainUser = await blockchainService.getUser(walletAddress);

    res.json({ user, blockchainUser });
  } catch (error) {
    logger.error('Error getting user by wallet', { error });
    res.status(500).json({ error: 'Failed to get user' });
  }
}

export async function getDashboardStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (authReq.user!.role === 'ADMIN') {
      const [totalUsers, totalPatients, totalDoctors, totalRecords, pendingRequests] = await Promise.all([
        queryOne('SELECT COUNT(*) as count FROM users'),
        queryOne('SELECT COUNT(*) as count FROM users WHERE role = \'PATIENT\''),
        queryOne('SELECT COUNT(*) as count FROM users WHERE role = \'DOCTOR\''),
        queryOne('SELECT COUNT(*) as count FROM medical_records'),
        queryOne('SELECT COUNT(*) as count FROM access_requests WHERE status = \'PENDING\'')
      ]);

      const blockchainHealth = await blockchainService.healthCheck();

      res.json({
        stats: {
          totalUsers: Number(totalUsers?.count || 0),
          totalPatients: Number(totalPatients?.count || 0),
          totalDoctors: Number(totalDoctors?.count || 0),
          totalRecords: Number(totalRecords?.count || 0),
          pendingRequests: Number(pendingRequests?.count || 0)
        },
        blockchain: blockchainHealth
      });
    } else if (authReq.user!.role === 'PATIENT') {
      const [recordCount, pendingRequests, activePermissions] = await Promise.all([
        queryOne('SELECT COUNT(*) as count FROM medical_records WHERE patient_id = $1', [authReq.user!.userId]),
        queryOne('SELECT COUNT(*) as count FROM access_requests WHERE patient_id = $1 AND status = \'PENDING\'', [authReq.user!.userId]),
        queryOne('SELECT COUNT(*) as count FROM access_requests WHERE patient_id = $1 AND status = \'APPROVED\'', [authReq.user!.userId])
      ]);

      res.json({
        stats: {
          totalRecords: Number(recordCount?.count || 0),
          pendingRequests: Number(pendingRequests?.count || 0),
          activePermissions: Number(activePermissions?.count || 0)
        }
      });
    } else if (authReq.user!.role === 'DOCTOR') {
      const [pendingRequests, approvedAccess, availableRecords] = await Promise.all([
        queryOne('SELECT COUNT(*) as count FROM access_requests WHERE doctor_id = $1 AND status = \'PENDING\'', [authReq.user!.userId]),
        queryOne('SELECT COUNT(*) as count FROM access_requests WHERE doctor_id = $1 AND status = \'APPROVED\'', [authReq.user!.userId]),
        queryOne('SELECT COUNT(*) as count FROM access_requests WHERE doctor_id = $1 AND status = \'APPROVED\' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)', [authReq.user!.userId])
      ]);

      res.json({
        stats: {
          pendingRequests: Number(pendingRequests?.count || 0),
          approvedAccess: Number(approvedAccess?.count || 0),
          availableRecords: Number(availableRecords?.count || 0)
        }
      });
    } else {
      res.status(403).json({ error: 'Invalid role' });
    }
  } catch (error) {
    logger.error('Error getting dashboard stats', { error });
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
}