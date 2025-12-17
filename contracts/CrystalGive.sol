// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 보안을 위해 OpenZeppelin의 재진입 공격 방지 모듈 사용
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CrystalGive is ReentrancyGuard {

    // --- 1. 데이터 구조 (Structs) ---
    
    // 자금 인출 요청서
    struct Request {
        string description;   // 사용 목적 (예: "식수 펌프 구매")
        uint256 value;        // 요청 금액 (Wei 단위)
        address recipient;    // 자금을 받을 주소 (공급업체 등)
        string proofCid;      // IPFS 영수증 이미지 해시값
        bool complete;        // 집행 완료 여부
        uint256 approvalCount;// 찬성 투표 수
        mapping(address => bool) approvals; // 투표 여부 기록 (중복 투표 방지)
    }

    // 기부 캠페인
    struct Campaign {
        address manager;      // 캠페인 관리자 (단체)
        string title;         // 프로젝트 제목
        uint256 goalAmount;   // 목표 금액
        uint256 raisedAmount; // 현재 모금액
        uint256 approversCount; // 기부자 수
        mapping(address => bool) approvers; // 기부자 명단
    }

    // --- 2. 상태 변수 (State Variables) ---
    
    // 캠페인 ID => 캠페인 데이터
    mapping(uint256 => Campaign) public campaigns;
    // 캠페인 ID => 요청서 리스트 (배열)
    mapping(uint256 => Request[]) public requests;
    // 전체 캠페인 개수 (ID 생성용)
    uint256 public campaignCount;

    // --- 3. 이벤트 (Events - 프론트엔드 연동용) ---
    
    event CampaignCreated(uint256 campaignId, string title, address manager);
    event DonationReceived(uint256 campaignId, address donor, uint256 amount);
    event RequestCreated(uint256 campaignId, uint256 requestId, string description, uint256 amount);
    event RequestApproved(uint256 campaignId, uint256 requestId, address approver);
    event RequestFinalized(uint256 campaignId, uint256 requestId, uint256 amount);

    // --- 4. 접근 제어자 (Modifiers) ---

    // 관리자(단체)만 실행 가능
    modifier onlyManager(uint256 _campaignId) {
        require(msg.sender == campaigns[_campaignId].manager, "Only manager can call this");
        _;
    }

    // 기부자만 실행 가능
    modifier onlyDonor(uint256 _campaignId) {
        require(campaigns[_campaignId].approvers[msg.sender], "Only donors can vote");
        _;
    }

    // --- 5. 핵심 기능 (Functions) ---

    /**
     * @dev 1. 새로운 기부 캠페인 생성
     */
    function createCampaign(string memory _title, uint256 _goal) public {
        Campaign storage newCampaign = campaigns[campaignCount];
        newCampaign.manager = msg.sender;
        newCampaign.title = _title;
        newCampaign.goalAmount = _goal;
        newCampaign.raisedAmount = 0;
        newCampaign.approversCount = 0;

        emit CampaignCreated(campaignCount, _title, msg.sender);
        campaignCount++;
    }

    /**
     * @dev 2. 기부하기 (ETH 송금)
     */
    function donate(uint256 _campaignId) public payable {
        require(msg.value > 0, "Donation must be greater than 0");
        Campaign storage campaign = campaigns[_campaignId];

        // 신규 기부자라면 카운트 증가
        if(!campaign.approvers[msg.sender]) {
            campaign.approvers[msg.sender] = true;
            campaign.approversCount++;
        }
        
        campaign.raisedAmount += msg.value;
        emit DonationReceived(_campaignId, msg.sender, msg.value);
    }

    /**
     * @dev 3. 자금 인출 요청 생성 (관리자 전용)
     */
    function createRequest(
        uint256 _campaignId, 
        string memory _description, 
        uint256 _value, 
        address _recipient,
        string memory _proofCid
    ) public onlyManager(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];
        
        // 현재 컨트랙트 잔고가 요청액보다 많은지 체크 (간소화된 로직)
        require(_value <= address(this).balance, "Insufficient contract balance");
        
        Request storage newRequest = requests[_campaignId].push();
        newRequest.description = _description;
        newRequest.value = _value;
        newRequest.recipient = _recipient;
        newRequest.proofCid = _proofCid;
        newRequest.complete = false;
        newRequest.approvalCount = 0;

        emit RequestCreated(_campaignId, requests[_campaignId].length - 1, _description, _value);
    }

    /**
     * @dev 4. 인출 요청 승인/투표 (기부자 전용)
     */
    function approveRequest(uint256 _campaignId, uint256 _requestId) public onlyDonor(_campaignId) {
        Request storage request = requests[_campaignId][_requestId];
        
        require(!request.approvals[msg.sender], "You already voted");
        require(!request.complete, "Request already completed");

        request.approvals[msg.sender] = true;
        request.approvalCount++;

        emit RequestApproved(_campaignId, _requestId, msg.sender);
    }

    /**
     * @dev 5. 자금 집행 (과반수 동의 시)
     * nonReentrant: 재진입 공격 방지
     */
    function finalizeRequest(uint256 _campaignId, uint256 _requestId) public onlyManager(_campaignId) nonReentrant {
        Request storage request = requests[_campaignId][_requestId];
        Campaign storage campaign = campaigns[_campaignId];

        require(!request.complete, "Request already completed");
        // [핵심 로직] 과반수(50%) 초과 동의 시 집행
        require(request.approvalCount > (campaign.approversCount / 2), "Not enough approvals");
        require(address(this).balance >= request.value, "Insufficient funds");

        // 상태를 먼저 변경 (Check-Effects-Interactions 패턴)
        request.complete = true;

        // 실제 ETH 송금
        (bool success, ) = payable(request.recipient).call{value: request.value}("");
        require(success, "Transfer failed");

        emit RequestFinalized(_campaignId, _requestId, request.value);
    }

    /**
     * @dev Helper: 특정 캠페인의 총 요청 개수 반환
     */
    function getRequestsCount(uint256 _campaignId) public view returns (uint256) {
        return requests[_campaignId].length;
    }
}