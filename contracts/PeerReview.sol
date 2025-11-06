pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract PeerReviewZama is ZamaEthereumConfig {
    struct Review {
        euint32 encryptedScore;
        uint256 publicScore;
        string comments;
        address reviewer;
        uint256 timestamp;
        bool isDecrypted;
        uint32 decryptedScore;
    }

    struct Paper {
        string title;
        string contentHash;
        address editor;
        uint256 submissionTime;
        Review[] reviews;
        uint256 totalScore;
        bool isFinalized;
    }

    mapping(string => Paper) public papers;
    mapping(string => mapping(address => bool)) public hasReviewed;

    event PaperSubmitted(string indexed paperId, address indexed submitter);
    event ReviewSubmitted(string indexed paperId, address indexed reviewer);
    event ScoreDecrypted(string indexed paperId, uint32 decryptedScore);
    event PaperFinalized(string indexed paperId, uint256 totalScore);

    constructor() ZamaEthereumConfig() {
    }

    function submitPaper(
        string calldata paperId,
        string calldata title,
        string calldata contentHash
    ) external {
        require(bytes(papers[paperId].title).length == 0, "Paper already exists");
        
        papers[paperId] = Paper({
            title: title,
            contentHash: contentHash,
            editor: msg.sender,
            submissionTime: block.timestamp,
            reviews: new Review[](0),
            totalScore: 0,
            isFinalized: false
        });
        
        emit PaperSubmitted(paperId, msg.sender);
    }

    function submitReview(
        string calldata paperId,
        externalEuint32 encryptedScore,
        bytes calldata inputProof,
        uint256 publicScore,
        string calldata comments
    ) external {
        require(bytes(papers[paperId].title).length > 0, "Paper does not exist");
        require(!hasReviewed[paperId][msg.sender], "Already reviewed");
        require(!papers[paperId].isFinalized, "Paper already finalized");
        
        require(FHE.isInitialized(FHE.fromExternal(encryptedScore, inputProof)), "Invalid encrypted input");
        
        Review memory review = Review({
            encryptedScore: FHE.fromExternal(encryptedScore, inputProof),
            publicScore: publicScore,
            comments: comments,
            reviewer: msg.sender,
            timestamp: block.timestamp,
            isDecrypted: false,
            decryptedScore: 0
        });
        
        FHE.allowThis(review.encryptedScore);
        FHE.makePubliclyDecryptable(review.encryptedScore);
        
        papers[paperId].reviews.push(review);
        hasReviewed[paperId][msg.sender] = true;
        
        emit ReviewSubmitted(paperId, msg.sender);
    }

    function decryptScore(
        string calldata paperId,
        uint256 reviewIndex,
        bytes memory abiEncodedClearValue,
        bytes memory decryptionProof
    ) external {
        require(bytes(papers[paperId].title).length > 0, "Paper does not exist");
        require(reviewIndex < papers[paperId].reviews.length, "Invalid review index");
        require(!papers[paperId].reviews[reviewIndex].isDecrypted, "Score already decrypted");
        
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(papers[paperId].reviews[reviewIndex].encryptedScore);
        
        FHE.checkSignatures(cts, abiEncodedClearValue, decryptionProof);
        
        uint32 decodedValue = abi.decode(abiEncodedClearValue, (uint32));
        
        papers[paperId].reviews[reviewIndex].decryptedScore = decodedValue;
        papers[paperId].reviews[reviewIndex].isDecrypted = true;
        
        emit ScoreDecrypted(paperId, decodedValue);
    }

    function finalizePaper(string calldata paperId) external {
        require(bytes(papers[paperId].title).length > 0, "Paper does not exist");
        require(!papers[paperId].isFinalized, "Paper already finalized");
        require(msg.sender == papers[paperId].editor, "Only editor can finalize");
        
        uint256 totalScore;
        for (uint256 i = 0; i < papers[paperId].reviews.length; i++) {
            require(papers[paperId].reviews[i].isDecrypted, "Not all scores decrypted");
            totalScore += papers[paperId].reviews[i].decryptedScore;
        }
        
        papers[paperId].totalScore = totalScore;
        papers[paperId].isFinalized = true;
        
        emit PaperFinalized(paperId, totalScore);
    }

    function getPaperDetails(string calldata paperId) external view returns (
        string memory title,
        string memory contentHash,
        address editor,
        uint256 submissionTime,
        uint256 totalScore,
        bool isFinalized
    ) {
        require(bytes(papers[paperId].title).length > 0, "Paper does not exist");
        Paper storage paper = papers[paperId];
        
        return (
            paper.title,
            paper.contentHash,
            paper.editor,
            paper.submissionTime,
            paper.totalScore,
            paper.isFinalized
        );
    }

    function getReviewDetails(string calldata paperId, uint256 reviewIndex) external view returns (
        euint32 encryptedScore,
        uint256 publicScore,
        string memory comments,
        address reviewer,
        uint256 timestamp,
        bool isDecrypted,
        uint32 decryptedScore
    ) {
        require(bytes(papers[paperId].title).length > 0, "Paper does not exist");
        require(reviewIndex < papers[paperId].reviews.length, "Invalid review index");
        Review storage review = papers[paperId].reviews[reviewIndex];
        
        return (
            review.encryptedScore,
            review.publicScore,
            review.comments,
            review.reviewer,
            review.timestamp,
            review.isDecrypted,
            review.decryptedScore
        );
    }

    function getReviewCount(string calldata paperId) external view returns (uint256) {
        require(bytes(papers[paperId].title).length > 0, "Paper does not exist");
        return papers[paperId].reviews.length;
    }

    function isAvailable() public pure returns (bool) {
        return true;
    }
}


