require('dotenv').config();
import { ethers, upgrades } from 'hardhat';
import { Pika, Pika__factory } from '../../../typechain';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log('Upgrading contract with the account:', deployer.address);
  const factory = await ethers.getContractFactory('Pika');
  const pika = (await upgrades.upgradeProxy(process.env.CONTRACT as string, factory)) as Pika;
  console.log('Contract address:', pika.address);

  let tx = await pika.setBeneficiary(process.env.BENEFICIARY as string, '500');
  console.log('Setting beneficiary fee to 5%', tx.hash);
  await tx.wait();
  tx = await pika.setLiquidity(ethers.constants.AddressZero, '0');
  console.log('Setting liquidity fee to 0%', tx.hash);
  await tx.wait();
  tx = await pika.setStaking(process.env.STAKING as string, '4000');
  console.log('Setting staking fee to 2%', tx.hash);
  await tx.wait();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
