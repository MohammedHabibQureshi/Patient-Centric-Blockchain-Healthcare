// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title AuditLog
 * @dev Immutable audit trail for all critical system actions.
 * Records metadata without storing sensitive medical information.
 */
contract AuditLog is AccessControl {
    using Counters for Counters.Counter;

    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant SYSTEM_ROLE = keccak256("SYSTEM_ROLE");

    Counters.Counter private _logIdCounter;

    enum AuditAction {
        USER_REGISTERED,
        USER_DEACTIVATED,
        USER_REACTIVATED,
        USER_LOGIN,
        RECORD_UPLOADED,
        RECORD_HASH_REGISTERED,
        RECORD_UPDATED,
        RECORD_DEACTIVATED,
        ACCESS_REQUESTED,
        ACCESS_APPROVED,
        ACCESS_DENIED,
        ACCESS_REVOKED,
        ACCESS_EXPIRED,
        RECORD_ACCESSED,
        RECORD_DOWNLOADED,
        ADMIN_ACTION,
        CONTRACT_DEPLOYED,
        CONTRACT_UPDATED,
        ROLE_ASSIGNED,
        ROLE_REVOKED,
        EMERGENCY_ACCESS,
        CONSENT_WITHDRAWN
    }

    enum AuditStatus {
        SUCCESS,
        FAILED,
        PENDING,
        REVERTED
    }

    struct AuditEntry {
        uint256 logId;
        address actorWallet;
        string actorRole;
        AuditAction action;
        string targetType;
        uint256 targetId;
        string targetIdentifier;
        AuditStatus status;
        string transactionHash;
        string metadata; // JSON string for additional context
        uint256 timestamp;
        uint256 blockNumber;
        bool exists;
    }

    mapping(uint256 => AuditEntry) public logs;
    mapping(address => uint256[]) public actorLogs;
    uint256[] public allLogs;

    event AuditLogged(
        uint256 indexed logId,
        address indexed actorWallet,
        string actorRole,
        AuditAction action,
        string targetType,
        uint256 targetId,
        AuditStatus status,
        string transactionHash,
        uint256 timestamp
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AUDITOR_ROLE, msg.sender);
        _grantRole(SYSTEM_ROLE, msg.sender);
    }

    modifier onlySystemOrAuditor() {
        require(
            hasRole(SYSTEM_ROLE, msg.sender) || hasRole(AUDITOR_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "AuditLog: only system or auditor can log"
        );
        _;
    }

    modifier logExists(uint256 logId) {
        require(logs[logId].exists, "AuditLog: log entry does not exist");
        _;
    }

    /**
     * @dev Log an audit entry (only SYSTEM_ROLE, AUDITOR_ROLE, or ADMIN)
     */
    function log(
        address actorWallet,
        string calldata actorRole,
        AuditAction action,
        string calldata targetType,
        uint256 targetId,
        string calldata targetIdentifier,
        AuditStatus status,
        string calldata transactionHash,
        string calldata metadata
    ) external onlySystemOrAuditor returns (uint256) {
        _logIdCounter.increment();
        uint256 logId = _logIdCounter.current();

        logs[logId] = AuditEntry({
            logId: logId,
            actorWallet: actorWallet,
            actorRole: actorRole,
            action: action,
            targetType: targetType,
            targetId: targetId,
            targetIdentifier: targetIdentifier,
            status: status,
            transactionHash: transactionHash,
            metadata: metadata,
            timestamp: block.timestamp,
            blockNumber: block.number,
            exists: true
        });

        actorLogs[actorWallet].push(logId);
        allLogs.push(logId);

        emit AuditLogged(
            logId,
            actorWallet,
            actorRole,
            action,
            targetType,
            targetId,
            status,
            transactionHash,
            block.timestamp
        );

        return logId;
    }

    /**
     * @dev Get audit entry by ID
     */
    function getLog(uint256 logId) external view logExists(logId) returns (AuditEntry memory) {
        return logs[logId];
    }

    /**
     * @dev Get all log IDs for an actor
     */
    function getActorLogs(address actorWallet) external view returns (uint256[] memory) {
        return actorLogs[actorWallet];
    }

    /**
     * @dev Get logs by action type
     */
    function getLogsByAction(AuditAction action) external view returns (uint256[] memory) {
        uint256[] memory filtered = new uint256[](allLogs.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < allLogs.length; i++) {
            if (logs[allLogs[i]].action == action) {
                filtered[count] = allLogs[i];
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = filtered[i];
        }
        return result;
    }

    /**
     * @dev Get logs by target (e.g., specific patient, record)
     */
    function getLogsByTarget(string calldata targetType, uint256 targetId) external view returns (uint256[] memory) {
        uint256[] memory filtered = new uint256[](allLogs.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < allLogs.length; i++) {
            AuditEntry storage log = logs[allLogs[i]];
            if (keccak256(bytes(log.targetType)) == keccak256(bytes(targetType)) && log.targetId == targetId) {
                filtered[count] = allLogs[i];
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = filtered[i];
        }
        return result;
    }

    /**
     * @dev Get recent logs (last N entries)
     */
    function getRecentLogs(uint256 count) external view returns (uint256[] memory) {
        uint256 length = allLogs.length;
        uint256 start = length > count ? length - count : 0;
        uint256 actualCount = length - start;
        
        uint256[] memory result = new uint256[](actualCount);
        for (uint256 i = 0; i < actualCount; i++) {
            result[i] = allLogs[start + i];
        }
        return result;
    }

    /**
     * @dev Get total log count
     */
    function getTotalLogs() external view returns (uint256) {
        return allLogs.length;
    }

    /**
     * @dev Get logs in range (for pagination)
     */
    function getLogsInRange(uint256 start, uint256 end) external view returns (uint256[] memory) {
        require(start <= end, "AuditLog: invalid range");
        require(end <= allLogs.length, "AuditLog: end exceeds log count");
        
        uint256 count = end - start;
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = allLogs[start + i];
        }
        return result;
    }
}