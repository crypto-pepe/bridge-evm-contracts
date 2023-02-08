import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const main: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { execute, get } = hre.deployments;

  const multisig = await get("Multisig_Proxy");

  await execute(
    "DefaultProxyAdmin",
    {
      from: deployer,
      log: true,
    },
    "transferOwnership",
    multisig.address
  );
};

main.id = "multisig_transfer_ownership_proxy_admin";
main.tags = ["Multisig", "sepolia", "ethereum"];

export default main;
