require('dotenv').config();
import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { IERC20, IERC20__factory, IUniswapV2Router__factory, Pika, Pika__factory } from '../typechain/';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ContractTransaction } from '@ethersproject/contracts';

describe('Pika', () => {
  let pika: Pika;
  let accounts: SignerWithAddress[];
  let uniswapRouter: string;
  const unix2100 = '4102441200';
  let owner: string;

  before(async () => {
    accounts = await ethers.getSigners();
    owner = accounts[0].address;
    const PikaFactory = (await ethers.getContractFactory('Pika')) as Pika__factory;
    pika = (await upgrades.deployProxy(PikaFactory, [
      ethers.utils.parseEther('10000000000000'),
      ethers.utils.parseEther('50000000000000'),
      accounts[1].address,
      'PIKA',
      'PIKA',
      '275',
    ])) as Pika;
    uniswapRouter = await pika.router();
  });

  describe('Setup tests', async () => {
    it('should set up token correctly', async () => {
      expect(await pika.minSupply()).to.equal(ethers.utils.parseEther('10000000000000'));
      expect(await pika.totalSupply()).to.equal(ethers.utils.parseEther('50000000000000'));
      const beneficiaryAndFee = await pika.unpackBeneficiary(await pika.beneficiary());
      expect(beneficiaryAndFee[0]).to.equal(accounts[1].address);
      expect(beneficiaryAndFee[1]).to.equal('275');
      expect(await pika.staking()).to.equal('0');
      expect(await pika.liquidity()).to.equal('0');
      expect(await pika.balanceOf(owner)).to.equal(ethers.utils.parseEther('50000000000000'));
      expect(await pika.feesEnabled()).to.be.false;
      expect(await pika.swapEnabled()).to.be.false;
      expect(await pika.isExcludedFromFee(owner)).to.be.true;
      expect(await pika.isExcludedFromFee(pika.address)).to.be.true;
      expect(await pika.isExcludedFromFee(beneficiaryAndFee[0])).to.be.true;
    });

    it('should be able to add liquidity', async () => {
      await pika.approve(uniswapRouter, ethers.constants.MaxUint256);
      const uniswap = IUniswapV2Router__factory.connect(uniswapRouter, accounts[0]);
      await uniswap.addLiquidityETH(
        pika.address,
        ethers.utils.parseEther('10000000'),
        ethers.utils.parseEther('10000000'),
        ethers.utils.parseEther('20'),
        owner,
        unix2100,
        { value: ethers.utils.parseEther('20') }
      );
    });
  });

  describe('Function tests', async () => {
    describe('Token burn', async () => {
      it('should not be able to burn more than min supply', async () => {
        await expect(pika.burn(ethers.utils.parseEther('40000000000001'))).to.be.revertedWith(
          'total supply exceeds min supply'
        );
      });

      it('should pass if more than min supply is left after burn', async () => {
        await expect(pika.burn(ethers.utils.parseEther('40000000000000')))
          .to.emit(pika, 'Transfer')
          .withArgs(owner, ethers.constants.AddressZero, ethers.utils.parseEther('40000000000000'));
      });
    });

    describe('Set minimum supply', async () => {
      it('should be able to update min supply', async () => {
        await expect(pika.setMinSupply('1'))
          .to.emit(pika, 'MinSupplyUpdated')
          .withArgs(ethers.utils.parseEther('10000000000000'), '1');
        expect(await pika.minSupply()).to.equal('1');
      });

      it('only owner should be able to update min supply', async () => {
        await expect(pika.connect(accounts[1]).setMinSupply('1')).to.be.reverted;
      });
    });

    describe('Set beneficiary', async () => {
      it('should update beneficiary and set fee and exclude new beneficiary from fee', async () => {
        expect(await pika.isExcludedFromFee(accounts[2].address)).to.be.false;
        const newBeneficiaryAndFee = await pika.packBeneficiary(accounts[2].address, '125');
        await expect(pika.setBeneficiary(accounts[2].address, '125'))
          .to.emit(pika, 'BeneficiaryRewardUpdated')
          .withArgs(accounts[1].address, accounts[2].address, '275', '125');
        const newBeneficiary = await pika.beneficiary();
        expect(newBeneficiary).to.equal(newBeneficiaryAndFee);
        expect(await pika.unpackBeneficiary(newBeneficiary)).to.deep.equal([
          accounts[2].address,
          ethers.BigNumber.from('125'),
        ]);
        expect(await pika.isExcludedFromFee(accounts[2].address)).to.be.true;
      });

      it('only owner should be able to set beneficiary', async () => {
        await expect(pika.connect(accounts[1]).setBeneficiary(accounts[3].address, '100')).to.be.reverted;
      });
    });

    describe('Set staking', async () => {
      it('should update staking contract and set fee and exclude new staking contract from fee', async () => {
        expect(await pika.isExcludedFromFee(accounts[3].address)).to.be.false;
        const newBeneficiaryAndFee = await pika.packBeneficiary(accounts[3].address, '100');
        await expect(pika.setStaking(accounts[3].address, '100'))
          .to.emit(pika, 'StakingRewardUpdated')
          .withArgs(ethers.constants.AddressZero, accounts[3].address, '0', '100');
        const newBeneficiary = await pika.staking();
        expect(newBeneficiary).to.equal(newBeneficiaryAndFee);
        expect(await pika.unpackBeneficiary(newBeneficiary)).to.deep.equal([
          accounts[3].address,
          ethers.BigNumber.from('100'),
        ]);
        expect(await pika.isExcludedFromFee(accounts[3].address)).to.be.true;
      });

      it('only owner should be able to set staking contract', async () => {
        await expect(pika.connect(accounts[1]).setStaking(accounts[3].address, '100')).to.be.reverted;
      });
    });

    describe('Set liquidity', async () => {
      it('should update liquidity contract and set fee and exclude new liquidity contract from fee', async () => {
        expect(await pika.isExcludedFromFee(accounts[4].address)).to.be.false;
        const newBeneficiaryAndFee = await pika.packBeneficiary(accounts[4].address, '50');
        await expect(pika.setLiquidity(accounts[4].address, '50'))
          .to.emit(pika, 'LiquidityRewardUpdated')
          .withArgs(ethers.constants.AddressZero, accounts[4].address, '0', '50');
        const newBeneficiary = await pika.liquidity();
        expect(newBeneficiary).to.equal(newBeneficiaryAndFee);
        expect(await pika.unpackBeneficiary(newBeneficiary)).to.deep.equal([
          accounts[4].address,
          ethers.BigNumber.from('50'),
        ]);
        expect(await pika.isExcludedFromFee(accounts[4].address)).to.be.true;
      });

      it('only owner should be able to set liquidity contract', async () => {
        await expect(pika.connect(accounts[1]).setLiquidity(accounts[3].address, '100')).to.be.reverted;
      });
    });

    describe('Set fees enabled', async () => {
      it('should be able to enable fees', async () => {
        await expect(pika.setFeesEnabled(true)).to.emit(pika, 'FeesEnabledUpdated').withArgs(true);
        expect(await pika.feesEnabled()).to.be.true;
      });
      it('only owner can enable fees', async () => {
        await expect(pika.connect(accounts[1]).setFeesEnabled(false)).to.be.reverted;
      });
    });

    describe('Set swap enabled', async () => {
      it('should be able to enable swap', async () => {
        await expect(pika.setSwapEnabled(true)).to.emit(pika, 'SwapEnabledUpdated').withArgs(true);
        expect(await pika.swapEnabled()).to.be.true;
      });
      it('only owner can enable fees', async () => {
        await expect(pika.connect(accounts[1]).setSwapEnabled(false)).to.be.reverted;
      });
    });

    describe('Set excluded from fees', async () => {
      it('be able to exclude accounts from fees', async () => {
        expect(await pika.isExcludedFromFee(accounts[5].address)).to.be.false;
        await expect(pika.setExcludeFromFee(accounts[5].address, true))
          .to.emit(pika, 'ExcludedFromFeeUpdated')
          .withArgs(accounts[5].address, true);
        expect(await pika.isExcludedFromFee(accounts[5].address)).to.be.true;
      });
      it('only owner should be able to exclude accounts from fees', async () => {
        await expect(pika.connect(accounts[1]).setExcludeFromFee(accounts[5].address, true)).to.be.reverted;
      });
    });
  });

  describe('Uniswap tests & transfer tests', async () => {
    let weth: IERC20;

    before(async () => {
      weth = IERC20__factory.connect(await pika.WETH(), accounts[0]);
      await pika.setExcludeFromFee(owner, false);
    });

    describe('should take a fee on transfer and swap', async () => {
      let tx: Promise<ContractTransaction>;

      before(() => {
        tx = pika.transfer(accounts[6].address, ethers.utils.parseEther('1000000'));
      });

      it('should collect fees in contract', async () => {
        await expect(tx).to.emit(pika, 'Transfer').withArgs(owner, pika.address, ethers.utils.parseEther('12500'));
      });
      it('should burn tokens', async () => {
        await expect(tx)
          .to.emit(pika, 'Transfer')
          .withArgs(owner, ethers.constants.AddressZero, ethers.utils.parseEther('2500'));
      });
      it('should send tokens to staking contract', async () => {
        await expect(tx)
          .to.emit(pika, 'Transfer')
          .withArgs(owner, accounts[3].address, ethers.utils.parseEther('10000'));
      });
      it('should send tokens to liquidity contract', async () => {
        await expect(tx)
          .to.emit(pika, 'Transfer')
          .withArgs(owner, accounts[4].address, ethers.utils.parseEther('5000'));
      });
      it('should swap token', async () => {
        await expect(tx).to.emit(weth, 'Transfer');
      });
      it('should transfer the rest of the tokens', async () => {
        await expect(tx)
          .to.emit(pika, 'Transfer')
          .withArgs(owner, accounts[6].address, ethers.utils.parseEther('970000'));
      });
    });

    describe('should take a fee on transfer and swap', async () => {
      let tx: Promise<ContractTransaction>;

      before(async () => {
        await pika.setSwapEnabled(false);
        tx = pika.transfer(accounts[6].address, ethers.utils.parseEther('1000000'));
      });

      it('should send fees to beneficiary', async () => {
        await expect(tx)
          .to.emit(pika, 'Transfer')
          .withArgs(owner, accounts[2].address, ethers.utils.parseEther('12500'));
      });
      it('should burn tokens', async () => {
        await expect(tx)
          .to.emit(pika, 'Transfer')
          .withArgs(owner, ethers.constants.AddressZero, ethers.utils.parseEther('2500'));
      });
      it('should send tokens to staking contract', async () => {
        await expect(tx)
          .to.emit(pika, 'Transfer')
          .withArgs(owner, accounts[3].address, ethers.utils.parseEther('10000'));
      });
      it('should send tokens to liquidity contract', async () => {
        await expect(tx)
          .to.emit(pika, 'Transfer')
          .withArgs(owner, accounts[4].address, ethers.utils.parseEther('5000'));
      });
      it('should not swap token', async () => {
        await expect(tx).to.not.emit(weth, 'Transfer');
      });
    });

    describe('should only burn when fees are disabled', async () => {
      let tx: Promise<ContractTransaction>;

      before(async () => {
        await pika.setBeneficiary(ethers.constants.AddressZero, '0');
        await pika.setStaking(ethers.constants.AddressZero, '0');
        await pika.setLiquidity(ethers.constants.AddressZero, '0');
        tx = pika.transfer(accounts[6].address, ethers.utils.parseEther('1000000'));
      });

      it('should burn tokens', async () => {
        await expect(tx)
          .to.emit(pika, 'Transfer')
          .withArgs(owner, ethers.constants.AddressZero, ethers.utils.parseEther('2500'));
      });
      it('should transfer the rest of the tokens', async () => {
        await expect(tx)
          .to.emit(pika, 'Transfer')
          .withArgs(owner, accounts[6].address, ethers.utils.parseEther('997500'));
      });
    });

    describe('should not burn if minimum supply is reached', async () => {
      let tx: Promise<ContractTransaction>;

      before(async () => {
        await pika.setMinSupply(ethers.utils.parseEther('50000000000000'));
        tx = pika.transfer(accounts[6].address, ethers.utils.parseEther('1000000'));
      });

      it('should transfer all of the tokens', async () => {
        await expect(tx)
          .to.emit(pika, 'Transfer')
          .withArgs(owner, accounts[6].address, ethers.utils.parseEther('1000000'));
      });
    });
  });

  describe('modifiers', async () => {
    describe('ensureAddressSet', async () => {
      it('should set address when fee is set', async () => {
        await expect(pika.setBeneficiary(accounts[0].address, '0')).to.be.revertedWith('set address to zero');
      });
      it('should set address to zero when fee is zero', async () => {
        await expect(pika.setBeneficiary(ethers.constants.AddressZero, '1')).to.be.revertedWith('address not set');
      });
    });
  });
});
