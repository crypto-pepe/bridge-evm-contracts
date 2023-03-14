import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// const main: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
const main: DeployFunction = async function (hre: any) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get } = hre.deployments;

  const multisig = await get("Multisig_Proxy");

  await deploy("MintRootAdapter", {
    from: deployer,
    log: true,
    proxy: {
      owner: multisig.address,
      execute: {
        init: {
          methodName: "init",
          args: [multisig.address],
        },
      },
    },
  });
};

main.id = "ethereum_sepolia_mint_root_adapter_deploy";
main.tags = ["ethereum", "sepolia", "MintRootAdapter"];
main.dependencies = ["ethereum_sepolia_multisig_deploy"];

export default main;
