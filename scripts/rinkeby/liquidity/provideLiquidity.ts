require('dotenv').config();
import { ethers } from 'hardhat';
import { Liquidity__factory } from '../../../typechain';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();

  const liquidity = Liquidity__factory.connect(process.env.DEV_LIQUIDITY as string, deployer);

  let tx = await liquidity.provideLiquidity(true, { value: ethers.utils.parseEther('1') });
  console.log('Providing liquidity and locking', tx.hash);
  await tx.wait();

  tx = await liquidity.provideLiquidity(false, { value: ethers.utils.parseEther('1'), gasLimit: '300000' });
  console.log('Providing liquidity and vesting', tx.hash);
  await tx.wait();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
