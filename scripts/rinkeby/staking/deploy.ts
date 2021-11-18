require('dotenv').config();
import { ethers } from 'hardhat';
import { Pika__factory } from '../../../typechain';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contract with the account:', deployer.address);
  const factory = await ethers.getContractFactory('Staking');
  const contract = await factory.deploy('Staked Test Token', 'stTST', process.env.DEV_CONTRACT as string);
  await contract.deployed();
  console.log('Contract address:', contract.address);

  const pika = Pika__factory.connect(process.env.DEV_CONTRACT as string, deployer);

  let tx = await pika.setBeneficiary(process.env.DEV_BENEFICIARY as string, '500');
  console.log('Setting beneficiary fee to 5%', tx.hash);
  await tx.wait();
  tx = await pika.setLiquidity(ethers.constants.AddressZero, '0');
  console.log('Setting liquidity fee to 0%', tx.hash);
  await tx.wait();
  tx = await pika.setStaking(contract.address, '4000');
  console.log('Setting staking fee to 2%', tx.hash);
  await tx.wait();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
