import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    console.log("================================================================================");
    console.log("Deploying Patient Healthcare Blockchain Smart Contracts");
    console.log("================================================================================\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, "Chain ID:", network.chainId);
    console.log("");

    // Deploy UserRegistry first
    console.log("1. Deploying UserRegistry...");
    const UserRegistry = await ethers.getContractFactory("UserRegistry");
    const userRegistry = await UserRegistry.deploy();
    await userRegistry.waitForDeployment();
    const userRegistryAddress = await userRegistry.getAddress();
    console.log("   UserRegistry deployed to:", userRegistryAddress);

    // Deploy MedicalRecordRegistry
    console.log("\n2. Deploying MedicalRecordRegistry...");
    const MedicalRecordRegistry = await ethers.getContractFactory("MedicalRecordRegistry");
    const medicalRecordRegistry = await MedicalRecordRegistry.deploy(userRegistryAddress);
    await medicalRecordRegistry.waitForDeployment();
    const medicalRecordRegistryAddress = await medicalRecordRegistry.getAddress();
    console.log("   MedicalRecordRegistry deployed to:", medicalRecordRegistryAddress);

    // Deploy ConsentManager
    console.log("\n3. Deploying ConsentManager...");
    const ConsentManager = await ethers.getContractFactory("ConsentManager");
    const consentManager = await ConsentManager.deploy();
    await consentManager.waitForDeployment();
    const consentManagerAddress = await consentManager.getAddress();
    console.log("   ConsentManager deployed to:", consentManagerAddress);

    // Deploy AuditLog
    console.log("\n4. Deploying AuditLog...");
    const AuditLog = await ethers.getContractFactory("AuditLog");
    const auditLog = await AuditLog.deploy();
    await auditLog.waitForDeployment();
    const auditLogAddress = await auditLog.getAddress();
    console.log("   AuditLog deployed to:", auditLogAddress);

    // Grant SYSTEM_ROLE to backend service account (deployer for now)
    console.log("\n5. Configuring contract permissions...");
    
    // Grant RECORD_REGISTRAR_ROLE to deployer (backend)
    const RECORD_REGISTRAR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RECORD_REGISTRAR_ROLE"));
    await medicalRecordRegistry.grantRole(RECORD_REGISTRAR_ROLE, deployer.address);
    console.log("   Granted RECORD_REGISTRAR_ROLE to deployer");

    // Grant SYSTEM_ROLE to deployer (backend) in AuditLog
    const SYSTEM_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SYSTEM_ROLE"));
    await auditLog.grantRole(SYSTEM_ROLE, deployer.address);
    console.log("   Granted SYSTEM_ROLE to deployer");

    // Grant AUDITOR_ROLE to deployer
    const AUDITOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUDITOR_ROLE"));
    await auditLog.grantRole(AUDITOR_ROLE, deployer.address);
    console.log("   Granted AUDITOR_ROLE to deployer");

    // Save contract addresses
    const contractsConfig = {
        chainId: Number(network.chainId),
        networkName: network.name,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            UserRegistry: userRegistryAddress,
            MedicalRecordRegistry: medicalRecordRegistryAddress,
            ConsentManager: consentManagerAddress,
            AuditLog: auditLogAddress
        }
    };

    const configPath = path.join(__dirname, "../contracts.json");
    fs.writeFileSync(configPath, JSON.stringify(contractsConfig, null, 2));
    console.log("\n================================================================================");
    console.log("Contract addresses saved to:", configPath);
    console.log("================================================================================\n");

    console.log("Deployment Summary:");
    console.log("  UserRegistry:           ", userRegistryAddress);
    console.log("  MedicalRecordRegistry:  ", medicalRecordRegistryAddress);
    console.log("  ConsentManager:         ", consentManagerAddress);
    console.log("  AuditLog:               ", auditLogAddress);
    console.log("");

    // Verify contracts on Etherscan if not local
    if (Number(network.chainId) !== 1337 && Number(network.chainId) !== 1338 && Number(network.chainId) !== 1339 && Number(network.chainId) !== 31337) {
        console.log("Waiting for block confirmations...");
        const uRegTx = userRegistry.deploymentTransaction();
        const mRegTx = medicalRecordRegistry.deploymentTransaction();
        const cManTx = consentManager.deploymentTransaction();
        const aLogTx = auditLog.deploymentTransaction();
        if (uRegTx) await uRegTx.wait(5);
        if (mRegTx) await mRegTx.wait(5);
        if (cManTx) await cManTx.wait(5);
        if (aLogTx) await aLogTx.wait(5);

        const uRegAddr = await userRegistry.getAddress();
        const mRegAddr = await medicalRecordRegistry.getAddress();
        const cManAddr = await consentManager.getAddress();
        const aLogAddr = await auditLog.getAddress();

        console.log("Verifying contracts on Etherscan...");
        try {
            await hre.run("verify:verify", { address: uRegAddr, constructorArguments: [] });
            await hre.run("verify:verify", { address: mRegAddr, constructorArguments: [uRegAddr] });
            await hre.run("verify:verify", { address: cManAddr, constructorArguments: [] });
            await hre.run("verify:verify", { address: aLogAddr, constructorArguments: [] });
            console.log("Contracts verified successfully");
        } catch (error) {
            console.log("Verification failed:", error);
        }
    }

    console.log("\n================================================================================");
    console.log("Deployment completed successfully!");
    console.log("================================================================================\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });