import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// const main: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
const main: any = async function(hre: any) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const admins = [
    "0x20D1e919B0d5D7A3a24159559202359C1E130495",
    "0x6DF7F61fE3f8A034BCadF58A9Cb998f828fAdf7F",
    "0x89ACCe2C87f7Dfde7aF5518a4819E4e13Eb062C8",
    "0x66a42E8Db672bbC1573be0B3Ea8f6FD48d4d7A4e",
    "0x9bA15E762398456ce03eAA382253b56Ed5dA882a",
  ];
  const quorum = 2;
  const txTTL = 4 * 60 * 24 * 7; // 1 week (4 blocks/minute * 60 minute * 24 hours * 7 days)

  await deploy("Multisig", {
    from: deployer,
    log: true,
    proxy: {
      execute: {
        init: {
          methodName: "init",
          args: [admins, quorum, txTTL],
        },
      },
    },
  });
};

main.id = "multisig_deploy_sepolia";
main.tags = ["Multisig", "sepolia", "ethereum"];

export default main;
