require('dotenv').config();
import { ethers } from 'hardhat';
import { Pika__factory } from '../../typechain';

const contractName = 'Pika';
const addressToExclude = '';
const exclude = true;

async function main(contractName: string, address: string, exclude: boolean): Promise<void> {
  const [deployer] = await ethers.getSigners();

  const Contract = (await ethers.getContractFactory(contractName)) as Pika__factory;
  const contract = Contract.attach(process.env.CONTRACT as string);
  const tx = await contract.setExcludeFromFee(address, exclude);
  console.log('Tx hash:', tx.hash);
}

main(contractName, addressToExclude, exclude)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
