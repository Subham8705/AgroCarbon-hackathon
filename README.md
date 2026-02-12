# AgroCarbon (Carbon Cycle Connect) 🌍🌱

AgroCarbon is a comprehensive platform designed to bridge the gap between sustainable farming practices and the voluntary carbon market. It empowers farmers to monetize their regenerative agriculture efforts by estimating, verifying, and trading carbon credits with environmentally conscious companies.

## 🚀 About the Project
    
This application acts as a digital ecosystem connecting four key stakeholders:
1.  **Farmers:** Who implement sustainable practices (like no-till, cover cropping, agroforestry).
2.  **Verifiers:** Who validate the data and practices on the ground.
3.  **Registry:** The central authority that issues valid carbon credits.
4.  **Companies:** Who purchase these credits to offset their carbon footprint.

## ♻️ How It Works: The Carbon Credit Cycle

1.  **Estimation:** Farmers map their land and input their agricultural practices. The system assumes a carbon sequestration potential based on environmental data (SOC, NDVI, Rainfall) and practice impact.
2.  **Verification:** Independent verifiers review the farmer's claims and data.
3.  **Issuance:** The Registry approves valid claims and mints Carbon Credits.
4.  **Trading:** Companies browse available credits and purchase them directly from the source.

## ✨ Key Features by Role

### 👨‍🌾 For Farmers
-   **Interactive Map Dashboard:** Draw farm boundaries using satellite imagery to register land.
-   **Carbon Estimator:** Calculate potential carbon credits based on:
    -   Tillage Practice (Ploughing vs. No-Till)
    -   Cover Cropping
    -   Tree Planting (Agroforestry)
    -   Land Size (Acres)
-   **Environmental Data:** Auto-fetched data for Soil Organic Carbon (SOC), NDVI (Vegetation Index), and Rainfall.
-   **Project Tracking:** Monitor the status of verification and credit issuance.

### 🏢 For Companies
-   **Marketplace:** Browse verified farmers and carbon projects.
-   **Transparency:** View detailed environmental impact data before purchasing.
-   **Portfolio Management:** Track purchased batches and offsets.

### 🕵️ For Verifiers
-   **Verification Dashboard:** Receive and review verification requests.
-   **Data Validation:** Cross-reference farmer inputs with satellite and ground data.
-   **Approval Workflow:** Approve or reject projects for the Registry.

### 🏛️ For Registry
-   **Issuance Control:** Final authority to mint and issue standardized Carbon Credits.
-   **Ledger:** Maintain a secure record of all issued and retired credits to prevent double-counting.

## 🛠️ Technology Stack

-   **Frontend:** React (Vite), TypeScript
-   **Styling:** Tailwind CSS, Shadcn UI
-   **Mapping:** React-Leaflet, OpenStreetMap, Leaflet.draw
-   **Backend:** Python
-   **Database:** Firebase (Firestore)
-   **Icons:** Lucide React

## 📦 Getting Started

### Prerequisites
-   Node.js & npm installed
-   Python installed (for backend)

### Installation

1.  **Clone the repository**
    ```sh
    git clone <repository-url>
    cd carbon-cycle-connect
    ```

2.  **Install Frontend Dependencies**
    ```sh
    npm install
    ```

3.  **Run Development Server**
    ```sh
    npm run dev
    ```

4.  **Backend Setup (If applicable locally)**
    ```sh
    cd backend
    pip install -r requirements.txt
    python main.py
    ```

## 🌍 Impact

AgroCarbon aims to promote **Regenerative Agriculture** by making it financially viable for farmers. By sequestering carbon in the soil, we not only fight climate change but also improve soil health, water retention, and biodiversity.
