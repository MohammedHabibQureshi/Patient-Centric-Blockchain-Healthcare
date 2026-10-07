import { Request, Response } from 'express';
import { blockchainService, AuditAction, AuditStatus } from '../blockchain/service';
import { storageService } from '../storage/service';
import { query, queryOne } from '../database/connection';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

// Blockchain audit entries contain bigint fields (logId, targetId, timestamp,
// blockNumber) which JSON.stringify cannot serialize. Convert them to strings.
function sanitizeBlockchainLog(log: any): any {
  if (!log || typeof log !== 'object') return log;
  const out: any = {};
  for (const key of Object.keys(log)) {
    const value = (log as any)[key];
    if (typeof value === 'bigint') {
      out[key] = value.toString();
    } else if (value !== null && typeof value === 'object') {
      out[key] = sanitizeBlockchainLog(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { action, actorWallet, targetType, targetId, page = 1, limit = 50, startDate, endDate } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    // Non-admin users can only see their own logs
    if (req.user!.role !== 'ADMIN') {
      whereClause += ` AND LOWER(actor_wallet) = LOWER($${paramIndex++})`;
      params.push(req.user!.walletAddress);
    }

    if (action) {
      whereClause += ` AND action = $${paramIndex++}`;
      params.push(action);
    }
    if (actorWallet && req.user!.role === 'ADMIN') {
      whereClause += ` AND LOWER(actor_wallet) = LOWER($${paramIndex++})`;
      params.push(actorWallet);
    }
    if (targetType) {
      whereClause += ` AND target_type = $${paramIndex++}`;
      params.push(targetType);
    }
    if (targetId) {
      whereClause += ` AND target_id = $${paramIndex++}`;
      params.push(targetId);
    }
    if (startDate) {
      whereClause += ` AND timestamp >= $${paramIndex++}`;
      params.push(new Date(startDate as string));
    }
    if (endDate) {
      whereClause += ` AND timestamp <= $${paramIndex++}`;
      params.push(new Date(endDate as string));
    }

    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit), offset);

    const logs = await query(
      `SELECT * FROM audit_logs ${whereClause}
       ORDER BY timestamp DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    const total = await queryOne(
      `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
      params.slice(0, -2)
    );

    // Also get recent blockchain audit logs (admin only)
    let blockchainLogsWithDetails: any[] = [];
    if (req.user!.role === 'ADMIN') {
      try {
        const blockchainLogs = await blockchainService.getRecentLogs(100);
        blockchainLogsWithDetails = await Promise.all(
          blockchainLogs.map(async (logId) => {
            return await blockchainService.getAuditLog(logId);
          })
        );
        blockchainLogsWithDetails = blockchainLogsWithDetails.filter(Boolean);
      } catch (e) {
        logger.warn('Failed to fetch blockchain audit logs', { error: e });
      }
    }

    res.json({
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(total?.count || 0),
        totalPages: Math.ceil(Number(total?.count || 0) / Number(limit))
      },
      blockchainLogs: blockchainLogsWithDetails.map(sanitizeBlockchainLog)
    });
  } catch (error) {
    logger.error('Error getting audit logs', { error });
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
}

export async function getAuditLogById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { logId } = req.params;

    // Try database first
    const dbLog = await queryOne('SELECT * FROM audit_logs WHERE id = $1', [logId]);
    if (dbLog) {
      // Non-admin users can only see their own logs
      if (req.user!.role !== 'ADMIN' && dbLog.actor_wallet?.toLowerCase() !== req.user!.walletAddress?.toLowerCase()) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      res.json({ log: dbLog, source: 'database' });
      return;
    }

    // Try blockchain (only if logId is numeric)
    if (/^\d+$/.test(logId)) {
      const blockchainLog = await blockchainService.getAuditLog(BigInt(logId));
      if (blockchainLog) {
        res.json({ log: sanitizeBlockchainLog(blockchainLog), source: 'blockchain' });
        return;
      }
    }

    res.status(404).json({ error: 'Audit log not found' });
  } catch (error) {
    logger.error('Error getting audit log by ID', { error });
    res.status(500).json({ error: 'Failed to get audit log' });
  }
}

export async function getActorAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { walletAddress } = req.params;

    // Non-admin users can only see their own logs
    if (req.user!.role !== 'ADMIN' && walletAddress.toLowerCase() !== req.user!.walletAddress?.toLowerCase()) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const dbLogs = await query(
      'SELECT * FROM audit_logs WHERE LOWER(actor_wallet) = LOWER($1) ORDER BY timestamp DESC LIMIT 100',
      [walletAddress]
    );

    let blockchainLogs: any[] = [];
    try {
      const blockchainLogIds = await blockchainService.getActorLogs(walletAddress.toLowerCase());
      blockchainLogs = await Promise.all(
        blockchainLogIds.slice(0, 100).map(async (logId) => {
          return await blockchainService.getAuditLog(logId);
        })
      );
      blockchainLogs = blockchainLogs.filter(Boolean);
    } catch (e) {
      // Blockchain logs are optional
    }

    res.json({
      databaseLogs: dbLogs,
      blockchainLogs: blockchainLogs.map(sanitizeBlockchainLog)
    });
  } catch (error) {
    logger.error('Error getting actor audit logs', { error });
    res.status(500).json({ error: 'Failed to get actor audit logs' });
  }
}

export async function getSystemHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Database health
    const dbHealth = await queryOne('SELECT 1 as alive');
    const dbConnected = !!dbHealth;

    // Blockchain health
    const blockchainHealth = await blockchainService.healthCheck();

    // Storage health
    const storageStats = await storageService.getStorageStats();

    // Contract addresses
    const contracts = {
      userRegistry: blockchainService['userRegistry']?.address || 'Not configured',
      medicalRecordRegistry: blockchainService['medicalRecordRegistry']?.address || 'Not configured',
      consentManager: blockchainService['consentManager']?.address || 'Not configured',
      auditLog: blockchainService['auditLog']?.address || 'Not configured'
    };

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: dbConnected ? 'online' : 'offline' },
        blockchain: blockchainHealth.connected ? { 
          status: 'online', 
          blockNumber: blockchainHealth.blockNumber,
          chainId: blockchainHealth.chainId
        } : { status: 'offline' },
        storage: { 
          status: 'online', 
          totalFiles: storageStats.totalFiles,
          totalSizeBytes: storageStats.totalSize
        }
      },
      contracts,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        chainId: process.env.CHAIN_ID,
        rpcUrl: process.env.RPC_URL
      }
    });
  } catch (error) {
    logger.error('Error getting system health', { error });
    res.status(500).json({ error: 'Failed to get system health' });
  }
}