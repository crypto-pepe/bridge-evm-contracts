import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";
import "hardhat-deploy";

// const config: HardhatUserConfig = {
const config: any = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 999999,
      },
    },
  },
  mocha: {
    diff: true,
    fullTrace: true,
    slow: 50000,
    timeout: 60000,
    reporter:
      process.env.JUNIT === "true"
        ? "mocha-junit-reporter"
        : "mocha-multi-reporters",
    reporterOptions: {
      reporterEnabled: "allure-mocha, list",
      allureMochaReporterOptions: {
        resultsDir: "./allure-results",
      },
      mochaFile: "testresult.xml",
      toConsole: true,
    },
  },
  gasReporter: {
    enabled: process.env.JUNIT !== "true",
    src: "./src",
    fast: true,
  },
  namedAccounts: {
    deployer: {
      default: 0,
      11155111: "ledger://m/44'/60'/20'/0/0:0x9bA15E762398456ce03eAA382253b56Ed5dA882a",
    },
  },
  networks: {
    hardhat: {
      accounts: {
        accountsBalance: "1000000000000000000000",
      },
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      saveDeployments: true,
      chainId: 11155111,
    },
  },
};

export default config;
