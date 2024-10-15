import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployStore: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const L2NativeSuperchainERC20Address = "0x420beeF000000000000000000000000000000001";

  await deploy("Store", {
    from: deployer,
    args: [L2NativeSuperchainERC20Address],
    log: true,
    autoMine: true,
  });
};

export default deployStore;
deployStore.tags = ["Store"];
