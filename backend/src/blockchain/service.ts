import { ethers } from 'ethers';
import { config } from '../config';
import { logger } from '../utils/logger';
import { query } from '../database/connection';

// Contract ABIs (minimal - only needed functions)
const USER_REGISTRY_ABI = [
  'function registerPatient(address walletAddress, string name, string email, string patientId) external returns (uint256)',
  'function registerDoctor(address walletAddress, string name, string email, string licenseNumber) external returns (uint256)',
  'function deactivateUser(address walletAddress) external',
  'function reactivateUser(address walletAddress) external',
  'function getUser(address walletAddress) external view returns (tuple(uint256 userId, address walletAddress, string name, string email, string identifier, uint8 role, uint8 status, uint256 registeredAt, address registeredBy, bool exists))',
  'function getUserById(uint256 userId) external view returns (tuple(uint256 userId, address walletAddress, string name, string email, string identifier, uint8 role, uint8 status, uint256 registeredAt, address registeredBy, bool exists))',
  'function isRegistered(address walletAddress) external view returns (bool)',
  'function hasUserRole(address walletAddress, uint8 role) external view returns (bool)',
  'function getUserRole(address walletAddress) external view returns (uint8)',
  'function getUserStatus(address walletAddress) external view returns (uint8)',
  'function getAllUsers() external view returns (address[] memory)',
  'function getPatients() external view returns (address[] memory)',
  'function getDoctors() external view returns (address[] memory)',
  'function getTotalUsers() external view returns (uint256)',
  'event UserRegistered(uint256 indexed userId, address indexed walletAddress, string name, uint8 role, address indexed registeredBy, uint256 timestamp)',
  'event UserStatusChanged(uint256 indexed userId, address indexed walletAddress, uint8 oldStatus, uint8 newStatus, address indexed changedBy, uint256 timestamp)'
];

const MEDICAL_RECORD_REGISTRY_ABI = [
  'function registerRecord(address patientAddress, uint8 recordType, string recordName, bytes32 fileHash, string storageCID, uint256 fileSize, string mimeType) external returns (uint256)',
  'function getRecord(uint256 recordId) external view returns (tuple(uint256 recordId, address patientAddress, uint8 recordType, string recordName, bytes32 fileHash, string storageCID, uint256 fileSize, string mimeType, uint256 uploadedAt, uint256 updatedAt, bool exists, bool isActive))',
  'function getPatientRecords(address patientAddress) external view returns (uint256[] memory)',
  'function getPatientRecordCount(address patientAddress) external view returns (uint256)',
  'function verifyFileIntegrity(uint256 recordId, bytes32 providedHash) external view returns (bool)',
  'function getTotalRecords() external view returns (uint256)',
  'event MedicalRecordRegistered(uint256 indexed recordId, address indexed patientAddress, uint8 recordType, string recordName, bytes32 fileHash, string storageCID, uint256 fileSize, address indexed registeredBy, uint256 timestamp)'
];

const CONSENT_MANAGER_ABI = [
  'function requestAccess(address patientAddress, uint256 recordId, uint8 accessLevel, string reason, string purpose, uint256 expiresAt) external returns (uint256)',
  'function approveAccess(uint256 requestId) external',
  'function denyAccess(uint256 requestId) external',
  'function revokeAccess(uint256 requestId) external',
  'function checkAccess(address doctorAddress, address patientAddress, uint256 recordId) external view returns (bool, uint8, uint256)',
  'function getRequest(uint256 requestId) external view returns (tuple(uint256 requestId, address patientAddress, address doctorAddress, uint256 recordId, uint8 accessLevel, string reason, string purpose, uint8 status, uint256 requestedAt, uint256 decidedAt, uint256 expiresAt, bytes32 patientSignature, bytes32 doctorSignature, string txHashRequested, string txHashDecided, bool exists))',
  'function getPatientRequests(address patientAddress) external view returns (uint256[] memory)',
  'function getDoctorRequests(address doctorAddress) external view returns (uint256[] memory)',
  'function getPendingRequestsForPatient(address patientAddress) external view returns (uint256[] memory)',
  'function getApprovedRequestsForDoctor(address doctorAddress) external view returns (uint256[] memory)',
  'event AccessRequested(uint256 indexed requestId, address indexed patientAddress, address indexed doctorAddress, uint256 recordId, uint8 accessLevel, string reason, uint256 expiresAt, uint256 timestamp)',
  'event AccessApproved(uint256 indexed requestId, address indexed patientAddress, address indexed doctorAddress, uint256 recordId, uint256 expiresAt, uint256 timestamp)',
  'event AccessDenied(uint256 indexed requestId, address indexed patientAddress, address indexed doctorAddress, uint256 recordId, uint256 timestamp)',
  'event AccessRevoked(uint256 indexed requestId, address indexed patientAddress, address indexed doctorAddress, uint256 recordId, uint256 timestamp)'
];

