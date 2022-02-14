require('dotenv').config();
import { ethers, network } from 'hardhat';
import { Pika__factory } from '../typechain';

let contractAddress: string;

if (network.name === 'mainnet') {
  contractAddress = process.env.CONTRACT as string;
} else if (network.name === 'polygon') {
  contractAddress = process.env.CONTRACT_POLYGON as string;
} else if (network.name === 'goerli') {
  contractAddress = process.env.GOERLI_CONTRACT as string;
} else if (network.name === 'rinkeby') {
  contractAddress = process.env.DEV_CONTRACT as string;
} else {
  throw new Error('Unsupported network');
}

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const pika = Pika__factory.connect(contractAddress, deployer);

  const tx = await pika.setSwapEnabled(true);
  console.log(tx.hash);
  await tx.wait();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
