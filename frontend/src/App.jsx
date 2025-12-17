import { useState, useEffect } from "react";
import { ethers } from "ethers";
import axios from "axios";
import CrystalGiveArtifact from "./CrystalGive.json";

// --- 설정 영역 ---
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const PINATA_API_KEY = "INPUT_YOUR_API_KEY"; 
const PINATA_SECRET_KEY = "INPUT_YOUR_SECRET_KEY";



function App() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // 데이터 상태
  const [campaigns, setCampaigns] = useState([]);
  const [myDonations, setMyDonations] = useState([]); 
  const [showMyPage, setShowMyPage] = useState(false); 

  // 폼 상태
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  
  // 상세보기 상태
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);
  const [requests, setRequests] = useState([]);
  const [donors, setDonors] = useState([]); 

  // 요청 생성 폼
  const [reqDesc, setReqDesc] = useState("");
  const [reqValue, setReqValue] = useState("");
  const [reqRecipient, setReqRecipient] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          setAccount(address);

          const contractABI = CrystalGiveArtifact.abi ? CrystalGiveArtifact.abi : CrystalGiveArtifact;
          const tempContract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
          setContract(tempContract);

          fetchCampaigns(tempContract);
          fetchMyDonations(tempContract, address);
        } catch (err) {
          console.error("초기화 실패:", err);
        }
      }
    };
    init();
  }, []);

  const uploadToIPFS = async (file) => {
    if (!file) return null;
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
        maxBodyLength: "Infinity",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY,
        },
      });
      return res.data.IpfsHash;
    } catch (error) {
      console.error("IPFS 업로드 실패:", error);
      alert("이미지 업로드 실패 (API Key 확인)");
      throw error;
    }
  };

  const fetchCampaigns = async (contractInstance) => {
    if (!contractInstance) return;
    try {
      setIsLoading(true);
      const count = await contractInstance.campaignCount();
      const parsedCount = Number(count);

      const campaignsData = [];
      for (let i = 0; i < parsedCount; i++) {
        const item = await contractInstance.campaigns(i);
        campaignsData.push({
          id: i,
          owner: item[0],
          title: item[1],
          target: ethers.formatEther(item[2]),
          amountCollected: ethers.formatEther(item[3]),
          approversCount: Number(item[4])
        });
      }
      setCampaigns(campaignsData);
    } catch (error) {
      console.error("캠페인 로드 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 내 기부 내역 가져오기 
  const fetchMyDonations = async (contractInstance, myAddress) => {
    if (!contractInstance || !myAddress) return;
    try {
      const filter = contractInstance.filters.DonationReceived(); 
      const logs = await contractInstance.queryFilter(filter);
      
      const myHistory = logs
        .filter(log => log.args[1].toLowerCase() === myAddress.toLowerCase())
        .map(log => ({
          campaignId: Number(log.args[0]),
          donor: log.args[1],
          amount: ethers.formatEther(log.args[2]),
          txHash: log.transactionHash,
          blockNumber: log.blockNumber
        }));
      
      setMyDonations(myHistory.reverse());
    } catch (error) {
      console.error("내역 로드 실패:", error);
    }
  };

  const fetchCampaignDonors = async (campaignId) => {
    if (!contract) return;
    try {
      const filter = contract.filters.DonationReceived(campaignId);
      const logs = await contract.queryFilter(filter);
      const donorList = logs.map(log => ({
        donor: log.args[1],
        amount: ethers.formatEther(log.args[2]),
        blockNumber: log.blockNumber
      }));
      setDonors(donorList.reverse());
    } catch (error) {
      console.error("기부자 리스트 로드 실패:", error);
    }
  };

  const createCampaign = async () => {
    if (!contract) return alert("지갑 연결 필요");
    if (!title || !goal) return alert("필수 입력 누락");

    try {
      setIsLoading(true);
      const tx = await contract.createCampaign(title, ethers.parseEther(goal));
      await tx.wait();
      alert("캠페인 생성 완료!");
      setTitle(""); setGoal("");
      fetchCampaigns(contract);
    } catch (error) {
      console.error(error);
      alert("생성 실패");
    } finally {
      setIsLoading(false);
    }
  };

  const donate = async (id, amount) => {
    if (!contract || !amount) return;
    try {
      setIsLoading(true);
      const tx = await contract.donate(id, { value: ethers.parseEther(amount) });
      await tx.wait();
      alert("기부 성공! 감사합니다 💎");
      fetchCampaigns(contract);
      fetchMyDonations(contract, account); 
      if(expandedCampaignId === id) fetchCampaignDonors(id); 
    } catch (error) {
      console.error(error);
      alert("기부 실패");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpandCampaign = (campaignId) => {
    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null); 
    } else {
      setExpandedCampaignId(campaignId); 
      fetchRequests(campaignId);
      fetchCampaignDonors(campaignId); 
    }
  };

  const fetchRequests = async (campaignId) => {
    if (!contract) return;
    try {
      setIsLoading(true);
      const count = await contract.getRequestsCount(campaignId);
      const parsedCount = Number(count);
      
      const requestsData = [];
      for (let i = 0; i < parsedCount; i++) {
        const req = await contract.requests(campaignId, i);
        requestsData.push({
          id: i,
          description: req[0],
          value: ethers.formatEther(req[1]),
          recipient: req[2],
          proofCid: req[3],
          complete: req[4],
          approvalCount: Number(req[5])
        });
      }
      setRequests(requestsData);
    } catch (error) {
      console.error("요청 로드 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createRequest = async (campaignId) => {
    if (!reqDesc || !reqValue || !reqRecipient) return alert("정보를 입력하세요");
    if (!selectedFile) return alert("증빙 자료 필수!");

    try {
      setIsLoading(true);
      const cid = await uploadToIPFS(selectedFile);
      const tx = await contract.createRequest(
        campaignId, 
        reqDesc, 
        ethers.parseEther(reqValue), 
        reqRecipient, 
        cid
      );
      await tx.wait();
      alert("요청 등록 완료!");
      setReqDesc(""); setReqValue(""); setReqRecipient(""); setSelectedFile(null);
      fetchRequests(campaignId);
    } catch (error) {
      console.error(error);
      alert("요청 생성 실패");
    } finally {
      setIsLoading(false);
    }
  };

  const approveRequest = async (campaignId, requestId) => {
    try {
      setIsLoading(true);
      const tx = await contract.approveRequest(campaignId, requestId);
      await tx.wait();
      alert("투표 완료!");
      fetchRequests(campaignId);
    } catch (error) {
      console.error(error);
      alert("투표 실패");
    } finally {
      setIsLoading(false);
    }
  };

  const finalizeRequest = async (campaignId, requestId) => {
    try {
      setIsLoading(true);
      const tx = await contract.finalizeRequest(campaignId, requestId);
      await tx.wait();
      alert("이체 완료!");
      fetchRequests(campaignId);
      fetchCampaigns(contract);
    } catch (error) {
      console.error(error);
      alert("이체 실패");
    } finally {
      setIsLoading(false);
    }
  };

  // SBT 배지 계산 로직 
  const getBadgeInfo = (amount) => {
    const val = parseFloat(amount);
    if (val >= 1.0) return { icon: "💎", label: "DIAMOND", color: "linear-gradient(135deg, #e3f2fd, #90caf9)", border: "#2196f3" };
    if (val >= 0.5) return { icon: "🥇", label: "GOLD", color: "linear-gradient(135deg, #fff9c4, #fbc02d)", border: "#f57f17" };
    if (val >= 0.1) return { icon: "🥈", label: "SILVER", color: "linear-gradient(135deg, #f5f5f5, #bdbdbd)", border: "#757575" };
    return { icon: "🥉", label: "BRONZE", color: "linear-gradient(135deg, #efebe9, #8d6e63)", border: "#5d4037" };
  };

  return (
    <div style={{ padding: "40px 20px", fontFamily: "'Pretendard', sans-serif", maxWidth: "900px", margin: "0 auto", background: "#f8f9fa", minHeight: "100vh" }}>
      {/* --- 헤더 --- */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", background:"white", padding:"20px", borderRadius:"16px", boxShadow:"0 4px 20px rgba(0,0,0,0.05)" }}>
        <div>
          <h1 style={{margin:0, color:"#4c6ef5", fontSize:"1.8rem", letterSpacing:"-1px"}}>💎 CrystalGive</h1>
          <p style={{margin:"5px 0 0 0", fontSize:"0.9rem", color:"#868e96"}}>투명한 블록체인 기부 플랫폼</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button 
            onClick={() => setShowMyPage(!showMyPage)}
            style={{ padding: "10px 20px", background: showMyPage ? "#4c6ef5" : "#e7f5ff", color: showMyPage ? "#fff" : "#4c6ef5", border: "none", borderRadius: "12px", cursor: "pointer", fontWeight: "bold", transition: "0.2s" }}
          >
            {showMyPage ? "🏠 홈으로" : "👤 내 기부 증서(SBT)"}
          </button>
          <div style={{ padding: "10px 20px", background: "#f1f3f5", borderRadius: "12px", fontWeight: "bold", fontSize: "0.9rem", color:"#495057" }}>
            {account ? `🟢 ${account.substring(0,6)}...${account.substring(38)}` : "🔴 지갑 연결 필요"}
          </div>
        </div>
      </header>

      {/* --- 마이 페이지 (SBT 갤러리) --- */}
      {showMyPage && (
        <section style={{ marginBottom: "40px", background: "white", padding: "30px", borderRadius: "16px", boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
          <div style={{textAlign:"center", marginBottom:"30px"}}>
             <h2 style={{ margin: 0, color:"#343a40" }}>🏆 나의 SBT 기부 인증서</h2>
             <p style={{ color:"#868e96" }}>블록체인에 영구 기록된 당신의 선한 영향력입니다.</p>
          </div>
          
          {myDonations.length === 0 ? (
            <p style={{color:"#adb5bd", textAlign:"center", padding:"40px", border:"2px dashed #f1f3f5", borderRadius:"12px"}}>
              아직 획득한 기부 배지가 없습니다.<br/>캠페인에 참여하여 첫 번째 SBT를 획득해보세요!
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "25px" }}>
              {myDonations.map((log, idx) => {
                const badge = getBadgeInfo(log.amount);
                return (
                  <div key={idx} style={{ 
                    position: "relative",
                    padding: "20px", 
                    background: badge.color, 
                    borderRadius: "16px", 
                    border: `2px solid ${badge.border}`,
                    boxShadow: "0 8px 20px rgba(0,0,0,0.1)",
                    textAlign: "center",
                    overflow: "hidden"
                  }}>
                    {/* 카드 장식 */}
                    <div style={{ fontSize: "4rem", marginBottom: "10px" }}>{badge.icon}</div>
                    <h3 style={{ margin: "0", color: "#333", letterSpacing: "2px" }}>{badge.label}</h3>
                    <p style={{ fontSize: "0.8rem", color: "#555", marginBottom: "20px" }}>CONTRIBUTOR</p>
                    
                    {/* 상세 정보 */}
                    <div style={{ background: "rgba(255,255,255,0.7)", padding: "15px", borderRadius: "12px", backdropFilter: "blur(5px)" }}>
                      <div style={{ fontSize: "0.8rem", color: "#666", marginBottom:"5px" }}>PROJECT ID #{log.campaignId}</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#333" }}>{log.amount} ETH</div>
                      <div style={{ fontSize: "0.7rem", color: "#888", marginTop: "10px", wordBreak: "break-all" }}>
                        Tx: {log.txHash.substring(0,10)}...
                      </div>
                    </div>

                    <a href={`https://sepolia.etherscan.io/tx/${log.txHash}`} target="_blank" rel="noreferrer" style={{ 
                      display:"block", marginTop:"15px", padding:"8px", background:"#333", color:"white", textDecoration:"none", borderRadius:"8px", fontSize:"0.8rem" 
                    }}>
                      블록체인 증명 확인 ↗
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* --- 메인 콘텐츠 (캠페인 생성 및 목록) - 마이페이지 아닐때만 표시 --- */}
      {!showMyPage && (
        <>
          {/* 캠페인 생성 */}
          <section style={{ background: "#fff", padding: "30px", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", marginBottom: "40px" }}>
            <h3 style={{marginTop:0, color:"#343a40"}}>🚀 프로젝트 펀딩 시작하기</h3>
            <div style={{ display: "flex", gap: "12px", flexWrap:"wrap" }}>
              <input placeholder="프로젝트 명을 입력하세요" value={title} onChange={e=>setTitle(e.target.value)} style={{flex:1, padding:"15px", borderRadius:"8px", border:"1px solid #dee2e6", fontSize:"1rem"}} />
              <input placeholder="목표 ETH" type="number" value={goal} onChange={e=>setGoal(e.target.value)} style={{width:"120px", padding:"15px", borderRadius:"8px", border:"1px solid #dee2e6", fontSize:"1rem"}} />
              <button onClick={createCampaign} disabled={isLoading} style={{padding:"15px 30px", background:"#4c6ef5", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"bold", fontSize:"1rem"}}>
                프로젝트 생성
              </button>
            </div>
          </section>

          {/* 캠페인 목록 */}
          <h3 style={{ marginLeft: "5px", color:"#343a40", fontSize:"1.5rem" }}>📋 진행 중인 펀딩</h3>
          <div style={{ display: "grid", gap: "30px" }}>
            {campaigns.map((camp) => {
              const progress = Math.min((Number(camp.amountCollected) / Number(camp.target)) * 100, 100);
              const isSuccess = progress >= 100;

              return (
                <div key={camp.id} style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: "16px", padding: "30px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
                  {/* 상단 뱃지 & 정보 */}
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom:"20px" }}>
                    <div>
                      <div style={{display:"flex", gap:"10px", alignItems:"center", marginBottom:"10px"}}>
                        <span style={{ background:"#e7f5ff", color:"#1c7ed6", padding:"5px 10px", borderRadius:"6px", fontSize:"0.8rem", fontWeight:"bold"}}>#{camp.id}</span>
                        {isSuccess ? 
                          <span style={{ background:"#d3f9d8", color:"#2b8a3e", padding:"5px 10px", borderRadius:"6px", fontSize:"0.8rem", fontWeight:"bold"}}>🎉 모금 성공</span> :
                          <span style={{ background:"#fff4e6", color:"#e67700", padding:"5px 10px", borderRadius:"6px", fontSize:"0.8rem", fontWeight:"bold"}}>🔥 펀딩 진행중</span>
                        }
                      </div>
                      <h2 style={{ margin: "0", color: "#212529", fontSize:"1.8rem" }}>{camp.title}</h2>
                      <p style={{ margin: "5px 0 0 0", color: "#868e96", fontSize: "0.95rem" }}>Admin: {camp.owner}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#4c6ef5" }}>{camp.amountCollected} <span style={{fontSize:"1rem", color:"#868e96"}}>ETH</span></div>
                      <div style={{ fontSize: "0.9rem", color: "#868e96" }}>목표 {camp.target} ETH 달성률 <b>{progress.toFixed(1)}%</b></div>
                    </div>
                  </div>

                  {/* 진행바 */}
                  <div style={{ height: "16px", background: "#f1f3f5", borderRadius: "8px", overflow: "hidden", marginBottom:"25px" }}>
                    <div style={{ 
                      width: `${progress}%`, 
                      height: "100%", 
                      background: isSuccess ? "#40c057" : "linear-gradient(90deg, #4c6ef5, #22b8cf)",
                      transition: "width 0.5s ease-in-out"
                    }} />
                  </div>

                  {/* 액션 버튼 */}
                  <div style={{ display: "flex", gap: "10px", marginBottom: "15px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: "0px", flex: 1 }}>
                      <input id={`donate-${camp.id}`} placeholder="ETH" type="number" step="0.01" style={{ padding: "12px", border: "1px solid #ced4da", borderRadius: "8px 0 0 8px", width: "100px", outline:"none" }} />
                      <button 
                        onClick={() => donate(camp.id, document.getElementById(`donate-${camp.id}`).value)} 
                        disabled={isLoading}
                        style={{ padding: "12px 24px", background: "#20c997", color: "white", border: "none", borderRadius: "0 8px 8px 0", cursor: "pointer", fontWeight:"bold" }}
                      >
                        후원하기
                      </button>
                    </div>
                    <button 
                      onClick={() => handleExpandCampaign(camp.id)}
                      style={{ padding: "12px 24px", background: expandedCampaignId === camp.id ? "#343a40" : "#f8f9fa", color: expandedCampaignId === camp.id ? "white" : "#495057", border: "1px solid #dee2e6", borderRadius: "8px", cursor: "pointer", fontWeight:"bold" }}
                    >
                      {expandedCampaignId === camp.id ? "상세 닫기 ▲" : `자금 집행 현황 (${camp.approversCount}명 참여) ▼`}
                    </button>
                  </div>

                  {/* --- [확장 영역] 타임라인 & 기부자 리스트 --- */}
                  {expandedCampaignId === camp.id && (
                    <div style={{ marginTop: "30px", borderTop: "2px solid #f1f3f5", paddingTop: "30px", display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px" }}>
                      
                      {/* 왼쪽: 마일스톤 타임라인 (DAO) */}
                      <div>
                        <h4 style={{marginTop:0, marginBottom:"20px", color:"#495057"}}>🚩 자금 사용 계획 (Roadmap)</h4>
                        
                        {/* 관리자: 요청 생성 */}
                        {account.toLowerCase() === camp.owner.toLowerCase() && (
                          <div style={{ marginBottom: "25px", padding: "20px", background: "#f8f9fa", borderRadius: "12px", border: "1px dashed #ced4da" }}>
                            <h5 style={{margin:"0 0 15px 0", color:"#3b5bdb"}}>+ 다음 단계 자금 요청하기</h5>
                            <div style={{ display: "grid", gap: "10px", gridTemplateColumns:"1fr 1fr" }}>
                              <input placeholder="사용 목적 (예: 1단계 부지매입)" value={reqDesc} onChange={e=>setReqDesc(e.target.value)} style={{padding:"10px", gridColumn:"1/3", borderRadius:"6px", border:"1px solid #ddd"}} />
                              <input placeholder="필요 금액 (ETH)" value={reqValue} onChange={e=>setReqValue(e.target.value)} style={{padding:"10px", borderRadius:"6px", border:"1px solid #ddd"}} />
                              <input placeholder="수취인 지갑 주소" value={reqRecipient} onChange={e=>setReqRecipient(e.target.value)} style={{padding:"10px", borderRadius:"6px", border:"1px solid #ddd"}} />
                              <div style={{gridColumn:"1/3", display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"5px"}}>
                                <input type="file" onChange={(e) => setSelectedFile(e.target.files[0])} style={{fontSize:"0.9rem"}} />
                                <button onClick={() => createRequest(camp.id)} style={{background:"#3b5bdb", color:"white", border:"none", borderRadius:"6px", padding:"10px 20px", cursor:"pointer", fontWeight:"bold"}}>등록 요청</button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 타임라인 뷰 */}
                        {requests.length === 0 ? (
                          <div style={{textAlign:"center", color:"#adb5bd", padding:"30px", border:"1px dashed #dee2e6", borderRadius:"12px"}}>
                            아직 등록된 자금 사용 계획이 없습니다.
                          </div>
                        ) : (
                          <div style={{ position: "relative", paddingLeft: "20px" }}>
                            <div style={{ position:"absolute", left:"7px", top:"10px", bottom:"10px", width:"2px", background:"#e9ecef" }}></div>
                            
                            {requests.map((req, idx) => (
                              <div key={idx} style={{ position: "relative", marginBottom: "25px", paddingLeft: "25px" }}>
                                <div style={{ 
                                  position: "absolute", left: "-4px", top: "5px", width: "24px", height: "24px", borderRadius: "50%", 
                                  background: req.complete ? "#20c997" : "#fff", 
                                  border: req.complete ? "none" : "4px solid #3b5bdb",
                                  zIndex: 1
                                }}>
                                  {req.complete && <span style={{color:"white", display:"flex", justifyContent:"center", alignItems:"center", height:"100%", fontSize:"12px"}}>✓</span>}
                                </div>

                                <div style={{ padding: "20px", background: req.complete ? "#f8f9fa" : "#fff", border: req.complete ? "1px solid #eee" : "1px solid #bac8ff", borderRadius: "12px", boxShadow: req.complete ? "none" : "0 4px 12px rgba(76, 110, 245, 0.1)" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                    <span style={{ fontSize:"0.85rem", fontWeight:"bold", color: req.complete ? "#adb5bd" : "#3b5bdb" }}>STEP {idx + 1}</span>
                                    <span style={{ fontSize:"0.85rem", color:"#868e96" }}>{req.complete ? "지급 완료됨" : "승인 대기중"}</span>
                                  </div>
                                  <h4 style={{ margin: "0 0 10px 0", color: req.complete ? "#868e96" : "#343a40", textDecoration: req.complete ? "line-through" : "none" }}>{req.description}</h4>
                                  
                                  <div style={{ display: "flex", gap: "10px", fontSize: "0.9rem", color: "#495057", marginBottom: "15px", background:"#f8f9fa", padding:"10px", borderRadius:"8px" }}>
                                    <span>💰 {req.value} ETH</span>
                                    <span style={{color:"#ced4da"}}>|</span>
                                    <span>🧾 {req.proofCid && req.proofCid !== "N/A" ? <a href={`https://gateway.pinata.cloud/ipfs/${req.proofCid}`} target="_blank" rel="noreferrer" style={{color:"#4c6ef5", fontWeight:"bold"}}>영수증 검증</a> : <span style={{color:"red"}}>증빙 없음</span>}</span>
                                  </div>

                                  {!req.complete && (
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <div style={{ fontSize: "0.9rem", fontWeight:"bold", color: req.approvalCount > (camp.approversCount/2) ? "#20c997" : "#fa5252" }}>
                                        찬성 {req.approvalCount}표 <span style={{fontWeight:"normal", color:"#868e96"}}>({camp.approversCount}명 중 과반 필요)</span>
                                      </div>
                                      <div style={{ display: "flex", gap: "8px" }}>
                                        <button onClick={() => approveRequest(camp.id, idx)} style={{ background: "#20c997", color: "white", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontWeight:"bold" }}>찬성 투표</button>
                                        {account.toLowerCase() === camp.owner.toLowerCase() && (
                                          <button onClick={() => finalizeRequest(camp.id, idx)} style={{ background: "#fa5252", color: "white", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontWeight:"bold" }}>자금 인출</button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 오른쪽: 기부자 리스트 */}
                      <div style={{ borderLeft: "1px solid #f1f3f5", paddingLeft: "30px" }}>
                        <h4 style={{marginTop:0, color:"#495057"}}>🏆 참여자 ({donors.length})</h4>
                        <div style={{ maxHeight: "400px", overflowY: "auto", paddingRight:"10px" }}>
                          {donors.length === 0 ? <p style={{color:"#aaa", fontSize:"0.9rem"}}>아직 기부자가 없습니다.</p> : (
                            <ul style={{ listStyle: "none", padding: 0 }}>
                              {donors.map((d, i) => (
                                <li key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid #f8f9fa" }}>
                                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                                    <div style={{width:"32px", height:"32px", borderRadius:"50%", background:"#e7f5ff", display:"flex", justifyContent:"center", alignItems:"center", fontSize:"12px"}}>👤</div>
                                    <div>
                                      <div style={{ fontSize:"0.9rem", fontWeight: "bold", color: "#343a40" }}>{d.donor.slice(0,6)}...</div>
                                      <div style={{ fontSize:"0.75rem", color: "#adb5bd" }}>Block #{d.blockNumber}</div>
                                    </div>
                                  </div>
                                  <div style={{ fontWeight:"bold", color: "#4c6ef5" }}>{d.amount} ETH</div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
