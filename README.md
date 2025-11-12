# Confidential Scholarly Peer Review

Confidential Scholarly Peer Review is a privacy-preserving application powered by Zama's Fully Homomorphic Encryption (FHE) technology. This project aims to revolutionize the academic peer review process by ensuring that reviewers can submit their feedback without exposing their identities or personal biases, thus enhancing fairness and objectivity in academic publishing.

## The Problem

In the traditional academic peer review process, cleartext data can lead to significant concerns regarding privacy and bias. Reviewers may unknowingly allow their identities or personal opinions to influence their assessments, resulting in favoritism or unequal treatment of submissions. Furthermore, the visibility of comments and scores can create an environment where reviewers feel pressured to conform to prevailing opinions, potentially stifling innovation and diversity in research.

The risks associated with cleartext data in this context are profound. Personal biases can skew results, leading to unfair rejections or approvals based on favoritism rather than the quality of the work. Moreover, the lack of anonymity often discourages honest feedback, which is crucial for authors to improve their submissions.

## The Zama FHE Solution

Zama's FHE technology provides a powerful solution to these privacy and security challenges. By enabling computations on encrypted data, FHE allows the peer review process to maintain confidentiality while still facilitating the necessary analyses and evaluations.

Using Zama’s libraries, the Confidential Scholarly Peer Review application encrypts both the content of reviewer comments and the scores they assign. This ensures that editors see only aggregated and anonymized results, eliminating the potential for bias. Reviewers can submit their feedback securely, knowing their identities and opinions are protected, fostering an environment of transparent and fair evaluation.

## Key Features

- 🔒 **Encrypted Review Feedback:** All reviewer comments and scores are encrypted, ensuring confidentiality.
- ⚖️ **Double-Blind Mechanism:** Reviewers and authors remain anonymous to each other, promoting unbiased evaluations.
- 📊 **Homomorphic Statistics:** Utilizing FHE, we can perform statistical analysis on encrypted scores, maintaining privacy.
- 🏆 **Fairness in Academic Publishing:** Encourages objective feedback while preventing personal biases from influencing the review process.

## Technical Architecture & Stack

The architecture of the Confidential Scholarly Peer Review application is designed to leverage Zama's privacy-preserving capabilities. The core technology stack includes:

- **Backend Framework:** Node.js
- **Database:** PostgreSQL
- **Privacy Layer:** Zama's FHE (using Concrete ML for data processing)
- **Frontend Framework:** React
- **Encryption Library:** Concrete ML

With Zama's technology at the heart of the system, we ensure that all data handling processes prioritize user privacy and data integrity.

## Smart Contract / Core Logic

Here's a simplified pseudo-code snippet illustrating how the application could leverage Zama's technology to manage encrypted peer review data:

```solidity
// Confidential Scholarly Peer Review Solidity Contract

pragma solidity ^0.8.0;

import "ConcreteML.sol";

contract PeerReview {

    struct Review {
        uint64 score; // Encrypted score
        bytes32 encryptedComment; // Encrypted reviewer comment
    }

    mapping(address => Review) public reviews;

    function submitReview(uint64 score, string memory comment) public {
        bytes32 encryptedComment = Concrete.encrypt(comment);
        reviews[msg.sender] = Review(score, encryptedComment);
    }

    function aggregateScores() public view returns (uint64) {
        // Logic to aggregate encrypted scores using FHE
        uint64 totalScore = 0;
        // ... Aggregate logic here
        return totalScore;
    }
}
```

This Solidity code demonstrates how a smart contract could handle encrypted scores and comments, utilizing Zama’s Concrete library for encryption.

## Directory Structure

Below is the structure of the Confidential Scholarly Peer Review application:

```
ConfidentialScholarlyPeerReview/
├── src/
│   ├── components/
│   ├── pages/
│   └── App.js
├── contracts/
│   └── PeerReview.sol
├── scripts/
│   ├── submitReview.py
│   └── aggregateScores.py
├── package.json
└── README.md
```

This structure is designed to keep the code organized, with separate directories for components, contracts, and scripts.

## Installation & Setup

To get started with the Confidential Scholarly Peer Review application, please follow these installation steps:

### Prerequisites

- Node.js (recommended version)
- Python (recommended version)
- PostgreSQL database

### Installation Steps

1. **Install Dependencies for the Backend:**
   Run the following command to install the necessary dependencies:
   ```
   npm install
   ```
   Ensure that you have the Zama library installed:
   ```
   npm install concrete-ml
   ```

2. **Install Dependencies for the Scripts:**
   For the Python scripts, you’ll need to install the required packages:
   ```
   pip install concrete-ml
   ```

## Build & Run

After completing the installation, you can build and run the application as follows:

- To compile the smart contract, use:
  ```
  npx hardhat compile
  ```

- To run the Python script for peer review submissions, execute:
  ```
  python submitReview.py
  ```

- To start the frontend application, run:
  ```
  npm start
  ```

## Acknowledgements

We would like to express our gratitude to Zama for providing the open-source FHE primitives that make this project possible. Their commitment to advancing privacy-preserving technology has been instrumental in the development of the Confidential Scholarly Peer Review application.

Through collaboration with Zama's innovative team and the utilization of their powerful libraries, we are able to present a groundbreaking solution to enhance the integrity and confidentiality of scholarly peer reviews.


