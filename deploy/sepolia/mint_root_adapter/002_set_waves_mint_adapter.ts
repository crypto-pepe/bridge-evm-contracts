import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// const main: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
const main: DeployFunction = async function (hre: any) {
  const { deployer } = await hre.getNamedAccounts();
  const { get, execute, read } = hre.deployments;

  const tokenWavesAdapter = await get("WavesMintAdapter_Proxy");
  const wavesChainId = 10001;

  if (
    (await read("MintRootAdapter", "adapters", wavesChainId)) !=
    tokenWavesAdapter.address
  ) {
    const rootAdapter = await get("MintRootAdapter_Proxy");
    let iface = new hre.ethers.utils.Interface([
      "function setAdapter(uint16 executionChainId_, address adapter_)",
    ]);
    const calldata = iface.encodeFunctionData("setAdapter", [
      wavesChainId,
      tokenWavesAdapter.address,
    ]);
    await execute(
      "Multisig",
      {
        from: deployer,
        log: true,
      },
      "submitTransaction",
      rootAdapter.address,
      0,
      calldata
    );
  }
};

main.id = "ethereum_sepolia_set_waves_mint_adapter";
main.tags = ["ethereum", "sepolia", "MintRootAdapter"];
main.dependencies = [
  "ethereum_sepolia_mint_root_adapter_deploy",
  "ethereum_sepolia_waves_mint_adapter_deploy",
  "ethereum_sepolia_multisig_deploy",
];

export default main;
