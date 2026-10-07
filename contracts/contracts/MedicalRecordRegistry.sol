// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./UserRegistry.sol";

/**
 * @title MedicalRecordRegistry
 * @dev Stores medical record metadata on-chain (hash, CID, timestamps).
 * Actual medical files are stored off-chain (encrypted).
 * Only authorized services can register records.
 */
contract MedicalRecordRegistry is AccessControl {
    using Counters for Counters.Counter;

    bytes32 public constant RECORD_REGISTRAR_ROLE = keccak256("RECORD_REGISTRAR_ROLE");
    bytes32 public constant PATIENT_ROLE = keccak256("PATIENT_ROLE");

    Counters.Counter private _recordIdCounter;

    enum RecordType {
        GENERAL,
        LAB_RESULT,
        IMAGING,
        PRESCRIPTION,
        DISCHARGE_SUMMARY,
        CONSULTATION,
        VACCINATION,
        OTHER
    }

    struct MedicalRecord {
        uint256 recordId;
        address patientAddress;
        RecordType recordType;
        string recordName;
        bytes32 fileHash; // SHA-256 hash of the original file
        string storageCID; // IPFS CID or storage reference
        uint256 fileSize;
        string mimeType;
        uint256 uploadedAt;
        uint256 updatedAt;
        bool exists;
        bool isActive;
    }

    mapping(uint256 => MedicalRecord) public records;
    mapping(address => uint256[]) public patientRecords;
    uint256[] public allRecords;

    event MedicalRecordRegistered(
        uint256 indexed recordId,
        address indexed patientAddress,
        RecordType recordType,
        string recordName,
        bytes32 fileHash,
        string storageCID,
        uint256 fileSize,
        address indexed registeredBy,
        uint256 timestamp
    );

    event MedicalRecordUpdated(
        uint256 indexed recordId,
        address indexed patientAddress,
        address indexed updatedBy,
        uint256 timestamp
    );

    event MedicalRecordDeactivated(
        uint256 indexed recordId,
        address indexed patientAddress,
        address indexed deactivatedBy,
        uint256 timestamp
    );

    constructor(address userRegistryAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RECORD_REGISTRAR_ROLE, msg.sender);
        // Grant registrar role to the UserRegistry contract for automatic registration
        _grantRole(RECORD_REGISTRAR_ROLE, userRegistryAddress);
    }

    modifier onlyRecordRegistrar() {
        require(hasRole(RECORD_REGISTRAR_ROLE, msg.sender), "MedicalRecordRegistry: not authorized registrar");
        _;
    }

    modifier recordExists(uint256 recordId) {
        require(records[recordId].exists, "MedicalRecordRegistry: record does not exist");
        _;
    }

    modifier onlyPatientOrRegistrar(uint256 recordId) {
        require(
            msg.sender == records[recordId].patientAddress || hasRole(RECORD_REGISTRAR_ROLE, msg.sender),
            "MedicalRecordRegistry: only patient or registrar can perform this action"
        );
        _;
    }

    /**
     * @dev Register a new medical record metadata
     */
    function registerRecord(
        address patientAddress,
        RecordType recordType,
        string calldata recordName,
        bytes32 fileHash,
        string calldata storageCID,
        uint256 fileSize,
        string calldata mimeType
    ) external onlyRecordRegistrar returns (uint256) {
        require(patientAddress != address(0), "MedicalRecordRegistry: invalid patient address");
        require(bytes(recordName).length > 0, "MedicalRecordRegistry: record name cannot be empty");
        require(fileHash != bytes32(0), "MedicalRecordRegistry: file hash cannot be zero");
        require(bytes(storageCID).length > 0, "MedicalRecordRegistry: storage CID cannot be empty");
        require(fileSize > 0, "MedicalRecordRegistry: file size must be positive");

        _recordIdCounter.increment();
        uint256 recordId = _recordIdCounter.current();

        records[recordId] = MedicalRecord({
            recordId: recordId,
            patientAddress: patientAddress,
            recordType: recordType,
            recordName: recordName,
            fileHash: fileHash,
            storageCID: storageCID,
            fileSize: fileSize,
            mimeType: mimeType,
            uploadedAt: block.timestamp,
            updatedAt: block.timestamp,
            exists: true,
            isActive: true
        });

        patientRecords[patientAddress].push(recordId);
        allRecords.push(recordId);

        emit MedicalRecordRegistered(
            recordId,
            patientAddress,
            recordType,
            recordName,
            fileHash,
            storageCID,
            fileSize,
            msg.sender,
            block.timestamp
        );

        return recordId;
    }

    /**
     * @dev Get medical record by ID
     */
    function getRecord(uint256 recordId) external view recordExists(recordId) returns (MedicalRecord memory) {
        return records[recordId];
    }

    /**
     * @dev Get all record IDs for a patient
     */
    function getPatientRecords(address patientAddress) external view returns (uint256[] memory) {
        return patientRecords[patientAddress];
    }

    /**
     * @dev Get record count for a patient
     */
    function getPatientRecordCount(address patientAddress) external view returns (uint256) {
        return patientRecords[patientAddress].length;
    }

    /**
     * @dev Update record metadata (only registrar or patient)
     */
    function updateRecord(
        uint256 recordId,
        string calldata recordName,
        RecordType recordType,
        string calldata storageCID
    ) external onlyPatientOrRegistrar(recordId) recordExists(recordId) {
        require(records[recordId].isActive, "MedicalRecordRegistry: record is not active");

        if (bytes(recordName).length > 0) {
            records[recordId].recordName = recordName;
        }
        records[recordId].recordType = recordType;
        if (bytes(storageCID).length > 0) {
            records[recordId].storageCID = storageCID;
        }
        records[recordId].updatedAt = block.timestamp;

        emit MedicalRecordUpdated(recordId, records[recordId].patientAddress, msg.sender, block.timestamp);
    }

    /**
     * @dev Deactivate a record (soft delete - only registrar or patient)
     */
    function deactivateRecord(uint256 recordId) external onlyPatientOrRegistrar(recordId) recordExists(recordId) {
        require(records[recordId].isActive, "MedicalRecordRegistry: record already deactivated");

        records[recordId].isActive = false;
        records[recordId].updatedAt = block.timestamp;

        emit MedicalRecordDeactivated(recordId, records[recordId].patientAddress, msg.sender, block.timestamp);
    }

    /**
     * @dev Verify file integrity by comparing hash
     */
    function verifyFileIntegrity(uint256 recordId, bytes32 providedHash) external view recordExists(recordId) returns (bool) {
        return records[recordId].fileHash == providedHash;
    }

    /**
     * @dev Get total records count
     */
    function getTotalRecords() external view returns (uint256) {
        return allRecords.length;
    }

    /**
     * @dev Check if record belongs to patient
     */
    function isPatientRecord(uint256 recordId, address patientAddress) external view recordExists(recordId) returns (bool) {
        return records[recordId].patientAddress == patientAddress;
    }

    /**
     * @dev Get record by index (for pagination)
     */
    function getRecordByIndex(uint256 index) external view returns (uint256) {
        require(index < allRecords.length, "MedicalRecordRegistry: index out of bounds");
        return allRecords[index];
    }
}