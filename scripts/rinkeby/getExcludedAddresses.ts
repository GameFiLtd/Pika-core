require('dotenv').config();
import { ethers } from 'hardhat';
import { Pika__factory, Staking__factory } from '../../typechain';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const pika = Pika__factory.connect(process.env.DEV_CONTRACT as string, deployer);

  let excludedAddresses: { [address: string]: boolean } = {};
  const logs = await pika.queryFilter(pika.filters.ExcludedFromFeeUpdated(null, null));
  for (const log of logs) {
    excludedAddresses[log.args.account] = log.args.excluded;
  }
  console.log(excludedAddresses);
  console.log(await pika.isExcludedFromFee(pika.address));
  console.log(await pika.isExcludedFromFee('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