const AUDIT_LOG_ABI = [
  'function log(address actorWallet, string actorRole, uint8 action, string targetType, uint256 targetId, string targetIdentifier, uint8 status, string transactionHash, string metadata) external returns (uint256)',
  'function getLog(uint256 logId) external view returns (tuple(uint256 logId, address actorWallet, string actorRole, uint8 action, string targetType, uint256 targetId, string targetIdentifier, uint8 status, string transactionHash, string metadata, uint256 timestamp, uint256 blockNumber, bool exists))',
  'function getActorLogs(address actorWallet) external view returns (uint256[] memory)',
  'function getLogsByAction(uint8 action) external view returns (uint256[] memory)',
  'function getRecentLogs(uint256 count) external view returns (uint256[] memory)',
  'function getTotalLogs() external view returns (uint256)',
  'event AuditLogged(uint256 indexed logId, address indexed actorWallet, string actorRole, uint8 action, string targetType, uint256 targetId, uint8 status, string transactionHash, uint256 timestamp)'
];

export interface BlockchainUser {
  userId: bigint;
  walletAddress: string;
  name: string;
  email: string;
  identifier: string;
  role: number;
  status: number;
  registeredAt: bigint;
  registeredBy: string;
  exists: boolean;
}

export interface MedicalRecord {
  recordId: bigint;
  patientAddress: string;
  recordType: number;
  recordName: string;
  fileHash: string;
  storageCID: string;
  fileSize: bigint;
  mimeType: string;
  uploadedAt: bigint;
  updatedAt: bigint;
  exists: boolean;
  isActive: boolean;
}

export interface AccessRequest {
  requestId: bigint;
  patientAddress: string;
  doctorAddress: string;
  recordId: bigint;
  accessLevel: number;
  reason: string;
  purpose: string;
  status: number;
  requestedAt: bigint;
  decidedAt: bigint;
  expiresAt: bigint;
  exists: boolean;
}

export interface AuditEntry {
  logId: bigint;
  actorWallet: string;
  actorRole: string;
  action: number;
  targetType: string;
  targetId: bigint;
  targetIdentifier: string;
  status: number;
  transactionHash: string;
  metadata: string;
  timestamp: bigint;
  blockNumber: bigint;
  exists: boolean;
}

export enum UserRole {
  NONE = 0,
  ADMIN = 1,
  PATIENT = 2,
  DOCTOR = 3
}

export enum UserStatus {
  INACTIVE = 0,
  ACTIVE = 1,
  SUSPENDED = 2
}

export enum RecordType {
  GENERAL = 0,
  LAB_RESULT = 1,
  IMAGING = 2,
  PRESCRIPTION = 3,
  DISCHARGE_SUMMARY = 4,
  CONSULTATION = 5,
  VACCINATION = 6,
  OTHER = 7
}

export enum AccessLevel {
  FULL_RECORD = 0,
  SPECIFIC_RECORD = 1,
  RECORD_CATEGORY = 2
}

export enum ConsentStatus {
  PENDING = 0,
  APPROVED = 1,
  DENIED = 2,
  REVOKED = 3,
  EXPIRED = 4
}

export enum AuditAction {
  USER_REGISTERED = 0,
  USER_DEACTIVATED = 1,
  USER_REACTIVATED = 2,
  USER_LOGIN = 3,
  RECORD_UPLOADED = 4,
  RECORD_HASH_REGISTERED = 5,
  RECORD_UPDATED = 6,
  RECORD_DEACTIVATED = 7,
  ACCESS_REQUESTED = 8,
  ACCESS_APPROVED = 9,
  ACCESS_DENIED = 10,
  ACCESS_REVOKED = 11,
  ACCESS_EXPIRED = 12,
  RECORD_ACCESSED = 13,
  RECORD_DOWNLOADED = 14,
  ADMIN_ACTION = 15,
  CONTRACT_DEPLOYED = 16,
  CONTRACT_UPDATED = 17,
  ROLE_ASSIGNED = 18,
  ROLE_REVOKED = 19,
  EMERGENCY_ACCESS = 20,
  CONSENT_WITHDRAWN = 21
}

