import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// const main: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
const main: DeployFunction = async function (hre: any) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get } = hre.deployments;

  const multisig = await get("Multisig_Proxy");
  const rootAdapter = await get("MintRootAdapter_Proxy");
  const wavesChainId = 10001;
  const executor = "0xc56Fc90caa48c41E5b620771B853a4Ff1D0365cD";
  const feeRecipient = "3N1VhCMKNh2SBgw9mhdLRBjyucnv6fkMNBA";
  const callerContract =
    "0x0000000000000154e48ffce27b40e1ae548707e2f4689d1b19568fc118533b55";

  await deploy("CoinBridge", {
    from: deployer,
    log: true,
    proxy: {
      owner: multisig.address,
      execute: {
        init: {
          methodName: "init",
          args: [
            multisig.address,
            rootAdapter.address,
            wavesChainId,
            feeRecipient,
            executor,
            callerContract,
          ],
        },
      },
    },
  });
};

main.id = "ethereum_sepolia_coin_bridge_deploy";
main.tags = ["ethereum", "sepolia", "CoinBridge"];
main.dependencies = [
  "ethereum_sepolia_mint_root_adapter_deploy",
  "ethereum_sepolia_multisig_deploy",
];

export default main;
