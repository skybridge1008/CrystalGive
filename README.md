# 💎 CrystalGive (Transparent Blockchain Donation Platform)

> **"투명한 기부 생태계"**
>
> 이더리움 스마트 컨트랙트를 활용한 조건부 자금 집행 및 DAO 기반 검증 플랫폼

![Project Status](https://img.shields.io/badge/Status-Prototype-blue) ![License](https://img.shields.io/badge/License-MIT-green) ![Tech](https://img.shields.io/badge/Tech-Solidity%20%7C%20React%20%7C%20IPFS-lightgrey)

## 📖 프로젝트 소개 (Project Overview)

**CrystalGive**는 기부금 횡령 및 불투명한 자금 집행 문제를 해결하기 위해 개발된 블록체인 기반 크라우드펀딩 DApp입니다.
기존 기부 플랫폼과 달리, 모금된 자금은 관리자가 즉시 인출할 수 없으며 **스마트 컨트랙트(Smart Contract)**에 안전하게 보관(Escrow)됩니다. 자금을 사용하기 위해서는 **사용처 증빙(영수증)을 IPFS에 업로드**하고, **기부자들의 투표(Voting)**를 통해 과반수의 승인을 받아야만 집행이 가능합니다.

### 💡 해결하고자 하는 문제
* **불투명성:** 기부금이 실제로 어디에 쓰였는지 추적하기 어려움.
* **신뢰 비용:** 기부 단체의 도덕성에만 의존해야 하는 구조적 한계.
* **먹튀 방지:** 모금 후 자금을 들고 사라지는 사기 행위 원천 차단.

---

## ✨ 핵심 기능 (Key Features)

이 프로젝트는 다음과 같은 Web3 핵심 기능을 구현하였습니다.

### 1. 🔒 조건부 에스크로 & 마일스톤 집행
* 기부금은 관리자 지갑이 아닌 스마트 컨트랙트에 보관됩니다.
* 프로젝트 진행 단계에 따라 필요한 만큼만 요청하고 인출할 수 있습니다.

### 2. 🗳️ DAO 거버넌스 (투표 시스템)
* 자금 인출 요청 시 기부자(Donor)들에게만 투표권이 부여됩니다.
* **과반수(50% 이상)의 찬성**을 얻어야만 블록체인 상에서 자금 이체가 실행됩니다.

### 3. 🧾 IPFS 기반 증빙 자료 검증
* 관리자는 자금 요청 시 영수증이나 견적서 이미지를 필수적으로 첨부해야 합니다.
* 이미지는 **Pinata(IPFS)**에 분산 저장되며, 위변조가 불가능한 CID(해시값)가 온체인에 기록됩니다.
* 기부자는 UI에서 해당 증빙 자료를 즉시 확인할 수 있습니다.

### 4. 🏆 SBT(Soulbound Token) 기부 인증서
* 기부자의 기여도에 따라 **Bronze, Silver, Gold, Diamond** 등급의 디지털 인증서를 발급합니다.
* 블록체인에 영구히 남는 사회적 평판 증명 수단으로 활용됩니다.

### 5. 📊 실시간 투명성 시각화
* **타임라인 UI:** 자금 집행 계획과 승인 상태를 시각적으로 보여줍니다.
* **기부자 리더보드:** `DonationReceived` 이벤트를 인덱싱하여 실시간으로 기부 내역을 투명하게 공개합니다.

---

## 🛠 기술 스택 (Tech Stack)

### Blockchain & Smart Contract
* **Solidity (v0.8.x):** 스마트 컨트랙트 로직 구현
* **Hardhat:** 로컬 개발 환경, 테스트 및 배포
* **Ethers.js (v6):** 프론트엔드와 블록체인 간 통신 (Provider/Signer)

### Frontend
* **React:** 사용자 인터페이스(UI) 구축
* **Axios:** Pinata API 비동기 통신
* **React-Toastify:** 사용자 알림(Toast) 처리

### Storage
* **IPFS (via Pinata):** 대용량 증빙 이미지(Receipts) 분산 저장

---

## 🚀 실행 방법 

이 프로젝트를 로컬 환경에서 실행하려면 다음 단계가 필요합니다.

### 1. 환경 설정 및 설치
```bash
# Repository 클론
git clone [https://github.com/YOUR_GITHUB_ID/CrystalGive.git](https://github.com/YOUR_GITHUB_ID/CrystalGive.git)
cd CrystalGive
```
# 의존성 패키지 설치
npm install

### 2. 로컬 블록체인 실행 (Terminal 1)
```bash
npx hardhat node
```
### 3. 스마트 컨트랙트 배포 (Terminal 2)
```bash
npx hardhat run scripts/deploy.js --network localhost
```

Note: 배포 후 출력되는 Contract Address를 복사하여 App.jsx 파일의 CONTRACT_ADDRESS 변수에 업데이트해야 합니다.

### 4. 프론트엔드 실행 (Terminal 2)
```bash
npm run dev
```
브라우저에서 http://localhost:5173 접속.
