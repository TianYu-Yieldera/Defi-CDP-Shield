import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    console.log("=".repeat(60));
    console.log("DEXAggregator - Deployment Script (0x Protocol Integration)");
    console.log("=".repeat(60));

    const signers = await ethers.getSigners();
    if (signers.length === 0) {
        console.error("\nError: No signers available. Please check your PRIVATE_KEY in .env");
        process.exit(1);
    }
    const deployer = signers[0];
    console.log("\nDeployer:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");

    if (balance < ethers.parseEther("0.001")) {
        console.error("\nError: Insufficient balance. Need at least 0.001 ETH for deployment.");
        process.exit(1);
    }

    const networkName = network.name;
    const chainId = (await ethers.provider.getNetwork()).chainId;
    console.log("Network:", networkName);
    console.log("Chain ID:", chainId);
    console.log("-".repeat(60));

    try {
        // Deploy DEXAggregator
        console.log("\n[1/1] Deploying DEXAggregator...");
        const DEXAggregatorFactory = await ethers.getContractFactory("DEXAggregator");
        const dexAggregator = await DEXAggregatorFactory.deploy();
        await dexAggregator.waitForDeployment();
        const dexAggregatorAddress = await dexAggregator.getAddress();
        console.log("  DEXAggregator:", dexAggregatorAddress);

        // Verify 0x Exchange Proxy
        const exchangeProxy = await dexAggregator.getExchangeProxy();
        console.log("  0x Exchange Proxy:", exchangeProxy);

        const isOperational = await dexAggregator.isOperational();
        console.log("  Operational:", isOperational);

        // Update deployment file
        const deploymentsDir = path.join(__dirname, "..", "deployments");
        const filePath = path.join(deploymentsDir, `${networkName}.json`);

        let deploymentData: Record<string, unknown> = {};
        if (fs.existsSync(filePath)) {
            deploymentData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        }

        // Add DEXAggregator to contracts
        if (!deploymentData.contracts) {
            deploymentData.contracts = {};
        }
        (deploymentData.contracts as Record<string, string>).DEXAggregator = dexAggregatorAddress;
        deploymentData.dexAggregatorDeployedAt = new Date().toISOString();

        fs.writeFileSync(filePath, JSON.stringify(deploymentData, null, 2));

        console.log("\n" + "=".repeat(60));
        console.log("Deployment Complete!");
        console.log("=".repeat(60));
        console.log("\nDEXAggregator:", dexAggregatorAddress);
        console.log("Deployment saved to:", filePath);

        // Print verification command
        console.log("\n--- Verification Command ---");
        console.log(`npx hardhat verify --network ${networkName} ${dexAggregatorAddress}`);

    } catch (error) {
        console.error("\nDeployment failed:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
