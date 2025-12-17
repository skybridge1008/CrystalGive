// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  console.log("Deploying contracts with the account:", (await hre.ethers.getSigners())[0].address);

  // 컨트랙트 공장(Factory) 가져오기
  const CrystalGive = await hre.ethers.getContractFactory("CrystalGive");
  
  // 배포 트랜잭션 발생
  const crystalGive = await CrystalGive.deploy();

  // 배포 완료 대기
  await crystalGive.waitForDeployment();

  // 배포된 주소 출력
  console.log("✨ CrystalGive deployed to:", await crystalGive.getAddress());
}

// 에러 처리 패턴
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});