export enum AuditStatus {
  SUCCESS = 0,
  FAILED = 1,
  PENDING = 2,
  REVERTED = 3
}

function extractReasonFromMessage(message: string): string | null {
  if (!message) return null;

  // ethers v5 encodes custom revert strings as:
  //   "Error: VM Exception while processing transaction: reverted with reason string 'UserRegistry: caller is not a registrar'"
  // or JSON-RPC bubble form:
  //   "execution reverted: UserRegistry: caller is not a registrar"
  const quoted = /reverted with reason string\s+'([^']+)'/.exec(message);
  if (quoted && quoted[1]) return quoted[1];

  const afterRevert = /(?:execution\s+)?revert(?:ed)?(?:\s+with?\s+reason string)?\s*:?\s*'?([^'"]+)/i.exec(message);
  if (afterRevert && afterRevert[1] && afterRevert[1].trim()) {
    const reason = afterRevert[1].trim();
    // Avoid returning generic RPC boilerplate
    if (!/^VM Exception|^tracked|^processing transaction/i.test(reason)) {
      return reason;
    }
  }

  return null;
}

function extractRevertReason(error: any): string | null {
  if (!error) return null;

  // ethers v5 wraps the RPC error; the clean revert reason is typically nested
  const candidates: any[] = [
    error?.error?.error?.reason,
    error?.error?.reason,
    error?.reason,
    error?.error?.error?.data?.reason,
    error?.error?.data?.reason,
    error?.data?.reason,
    error?.error?.error?.message,
    error?.error?.message,
    error?.message
  ];

  for (const c of candidates) {
    if (typeof c === 'string') {
      const clean = extractReasonFromMessage(c);
      if (clean) return clean;
    }
  }

  // Parse revert message from the RPC body if present
  const body = error?.error?.error?.body || error?.body || '';
  if (body) {
    const quoted = /reverted with reason string\s+'([^']+)'/.exec(body);
    if (quoted && quoted[1]) return quoted[1];
    const m = /"message":"(?:VM Exception while processing transaction:\s*)?(revert(?:ed)?[^"]*)"/i.exec(body);
    if (m && m[1]) {
      const clean = extractReasonFromMessage(m[1]);
      if (clean) return clean;
    }
  }

  return null;
}

