require('dotenv').config();
import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { Pika, Pika__factory } from '../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Owned', () => {
  let owned: Pika;
  let accounts: SignerWithAddress[];
  let owner: string;

  before(async () => {
    accounts = await ethers.getSigners();
    owner = await accounts[0].getAddress();
    const PikaFactory = (await ethers.getContractFactory('Pika')) as Pika__factory;
    owned = (await upgrades.deployProxy(PikaFactory, [
      ethers.utils.parseEther('10000000000000'),
      ethers.utils.parseEther('50000000000000'),
      await accounts[1].getAddress(),
      'PIKA',
      'PIKA',
      '275',
    ])) as Pika;
  });

  it('only owner should be able to propose a new owner', async () => {
    await expect(owned.connect(accounts[1]).proposeOwner(await accounts[1].getAddress())).to.be.reverted;
  });

  it('owner should be able to propose a new owner', async () => {
    expect(await owned.proposedOwner()).to.equal('0x0000000000000000000000000000000000000000');
    await owned.proposeOwner(await accounts[1].getAddress());
    expect(await owned.proposedOwner()).to.equal(await accounts[1].getAddress());
  });

  it('only proposed owner should be able to accept ownership', async () => {
    expect(await owned.owner()).to.equal(await accounts[0].getAddress());
    await expect(owned.claimOwnership()).to.be.reverted;
    await expect(owned.connect(accounts[2]).claimOwnership()).to.be.reverted;
    await expect(owned.connect(accounts[1]).claimOwnership())
      .to.emit(owned, 'OwnershipTransferred')
      .withArgs(await accounts[0].getAddress(), await accounts[1].getAddress());
    expect(await owned.owner()).to.equal(await accounts[1].getAddress());
  });
});
