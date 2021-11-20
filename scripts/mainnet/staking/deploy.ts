require('dotenv').config();
import { ethers } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contract with the account:', deployer.address);
  const factory = await ethers.getContractFactory('Staking');
  const contract = await factory.deploy('Staked PIKA', 'stPIKA', process.env.CONTRACT as string);
  await contract.deployed();
  console.log('Contract address:', contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