class BlockchainService {
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private userRegistry: ethers.Contract;
  private medicalRecordRegistry: ethers.Contract;
  private consentManager: ethers.Contract;
  private auditLog: ethers.Contract;
  private initialized = false;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl);
    this.wallet = new ethers.Wallet(config.blockchain.backendPrivateKey, this.provider);
    
    this.userRegistry = new ethers.Contract(
      config.blockchain.contracts.userRegistry,
      USER_REGISTRY_ABI,
      this.wallet
    );
    
    this.medicalRecordRegistry = new ethers.Contract(
      config.blockchain.contracts.medicalRecordRegistry,
      MEDICAL_RECORD_REGISTRY_ABI,
      this.wallet
    );
    
    this.consentManager = new ethers.Contract(
      config.blockchain.contracts.consentManager,
      CONSENT_MANAGER_ABI,
      this.wallet
    );
    
    this.auditLog = new ethers.Contract(
      config.blockchain.contracts.auditLog,
      AUDIT_LOG_ABI,
      this.wallet
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Test connection
      const network = await this.provider.getNetwork();
      logger.info('Connected to blockchain', { 
        chainId: network.chainId, 
        name: network.name,
        blockNumber: await this.provider.getBlockNumber()
      });

      // Verify contracts exist
      const code = await this.provider.getCode(config.blockchain.contracts.userRegistry);
      if (code === '0x') {
        throw new Error('UserRegistry contract not deployed at address');
      }

      this.initialized = true;
      logger.info('Blockchain service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize blockchain service', { error });
      throw error;
    }
  }

  // User Registry
  async registerPatient(walletAddress: string, name: string, email: string, patientId: string): Promise<bigint> {
    try {
      const tx = await this.userRegistry.registerPatient(walletAddress, name, email, patientId);
      logger.info('Patient registration transaction submitted', { walletAddress, txHash: tx.hash });
      const receipt = await tx.wait();
      logger.info('Patient registered on blockchain', { walletAddress, txHash: receipt.transactionHash });
      return await this.extractUserId(receipt, walletAddress, 'Patient');
    } catch (error) {
      const reason = extractRevertReason(error);
      logger.error('Blockchain registerPatient failed', { walletAddress, reason });
      throw new Error(reason || 'Blockchain transaction failed');
    }
  }

  async registerDoctor(walletAddress: string, name: string, email: string, licenseNumber: string): Promise<bigint> {
    try {
      const tx = await this.userRegistry.registerDoctor(walletAddress, name, email, licenseNumber);
      logger.info('Doctor registration transaction submitted', { walletAddress, txHash: tx.hash });
      const receipt = await tx.wait();
      logger.info('Doctor registered on blockchain', { walletAddress, txHash: receipt.transactionHash });
      return await this.extractUserId(receipt, walletAddress, 'Doctor');
    } catch (error) {
      const reason = extractRevertReason(error);
      logger.error('Blockchain registerDoctor failed', { walletAddress, reason });
      throw new Error(reason || 'Blockchain transaction failed');
    }
  }

  /**
   * Extract the issued userId from the UserRegistered event.
   * If the event cannot be parsed (e.g. provider pruning or receipt variance),
   * fall back to reading the on-chain user by wallet so the DB never stores a
   * bogus id (which would desync DB from blockchain).
   */
  private async extractUserId(receipt: any, walletAddress: string, label: string): Promise<bigint> {
    const fromEvent = this.extractEventArg(receipt, this.userRegistry.interface, 'UserRegistered', 'userId');
    if (fromEvent !== 0n) {
      return fromEvent;
    }
    // Fallback: derive the authoritative id from on-chain state.
    try {
      const user = await this.getUser(walletAddress);
      if (user && user.exists && user.userId !== 0n) {
        logger.warn(`${label} userId not found in event logs; read from chain instead`, { walletAddress, userId: user.userId.toString() });
        return user.userId;
      }
    } catch (e) {
      logger.error(`${label} on-chain userId lookup failed`, { walletAddress, error: e });
    }
    throw new Error(`Could not determine ${label.toLowerCase()} userId from blockchain`);
  }

  private extractEventArg(receipt: any, iface: any, eventName: string, argName: string): bigint {
    // Decode a named event from the receipt logs (ethers v5 doesn't auto-populate receipt.events)
    const logs = receipt?.logs || [];
    for (const log of logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === eventName) {
          const val = parsed.args[argName];
          return val !== undefined ? BigInt(val.toString()) : 0n;
        }
      } catch {
        // not a log for this interface; skip
      }
    }
    return 0n;
  }

  async deactivateUser(walletAddress: string): Promise<string> {
    const tx = await this.userRegistry.deactivateUser(walletAddress);
    const receipt = await tx.wait();
    logger.info('User deactivated on blockchain', { walletAddress, txHash: receipt.transactionHash });
    return receipt.transactionHash;
  }

  async reactivateUser(walletAddress: string): Promise<string> {
    const tx = await this.userRegistry.reactivateUser(walletAddress);
    const receipt = await tx.wait();
    logger.info('User reactivated on blockchain', { walletAddress, txHash: receipt.transactionHash });
    return receipt.transactionHash;
  }

  async getUser(walletAddress: string): Promise<BlockchainUser | null> {
    const user = await this.userRegistry.getUser(walletAddress);
    if (!user.exists) return null;
    return {
      userId: user.userId,
      walletAddress: user.walletAddress,
      name: user.name,
      email: user.email,
      identifier: user.identifier,
      role: user.role,
      status: user.status,
      registeredAt: user.registeredAt,
      registeredBy: user.registeredBy,
      exists: user.exists
    };
  }

  async getUserById(userId: bigint): Promise<BlockchainUser | null> {
    const user = await this.userRegistry.getUserById(userId);
    if (!user.exists) return null;
    return {
      userId: user.userId,
      walletAddress: user.walletAddress,
      name: user.name,
      email: user.email,
      identifier: user.identifier,
      role: user.role,
      status: user.status,
      registeredAt: user.registeredAt,
      registeredBy: user.registeredBy,
      exists: user.exists
    };
  }

  async isRegistered(walletAddress: string): Promise<boolean> {
    return this.userRegistry.isRegistered(walletAddress);
  }

  async hasUserRole(walletAddress: string, role: UserRole): Promise<boolean> {
    return this.userRegistry.hasUserRole(walletAddress, role);
  }

  async getUserRole(walletAddress: string): Promise<UserRole> {
    return this.userRegistry.getUserRole(walletAddress);
  }

  async getAllUsers(): Promise<string[]> {
    return this.userRegistry.getAllUsers();
  }

  async getPatients(): Promise<string[]> {
    return this.userRegistry.getPatients();
  }

  async getDoctors(): Promise<string[]> {
    return this.userRegistry.getDoctors();
  }

  // Medical Record Registry
  async registerRecord(
    patientAddress: string,
    recordType: RecordType,
    recordName: string,
    fileHash: string,
    storageCID: string,
    fileSize: number,
    mimeType: string
  ): Promise<bigint> {
    const tx = await this.medicalRecordRegistry.registerRecord(
      patientAddress,
      recordType,
      recordName,
      fileHash,
      storageCID,
      fileSize,
      mimeType
    );
    const receipt = await tx.wait();
    logger.info('Medical record registered on blockchain', { 
      patientAddress, 
      recordName, 
      txHash: receipt.transactionHash 
    });
    return this.extractEventArg(receipt, this.medicalRecordRegistry.interface, 'MedicalRecordRegistered', 'recordId');
  }

  async getRecord(recordId: bigint): Promise<MedicalRecord | null> {
    const record = await this.medicalRecordRegistry.getRecord(recordId);
    if (!record.exists) return null;
    return {
      recordId: record.recordId,
      patientAddress: record.patientAddress,
      recordType: record.recordType,
      recordName: record.recordName,
      fileHash: record.fileHash,
      storageCID: record.storageCID,
      fileSize: record.fileSize,
      mimeType: record.mimeType,
      uploadedAt: record.uploadedAt,
      updatedAt: record.updatedAt,
      exists: record.exists,
      isActive: record.isActive
    };
  }

  async getPatientRecords(patientAddress: string): Promise<bigint[]> {
    return this.medicalRecordRegistry.getPatientRecords(patientAddress);
  }

  async verifyFileIntegrity(recordId: bigint, fileHash: string): Promise<boolean> {
    return this.medicalRecordRegistry.verifyFileIntegrity(recordId, fileHash);
  }

  // Consent Manager
  async requestAccess(
    patientAddress: string,
    recordId: bigint,
    accessLevel: AccessLevel,
    reason: string,
    purpose: string,
    expiresAt: number
  ): Promise<bigint> {
    const tx = await this.consentManager.requestAccess(
      patientAddress,
      recordId,
      accessLevel,
      reason,
      purpose,
      expiresAt
    );
    const receipt = await tx.wait();
    logger.info('Access requested on blockchain', { 
      patientAddress, 
      doctorAddress: this.wallet.address,
      txHash: receipt.transactionHash 
    });
    return this.extractEventArg(receipt, this.consentManager.interface, 'AccessRequested', 'requestId');
  }

  async approveAccess(requestId: bigint, patientWallet: ethers.Signer): Promise<string> {
    const contract = this.consentManager.connect(patientWallet);
    const tx = await contract.approveAccess(requestId);
    const receipt = await tx.wait();
    logger.info('Access approved on blockchain', { requestId: requestId.toString(), txHash: receipt.transactionHash });
    return receipt.transactionHash;
  }

  async denyAccess(requestId: bigint, patientWallet: ethers.Signer): Promise<string> {
    const contract = this.consentManager.connect(patientWallet);
    const tx = await contract.denyAccess(requestId);
    const receipt = await tx.wait();
    logger.info('Access denied on blockchain', { requestId: requestId.toString(), txHash: receipt.transactionHash });
    return receipt.transactionHash;
  }

  async revokeAccess(requestId: bigint, patientWallet: ethers.Signer): Promise<string> {
    const contract = this.consentManager.connect(patientWallet);
    const tx = await contract.revokeAccess(requestId);
    const receipt = await tx.wait();
    logger.info('Access revoked on blockchain', { requestId: requestId.toString(), txHash: receipt.transactionHash });
    return receipt.transactionHash;
  }

  async checkAccess(doctorAddress: string, patientAddress: string, recordId: bigint): Promise<{ hasAccess: boolean; status: ConsentStatus; expiresAt: bigint }> {
    const [hasAccess, status, expiresAt] = await this.consentManager.checkAccess(doctorAddress, patientAddress, recordId);
    return { hasAccess, status: status as ConsentStatus, expiresAt };
  }

  async getRequest(requestId: bigint): Promise<AccessRequest | null> {
    const request = await this.consentManager.getRequest(requestId);
    if (!request.exists) return null;
    return {
      requestId: request.requestId,
      patientAddress: request.patientAddress,
      doctorAddress: request.doctorAddress,
      recordId: request.recordId,
      accessLevel: request.accessLevel,
      reason: request.reason,
      purpose: request.purpose,
      status: request.status,
      requestedAt: request.requestedAt,
      decidedAt: request.decidedAt,
      expiresAt: request.expiresAt,
      exists: request.exists
    };
  }

  async getPatientRequests(patientAddress: string): Promise<bigint[]> {
    return this.consentManager.getPatientRequests(patientAddress);
  }

  async getDoctorRequests(doctorAddress: string): Promise<bigint[]> {
    return this.consentManager.getDoctorRequests(doctorAddress);
  }

  async getPendingRequestsForPatient(patientAddress: string): Promise<bigint[]> {
    return this.consentManager.getPendingRequestsForPatient(patientAddress);
  }

  async getApprovedRequestsForDoctor(doctorAddress: string): Promise<bigint[]> {
    return this.consentManager.getApprovedRequestsForDoctor(doctorAddress);
  }

  // Audit Log
  async logAudit(
    actorWallet: string,
    actorRole: string,
    action: AuditAction,
    targetType: string,
    targetId: bigint,
    targetIdentifier: string,
    status: AuditStatus,
    transactionHash: string,
    metadata: object
  ): Promise<bigint> {
    const tx = await this.auditLog.log(
      actorWallet,
      actorRole,
      action,
      targetType,
      targetId,
      targetIdentifier,
      status,
      transactionHash,
      JSON.stringify(metadata)
    );
    const receipt = await tx.wait();
    const logId = this.extractEventArg(receipt, this.auditLog.interface, 'AuditLogged', 'logId');

    try {
      await query(
        `INSERT INTO audit_logs
           (actor_wallet, actor_role, action, target_type, target_identifier, status, transaction_hash, metadata, block_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          actorWallet.toLowerCase(),
          actorRole,
          AuditAction[action],
          targetType || null,
          targetIdentifier || null,
          AuditStatus[status],
          transactionHash || null,
          metadata,
          receipt.blockNumber || null
        ]
      );
    } catch (dbErr) {
      logger.error('Failed to persist audit log to DB', { error: dbErr, action: AuditAction[action] });
    }

    return logId;
  }

  async getAuditLog(logId: bigint): Promise<AuditEntry | null> {
    const log = await this.auditLog.getLog(logId);
    if (!log.exists) return null;
    return {
      logId: log.logId,
      actorWallet: log.actorWallet,
      actorRole: log.actorRole,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      targetIdentifier: log.targetIdentifier,
      status: log.status,
      transactionHash: log.transactionHash,
      metadata: log.metadata,
      timestamp: log.timestamp,
      blockNumber: log.blockNumber,
      exists: log.exists
    };
  }

  async getActorLogs(actorWallet: string): Promise<bigint[]> {
    return this.auditLog.getActorLogs(actorWallet);
  }

  async getLogsByAction(action: AuditAction): Promise<bigint[]> {
    return this.auditLog.getLogsByAction(action);
  }

  async getRecentLogs(count: number): Promise<bigint[]> {
    return this.auditLog.getRecentLogs(count);
  }

  // Health check
  async healthCheck(): Promise<{ connected: boolean; blockNumber: number; chainId: number }> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      const network = await this.provider.getNetwork();
      return { connected: true, blockNumber, chainId: network.chainId };
    } catch (error) {
      return { connected: false, blockNumber: 0, chainId: 0 };
    }
  }

  getProvider(): ethers.providers.JsonRpcProvider {
    return this.provider;
  }

  getWallet(): ethers.Wallet {
    return this.wallet;
  }
}

export const blockchainService = new BlockchainService();
export default blockchainService;