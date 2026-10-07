import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:7548",
      chainId: 1339,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 20
      }
    },
    ganache: {
      url: process.env.VITE_RPC_URL || "http://localhost:7548",
      chainId: 1339,
      accounts: {
        mnemonic: process.env.GANACHE_MNEMONIC || "test test test test test test test test test test test junk",
        count: 20
      }
    }
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    gasPrice: 20
  },
  etherscan: {
    apiKey: ""
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  typechain: {
    outDir: "./typechain-types",
    target: "ethers-v6"
  }
};

export default config;