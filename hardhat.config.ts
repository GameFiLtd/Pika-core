import '@nomiclabs/hardhat-waffle';
import 'solidity-coverage';
import 'hardhat-gas-reporter';
import '@typechain/hardhat';
import '@openzeppelin/hardhat-upgrades';
import '@nomiclabs/hardhat-etherscan';
import { HardhatUserConfig, task } from 'hardhat/config';
require('dotenv').config();

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    mainnet: {
      url: 'https://mainnet.infura.io/v3/' + process.env.INFURA_TOKEN,
      accounts: [process.env.PRIVATE_KEY as string],
    },
    rinkeby: {
      url: 'https://rinkeby.infura.io/v3/' + process.env.INFURA_TOKEN,
      accounts: [process.env.DEV_PRIVATE_KEY as string],
    },
    goerli: {
      url: 'https://goerli.infura.io/v3/' + process.env.INFURA_TOKEN,
      accounts: [process.env.DEV_PRIVATE_KEY as string],
    },
    mumbai: {
      url: 'https://polygon-mumbai.infura.io/v3/' + process.env.INFURA_TOKEN,
      accounts: [process.env.DEV_PRIVATE_KEY as string],
      gasPrice: 8000000000,
    },
    polygon: {
      url: 'https://polygon-mainnet.infura.io/v3/' + process.env.INFURA_TOKEN,
      accounts: [process.env.PRIVATE_KEY as string],
      gasPrice: 20000000000,
    },
    hardhat: {
      forking: {
        url: 'https://mainnet.infura.io/v3/' + process.env.INFURA_TOKEN,
      },
      hardfork: 'berlin',
      gasPrice: 0,
      chainId: 1,
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.10',
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000,
          },
        },
      },
    ],
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 50,
    enabled: process.env.REPORT_GAS === 'true',
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_TOKEN,
  },
};

task('accounts', 'Prints the list of accounts', async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.address);
  }
});

export default config;
