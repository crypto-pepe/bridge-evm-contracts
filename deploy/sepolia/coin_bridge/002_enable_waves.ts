import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// const main: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
const main: DeployFunction = async function (hre: any) {
  const { deployer } = await hre.getNamedAccounts();
  const { get, execute, read } = hre.deployments;

  const wavesChainId = 10001;

  if ((await read("CoinBridge", "chains", wavesChainId)) != true) {
    const nativeTokenBridge = await get("CoinBridge_Proxy");
    let iface = new hre.ethers.utils.Interface([
      "function updateExecutionChain(uint128 executionChainId_, bool enabled)",
    ]);
    const calldata = iface.encodeFunctionData("updateExecutionChain", [
      wavesChainId,
      true,
    ]);
    await execute(
      "Multisig",
      {
        from: deployer,
        log: true,
      },
      "submitTransaction",
      nativeTokenBridge.address,
      0,
      calldata
    );
  }
};

main.id = "ethereum_sepolia_coin_bridge_enable_waves";
main.tags = ["ethereum", "sepolia", "CoinBridge"];
main.dependencies = [
  "ethereum_sepolia_multisig_deploy",
  "ethereum_sepolia_coin_bridge_deploy",
];

export default main;
