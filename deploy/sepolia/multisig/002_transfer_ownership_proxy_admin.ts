import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// const main: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
const main: any = async function(hre: any) {
  const { deployer } = await hre.getNamedAccounts();
  const { execute, get, read } = hre.deployments;

  const multisig = await get("Multisig_Proxy");

  if ((await read("Multisig_Proxy", "owner")) != multisig.address) {
    await execute(
      "Multisig_Proxy",
      {
        from: deployer,
        log: true,
      },
      "transferOwnership",
      multisig.address
    );
  }
};

main.id = "multisig_transfer_ownership_proxy_admin";
main.tags = ["Multisig", "sepolia", "ethereum"];
module.exports.dependencies = ["Multisig"];

export default main;
