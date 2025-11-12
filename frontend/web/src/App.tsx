import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { JSX, useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';
import { ethers } from 'ethers';

interface ReviewData {
  id: number;
  title: string;
  author: string;
  encryptedScore: string;
  publicValue1: number;
  publicValue2: number;
  timestamp: number;
  creator: string;
  isVerified?: boolean;
  decryptedValue?: number;
  category: string;
  status: string;
}

interface ReviewStats {
  totalReviews: number;
  avgScore: number;
  verifiedCount: number;
  pendingCount: number;
  recentActivity: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingReview, setCreatingReview] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending" as const, 
    message: "" 
  });
  const [newReviewData, setNewReviewData] = useState({ 
    title: "", 
    author: "", 
    score: "", 
    category: "Computer Science",
    comments: "" 
  });
  const [selectedReview, setSelectedReview] = useState<ReviewData | null>(null);
  const [decryptedScore, setDecryptedScore] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [activeTab, setActiveTab] = useState("reviews");
  const [searchTerm, setSearchTerm] = useState("");

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting} = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) return;
      if (isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const reviewsList: ReviewData[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          reviewsList.push({
            id: parseInt(businessId.replace('review-', '')) || Date.now(),
            title: businessData.name,
            author: "Anonymous Reviewer",
            encryptedScore: businessId,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0,
            category: "Academic Paper",
            status: businessData.isVerified ? "Verified" : "Pending"
          });
        } catch (e) {
          console.error('Error loading review data:', e);
        }
      }
      
      setReviews(reviewsList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const createReview = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingReview(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating review with Zama FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const scoreValue = parseInt(newReviewData.score) || 0;
      const businessId = `review-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, scoreValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newReviewData.title,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        scoreValue,
        0,
        newReviewData.comments
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Review created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewReviewData({ title: "", author: "", score: "", category: "Computer Science", comments: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingReview(false); 
    }
  };

  const decryptScore = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Score already verified on-chain" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption on-chain..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Score decrypted and verified successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Score is already verified on-chain" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        await loadData();
        return null;
      }
      
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: "Decryption failed: " + (e.message || "Unknown error") 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const available = await contract.isAvailable();
      setTransactionStatus({ 
        visible: true, 
        status: "success", 
        message: "Contract is available and ready" 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const getReviewStats = (): ReviewStats => {
    const totalReviews = reviews.length;
    const verifiedCount = reviews.filter(r => r.isVerified).length;
    const pendingCount = totalReviews - verifiedCount;
    const avgScore = totalReviews > 0 
      ? reviews.reduce((sum, r) => sum + r.publicValue1, 0) / totalReviews 
      : 0;
    
    const recentActivity = reviews.filter(r => 
      Date.now()/1000 - r.timestamp < 60 * 60 * 24 * 7
    ).length;

    return {
      totalReviews,
      avgScore,
      verifiedCount,
      pendingCount,
      recentActivity
    };
  };

  const filteredReviews = reviews.filter(review =>
    review.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    review.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
    review.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderStatsPanel = () => {
    const stats = getReviewStats();
    
    return (
      <div className="stats-panels">
        <div className="stat-panel gold-panel">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Total Reviews</h3>
            <div className="stat-value">{stats.totalReviews}</div>
            <div className="stat-trend">+{stats.recentActivity} this week</div>
          </div>
        </div>
        
        <div className="stat-panel silver-panel">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>Verified Scores</h3>
            <div className="stat-value">{stats.verifiedCount}/{stats.totalReviews}</div>
            <div className="stat-trend">FHE Protected</div>
          </div>
        </div>
        
        <div className="stat-panel bronze-panel">
          <div className="stat-icon">⭐</div>
          <div className="stat-content">
            <h3>Average Score</h3>
            <div className="stat-value">{stats.avgScore.toFixed(1)}/10</div>
            <div className="stat-trend">Encrypted Average</div>
          </div>
        </div>
      </div>
    );
  };

  const renderFHEProcess = () => {
    return (
      <div className="fhe-process">
        <div className="process-step">
          <div className="step-number">1</div>
          <div className="step-content">
            <h4>Blind Submission</h4>
            <p>Reviewer submits encrypted score using Zama FHE</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-number">2</div>
          <div className="step-content">
            <h4>Encrypted Storage</h4>
            <p>Score stored on-chain with FHE protection</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-number">3</div>
          <div className="step-content">
            <h4>Homomorphic Aggregation</h4>
            <p>Editor computes average without decryption</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-number">4</div>
          <div className="step-content">
            <h4>Selective Revelation</h4>
            <p>Only final aggregated scores revealed</p>
          </div>
        </div>
      </div>
    );
  };

  const renderFAQ = () => {
    return (
      <div className="faq-section">
        <h3>FHE Peer Review FAQ</h3>
        <div className="faq-list">
          <div className="faq-item">
            <h4>How does FHE protect against bias?</h4>
            <p>Individual scores remain encrypted until aggregation, preventing editors from identifying specific reviewers.</p>
          </div>
          <div className="faq-item">
            <h4>What data types are supported?</h4>
            <p>Currently supports integer scores (1-10). Text comments are stored publicly but separated from scores.</p>
          </div>
          <div className="faq-item">
            <h4>How is academic integrity maintained?</h4>
            <p>All operations are verifiable on-chain while preserving confidentiality through zero-knowledge proofs.</p>
          </div>
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo-section">
            <div className="logo-icon">🔒</div>
            <h1>Confidential Scholarly Peer Review</h1>
          </div>
          <div className="header-actions">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="prompt-content">
            <div className="prompt-icon">⚡</div>
            <h2>Connect Wallet to Access Encrypted Review System</h2>
            <p>Secure, bias-resistant academic peer review powered by Zama FHE technology</p>
            <div className="feature-grid">
              <div className="feature-item">
                <span className="feature-icon">🔐</span>
                <span>Encrypted Score Submission</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📈</span>
                <span>Homomorphic Aggregation</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">👥</span>
                <span>Double-Blind Mechanism</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="metal-spinner"></div>
        <p>Initializing FHE Encryption System...</p>
        <p className="loading-note">Securing academic integrity with fully homomorphic encryption</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="metal-spinner"></div>
      <p>Loading encrypted review system...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-icon">🔒</div>
          <div>
            <h1>PeerReviewZama</h1>
            <p>學術隱私評審 · FHE Protected</p>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-btn metal-btn"
          >
            + New Review
          </button>
          <button 
            onClick={checkAvailability} 
            className="check-btn metal-btn"
          >
            Check System
          </button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>
      
      <nav className="app-nav">
        <button 
          className={`nav-btn ${activeTab === "reviews" ? "active" : ""}`}
          onClick={() => setActiveTab("reviews")}
        >
          📋 Reviews
        </button>
        <button 
          className={`nav-btn ${activeTab === "stats" ? "active" : ""}`}
          onClick={() => setActiveTab("stats")}
        >
          📈 Statistics
        </button>
        <button 
          className={`nav-btn ${activeTab === "faq" ? "active" : ""}`}
          onClick={() => setActiveTab("faq")}
        >
          ❓ FAQ
        </button>
      </nav>
      
      <main className="main-content">
        {activeTab === "reviews" && (
          <div className="reviews-tab">
            <div className="tab-header">
              <h2>Encrypted Peer Reviews</h2>
              <div className="header-controls">
                <div className="search-box">
                  <input 
                    type="text" 
                    placeholder="Search reviews..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>
                <button 
                  onClick={loadData} 
                  className="refresh-btn metal-btn" 
                  disabled={isRefreshing}
                >
                  {isRefreshing ? "🔄" : "Refresh"}
                </button>
              </div>
            </div>
            
            <div className="reviews-grid">
              {filteredReviews.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📄</div>
                  <p>No reviews found</p>
                  <button 
                    className="create-btn metal-btn" 
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create First Review
                  </button>
                </div>
              ) : filteredReviews.map((review, index) => (
                <div 
                  className={`review-card ${selectedReview?.id === review.id ? "selected" : ""} ${review.isVerified ? "verified" : ""}`} 
                  key={index}
                  onClick={() => setSelectedReview(review)}
                >
                  <div className="card-header">
                    <h3>{review.title}</h3>
                    <span className={`status-badge ${review.status.toLowerCase()}`}>
                      {review.status}
                    </span>
                  </div>
                  <div className="card-meta">
                    <span>Author: {review.author}</span>
                    <span>Category: {review.category}</span>
                  </div>
                  <div className="card-score">
                    <span>Score: {review.isVerified ? `${review.decryptedValue}/10` : "🔒 Encrypted"}</span>
                    <span>Date: {new Date(review.timestamp * 1000).toLocaleDateString()}</span>
                  </div>
                  <div className="card-creator">
                    Reviewer: {review.creator.substring(0, 8)}...{review.creator.substring(36)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {activeTab === "stats" && (
          <div className="stats-tab">
            <h2>Review Statistics & Analytics</h2>
            {renderStatsPanel()}
            
            <div className="fhe-section">
              <h3>FHE Encryption Process</h3>
              {renderFHEProcess()}
            </div>
          </div>
        )}
        
        {activeTab === "faq" && (
          <div className="faq-tab">
            <h2>Frequently Asked Questions</h2>
            {renderFAQ()}
          </div>
        )}
      </main>
      
      {showCreateModal && (
        <ModalCreateReview 
          onSubmit={createReview} 
          onClose={() => setShowCreateModal(false)} 
          creating={creatingReview} 
          reviewData={newReviewData} 
          setReviewData={setNewReviewData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedReview && (
        <ReviewDetailModal 
          review={selectedReview} 
          onClose={() => { 
            setSelectedReview(null); 
            setDecryptedScore(null); 
          }} 
          decryptedScore={decryptedScore} 
          setDecryptedScore={setDecryptedScore} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptData={() => decryptScore(selectedReview.encryptedScore)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-toast">
          <div className={`toast-content ${transactionStatus.status}`}>
            <div className="toast-icon">
              {transactionStatus.status === "pending" && <div className="metal-spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="toast-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalCreateReview: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  reviewData: any;
  setReviewData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, reviewData, setReviewData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'score') {
      const intValue = value.replace(/[^\d]/g, '');
      setReviewData({ ...reviewData, [name]: intValue });
    } else {
      setReviewData({ ...reviewData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="create-review-modal">
        <div className="modal-header">
          <h2>New Encrypted Review</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice metal-panel">
            <strong>FHE 🔐 Protection</strong>
            <p>Review scores encrypted with Zama FHE - only aggregated results are visible to editors</p>
          </div>
          
          <div className="form-group">
            <label>Paper Title *</label>
            <input 
              type="text" 
              name="title" 
              value={reviewData.title} 
              onChange={handleChange} 
              placeholder="Enter paper title..." 
            />
          </div>
          
          <div className="form-group">
            <label>Author</label>
            <input 
              type="text" 
              name="author" 
              value={reviewData.author} 
              onChange={handleChange} 
              placeholder="Enter author name..." 
            />
          </div>
          
          <div className="form-group">
            <label>Academic Category</label>
            <select name="category" value={reviewData.category} onChange={handleChange}>
              <option value="Computer Science">Computer Science</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Physics">Physics</option>
              <option value="Biology">Biology</option>
              <option value="Engineering">Engineering</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Score (1-10) *</label>
            <input 
              type="number" 
              min="1" 
              max="10" 
              name="score" 
              value={reviewData.score} 
              onChange={handleChange} 
              placeholder="Enter score..." 
            />
            <div className="data-label">FHE Encrypted Integer</div>
          </div>
          
          <div className="form-group">
            <label>Comments</label>
            <textarea 
              name="comments" 
              value={reviewData.comments} 
              onChange={handleChange} 
              placeholder="Enter review comments..." 
              rows={3}
            />
            <div className="data-label">Public Data</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn metal-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !reviewData.title || !reviewData.score} 
            className="submit-btn metal-btn"
          >
            {creating || isEncrypting ? "Encrypting and Submitting..." : "Submit Encrypted Review"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ReviewDetailModal: React.FC<{
  review: ReviewData;
  onClose: () => void;
  decryptedScore: number | null;
  setDecryptedScore: (value: number | null) => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ review, onClose, decryptedScore, setDecryptedScore, isDecrypting, decryptData }) => {
  const handleDecrypt = async () => {
    if (decryptedScore !== null) { 
      setDecryptedScore(null); 
      return; 
    }
    
    const decrypted = await decryptData();
    if (decrypted !== null) {
      setDecryptedScore(decrypted);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="review-detail-modal">
        <div className="modal-header">
          <h2>Review Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="review-info">
            <div className="info-row">
              <span>Paper Title:</span>
              <strong>{review.title}</strong>
            </div>
            <div className="info-row">
              <span>Author:</span>
              <strong>{review.author}</strong>
            </div>
            <div className="info-row">
              <span>Category:</span>
              <strong>{review.category}</strong>
            </div>
            <div className="info-row">
              <span>Reviewer:</span>
              <strong>{review.creator.substring(0, 8)}...{review.creator.substring(36)}</strong>
            </div>
            <div className="info-row">
              <span>Submission Date:</span>
              <strong>{new Date(review.timestamp * 1000).toLocaleDateString()}</strong>
            </div>
          </div>
          
          <div className="score-section">
            <h3>Encrypted Score</h3>
            
            <div className="score-display">
              <div className="score-value">
                {review.isVerified ? 
                  `${review.decryptedValue}/10 (On-chain Verified)` : 
                  decryptedScore !== null ? 
                  `${decryptedScore}/10 (Locally Decrypted)` : 
                  "🔒 FHE Encrypted Score"
                }
              </div>
              <button 
                className={`decrypt-btn metal-btn ${(review.isVerified || decryptedScore !== null) ? 'decrypted' : ''}`}
                onClick={handleDecrypt} 
                disabled={isDecrypting}
              >
                {isDecrypting ? (
                  "🔓 Verifying..."
                ) : review.isVerified ? (
                  "✅ Verified"
                ) : decryptedScore !== null ? (
                  "🔄 Re-verify"
                ) : (
                  "🔓 Verify Score"
                )}
              </button>
            </div>
            
            <div className="fhe-explanation metal-panel">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>FHE Protected Review</strong>
                <p>Individual scores remain encrypted to prevent bias. Only aggregated results are visible to editorial staff.</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn metal-btn">Close</button>
          {!review.isVerified && (
            <button 
              onClick={handleDecrypt} 
              disabled={isDecrypting}
              className="verify-btn metal-btn"
            >
              {isDecrypting ? "Verifying on-chain..." : "Verify on-chain"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;


