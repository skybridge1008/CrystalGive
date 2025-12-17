const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrystalGive Smart Contract", function () {
  let CrystalGive;
  let crystalGive;
  let owner;      // 캠페인 관리자 (단체)
  let donor1;     // 기부자 1
  let donor2;     // 기부자 2
  let recipient;  // 물품 공급 업체 (수령인)

  // 각 테스트(it) 실행 전에 공통적으로 실행되는 부분
  beforeEach(async function () {
    // 지갑 주소 가져오기
    [owner, donor1, donor2, recipient] = await ethers.getSigners();

    // 컨트랙트 배포
    const CrystalGiveFactory = await ethers.getContractFactory("CrystalGive");
    crystalGive = await CrystalGiveFactory.deploy();
    
    // 배포 완료 대기 (Ethers v6 문법)
    await crystalGive.waitForDeployment();
  });

  it("전체 시나리오 테스트: 캠페인 생성부터 자금 집행까지", async function () {
    // 1. 캠페인 생성
    // 목표 금액 10 ETH
    const goal = ethers.parseEther("10"); 
    await crystalGive.createCampaign("Save the Earth", goal);

    // 2. 기부하기
    // donor1이 2 ETH 기부
    await crystalGive.connect(donor1).donate(0, { value: ethers.parseEther("2") });
    // donor2가 3 ETH 기부
    await crystalGive.connect(donor2).donate(0, { value: ethers.parseEther("3") });

    // 컨트랙트 잔액 확인 (총 5 ETH가 모였는지)
    const contractBalance = await ethers.provider.getBalance(await crystalGive.getAddress());
    expect(contractBalance).to.equal(ethers.parseEther("5"));
    console.log("✅ 기부 완료: 컨트랙트에 5 ETH 적립됨");

    // 3. 인출 요청 생성 (관리자만 가능)
    // 1 ETH를 recipient에게 보내겠다고 요청
    await crystalGive.connect(owner).createRequest(
      0, 
      "Buy Food", 
      ethers.parseEther("1"), 
      recipient.address, 
      "QmHash123" // IPFS Hash (가짜 데이터)
    );

    // 4. 투표 (기부자만 가능)
    // donor1 찬성
    await crystalGive.connect(donor1).approveRequest(0, 0);
    // donor2 찬성
    await crystalGive.connect(donor2).approveRequest(0, 0);

    // 5. 집행 전 recipient 잔고 확인
    const balanceBefore = await ethers.provider.getBalance(recipient.address);

    // 6. 자금 집행 (Finalize)
    // 과반수 이상 찬성했으므로 실행되어야 함
    await crystalGive.connect(owner).finalizeRequest(0, 0);

    // 7. 결과 검증
    const balanceAfter = await ethers.provider.getBalance(recipient.address);
    
    // 잔고가 1 ETH 늘었는지 확인
    expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("1"));
    console.log("🎉 집행 성공: 수령인에게 1 ETH 송금 완료");
  });
});