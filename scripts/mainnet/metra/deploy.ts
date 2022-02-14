require('dotenv').config();
import { ethers, upgrades } from 'hardhat';
import { Metra, Metra__factory } from '../../../typechain';

const contractName = 'Metra';
const constructorParams: any[] = ['0', '0', process.env.BENEFICIARY, 'METRA', 'METRA', '875'];

async function main(contractName: string, constructorParams?: any[]): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contract with the account:', deployer.address);
  const Contract = (await ethers.getContractFactory(contractName)) as Metra__factory;
  const contract = (await upgrades.deployProxy(Contract, constructorParams!)) as Metra;
  await contract.deployed();
  console.log('Contract address:', contract.address);
  let tx = await contract.approve('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', ethers.constants.MaxUint256);
  console.log('Approving', tx.hash);
  await tx.wait();
}

main(contractName, constructorParams)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
