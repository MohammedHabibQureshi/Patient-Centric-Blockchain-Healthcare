import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    console.log("================================================================================");
    console.log("Initializing Patient Healthcare Blockchain System");
    console.log("================================================================================\n");

    const [deployer] = await ethers.getSigners();
    console.log("Initializing with account:", deployer.address);

    // Load contract addresses
    const configPath = path.join(__dirname, "../contracts.json");
    if (!fs.existsSync(configPath)) {
        console.error("contracts.json not found. Run deployment first.");
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    console.log("Loaded contract addresses from:", configPath);

    // Get contract instances
    const userRegistry = await ethers.getContractAt("UserRegistry", config.contracts.UserRegistry);
    const medicalRecordRegistry = await ethers.getContractAt("MedicalRecordRegistry", config.contracts.MedicalRecordRegistry);
    const consentManager = await ethers.getContractAt("ConsentManager", config.contracts.ConsentManager);
    const auditLog = await ethers.getContractAt("AuditLog", config.contracts.AuditLog);

    console.log("\nContracts loaded:");
    console.log("  UserRegistry:           ", await userRegistry.getAddress());
    console.log("  MedicalRecordRegistry:  ", await medicalRecordRegistry.getAddress());
    console.log("  ConsentManager:         ", await consentManager.getAddress());
    console.log("  AuditLog:               ", await auditLog.getAddress());

    // Get all 20 deterministic accounts
    const accounts = await ethers.getSigners();
    console.log("\n================================================================================");
    console.log("Available Accounts (20 deterministic):");
    console.log("================================================================================\n");
    
    for (let i = 0; i < accounts.length; i++) {
        const balance = await ethers.provider.getBalance(accounts[i].address);
        console.log(`  Account ${i}: ${accounts[i].address} (Balance: ${ethers.formatEther(balance)} ETH)`);
    }

    // Verify admin is account 0
    const adminAddress = accounts[0].address;
    const adminUser = await userRegistry.getUser(adminAddress);
    console.log("\n================================================================================");
    console.log("Admin Verification:");
    console.log("================================================================================\n");
    console.log("Admin Address:", adminAddress);
    console.log("Admin User ID:", adminUser.userId.toString());
    console.log("Admin Role:", adminUser.role.toString());
    console.log("Admin Status:", adminUser.status.toString());
    console.log("Is Admin:", await userRegistry.hasUserRole(adminAddress, 1)); // ADMIN = 1

    // Register test patients (accounts 1-10)
    console.log("\n================================================================================");
    console.log("Registering Test Patients (Accounts 1-10):");
    console.log("================================================================================\n");

    const testPatients = [
        { name: "Alice Johnson", email: "alice.johnson@patient.local", patientId: "PAT-001" },
        { name: "Bob Smith", email: "bob.smith@patient.local", patientId: "PAT-002" },
        { name: "Carol Williams", email: "carol.williams@patient.local", patientId: "PAT-003" },
        { name: "David Brown", email: "david.brown@patient.local", patientId: "PAT-004" },
        { name: "Eva Davis", email: "eva.davis@patient.local", patientId: "PAT-005" },
        { name: "Frank Miller", email: "frank.miller@patient.local", patientId: "PAT-006" },
        { name: "Grace Wilson", email: "grace.wilson@patient.local", patientId: "PAT-007" },
        { name: "Henry Moore", email: "henry.moore@patient.local", patientId: "PAT-008" },
        { name: "Iris Taylor", email: "iris.taylor@patient.local", patientId: "PAT-009" },
        { name: "Jack Anderson", email: "jack.anderson@patient.local", patientId: "PAT-010" }
    ];

    for (let i = 0; i < testPatients.length; i++) {
        const patient = testPatients[i];
        const walletAddress = accounts[i + 1].address;
        
        try {
            const tx = await userRegistry.registerPatient(
                walletAddress,
                patient.name,
                patient.email,
                patient.patientId
            );
            const receipt = await tx.wait();
            console.log(`  ✓ Patient ${i + 1}: ${patient.name} (${walletAddress}) - Tx: ${receipt.hash}`);
        } catch (error: any) {
            if (error.message.includes("already registered")) {
                console.log(`  ⚠ Patient ${i + 1}: ${patient.name} already registered`);
            } else {
                console.error(`  ✗ Patient ${i + 1}: ${error.message}`);
            }
        }
    }

    // Register test doctors (accounts 11-19)
    console.log("\n================================================================================");
    console.log("Registering Test Doctors (Accounts 11-19):");
    console.log("================================================================================\n");

    const testDoctors = [
        { name: "Dr. Sarah Thompson", email: "sarah.thompson@doctor.local", licenseNumber: "MD-001" },
        { name: "Dr. Michael Chen", email: "michael.chen@doctor.local", licenseNumber: "MD-002" },
        { name: "Dr. Jennifer Lee", email: "jennifer.lee@doctor.local", licenseNumber: "MD-003" },
        { name: "Dr. Robert Garcia", email: "robert.garcia@doctor.local", licenseNumber: "MD-004" },
        { name: "Dr. Lisa Martinez", email: "lisa.martinez@doctor.local", licenseNumber: "MD-005" },
        { name: "Dr. William Rodriguez", email: "william.rodriguez@doctor.local", licenseNumber: "MD-006" },
        { name: "Dr. Amanda Clark", email: "amanda.clark@doctor.local", licenseNumber: "MD-007" },
        { name: "Dr. Christopher Lewis", email: "christopher.lewis@doctor.local", licenseNumber: "MD-008" },
        { name: "Dr. Michelle Walker", email: "michelle.walker@doctor.local", licenseNumber: "MD-009" }
    ];

    for (let i = 0; i < testDoctors.length; i++) {
        const doctor = testDoctors[i];
        const walletAddress = accounts[i + 11].address;
        
        try {
            const tx = await userRegistry.registerDoctor(
                walletAddress,
                doctor.name,
                doctor.email,
                doctor.licenseNumber
            );
            const receipt = await tx.wait();
            console.log(`  ✓ Doctor ${i + 1}: ${doctor.name} (${walletAddress}) - Tx: ${receipt.hash}`);
        } catch (error: any) {
            if (error.message.includes("already registered")) {
                console.log(`  ⚠ Doctor ${i + 1}: ${doctor.name} already registered`);
            } else {
                console.error(`  ✗ Doctor ${i + 1}: ${error.message}`);
            }
        }
    }

    // Verify registrations
    console.log("\n================================================================================");
    console.log("Verification:");
    console.log("================================================================================\n");

    const patients = await userRegistry.getPatients();
    console.log(`Total Patients Registered: ${patients.length}`);

    const doctors = await userRegistry.getDoctors();
    console.log(`Total Doctors Registered: ${doctors.length}`);

    const totalUsers = await userRegistry.getTotalUsers();
    console.log(`Total Users: ${totalUsers}`);

    // Save initialization info
    const initInfo = {
        initializedAt: new Date().toISOString(),
        adminAddress: adminAddress,
        patients: testPatients.map((p, i) => ({
            ...p,
            walletAddress: accounts[i + 1].address
        })),
        doctors: testDoctors.map((d, i) => ({
            ...d,
            walletAddress: accounts[i + 11].address
        }))
    };

    const initPath = path.join(__dirname, "../initialization.json");
    fs.writeFileSync(initPath, JSON.stringify(initInfo, null, 2));
    console.log("\nInitialization info saved to:", initPath);

    console.log("\n================================================================================");
    console.log("Initialization completed successfully!");
    console.log("================================================================================\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Initialization failed:", error);
        process.exit(1);
    });