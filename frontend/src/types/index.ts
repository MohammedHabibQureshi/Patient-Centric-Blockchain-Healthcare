export type UserRole = 'ADMIN' | 'PATIENT' | 'DOCTOR';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  name: string;
  walletAddress: string;
  role: UserRole;
  email?: string;
  identifier?: string;
  status: UserStatus;
  createdAt: string;
  lastLoginAt?: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  recordType: RecordType;
  recordName: string;
  fileHash: string;
  storageCid: string;
  fileSize: number;
  mimeType: string;
  blockchainRecordId?: string;
  isActive: boolean;
  uploadedAt: string;
  updatedAt: string;
  patientName?: string;
  patientWallet?: string;
  blockchainRecord?: BlockchainMedicalRecord;
}

export type RecordType = 'GENERAL' | 'LAB_RESULT' | 'IMAGING' | 'PRESCRIPTION' | 'DISCHARGE_SUMMARY' | 'CONSULTATION' | 'VACCINATION' | 'OTHER';

export interface BlockchainMedicalRecord {
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
  id: string;
  patientId: string;
  doctorId: string;
  recordId?: string;
  reason: string;
  purpose: string;
  accessLevel: AccessLevel;
  status: ConsentStatus;
  blockchainRequestId?: string;
  requestedAt: string;
  decidedAt?: string;
  expiresAt?: string;
  txHashRequested?: string;
  txHashDecided?: string;
  patientName?: string;
  patientWallet?: string;
  doctorName?: string;
  doctorWallet?: string;
  recordName?: string;
  blockchainRequest?: BlockchainAccessRequest;
}

export type AccessLevel = 'FULL_RECORD' | 'SPECIFIC_RECORD' | 'RECORD_CATEGORY';
export type ConsentStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'REVOKED' | 'EXPIRED';

export interface BlockchainAccessRequest {
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

export interface AuditLog {
  id: string;
  actorWallet: string;
  actorRole: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  targetIdentifier?: string;
  status: AuditStatus;
  transactionHash?: string;
  metadata?: Record<string, any>;
  timestamp: string;
  blockNumber?: number;
}

export type AuditAction = 
  | 'USER_REGISTERED' | 'USER_DEACTIVATED' | 'USER_REACTIVATED' | 'USER_LOGIN'
  | 'RECORD_UPLOADED' | 'RECORD_HASH_REGISTERED' | 'RECORD_UPDATED' | 'RECORD_DEACTIVATED'
  | 'ACCESS_REQUESTED' | 'ACCESS_APPROVED' | 'ACCESS_DENIED' | 'ACCESS_REVOKED' | 'ACCESS_EXPIRED'
  | 'RECORD_ACCESSED' | 'RECORD_DOWNLOADED'
  | 'ADMIN_ACTION' | 'CONTRACT_DEPLOYED' | 'CONTRACT_UPDATED' | 'ROLE_ASSIGNED' | 'ROLE_REVOKED'
  | 'EMERGENCY_ACCESS' | 'CONSENT_WITHDRAWN';

export type AuditStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'REVERTED';

export interface DashboardStats {
  totalUsers?: number;
  totalPatients?: number;
  totalDoctors?: number;
  totalRecords?: number;
  pendingRequests?: number;
  activePermissions?: number;
  approvedAccess?: number;
  availableRecords?: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  referenceType?: string;
  referenceId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface WalletState {
  isConnected: boolean;
  address?: string;
  chainId?: number;
  balance?: string;
  isCorrectNetwork: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user?: User;
  tokens?: AuthTokens;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}