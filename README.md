# DebtFree Backend ⚙️
> The Node.js API powering the DebtFree social finance platform.

DebtFree is a comprehensive social finance application that manages group expenses, community savings circles (Ajo/Esusu), and peer-to-peer emergency pots. This repository contains the backend infrastructure that handles payments, identity verification, complex notifications, and automated recurring jobs.

## 🌟 Core Services

*   **Payment Orchestration (Paystack):** 
    *   Creates and verifies Wallet funding transactions.
    *   Generates Payment Links and coordinates Auto-Debits for savings circles.
    *   Processes peer-to-peer debt settlements and local bank withdrawals.
*   **Identity & Compliance (KYC):**
    *   Integrates with Dojah/Identity APIs to verify User Bank Verification Numbers (BVN) and National Identity Numbers (NIN).
    *   Ensures all users are verified before participating in financial pools.
*   **Notification Engine:**
    *   **Twilio WhatsApp & SMS:** Instantly pushes alerts for emergency loan requests, loan approvals, and critical payment reminders directly to user phones.
    *   **Resend Emails:** Compiles and dispatches beautifully designed Weekly Financial Summaries containing AI-driven insights and debt balances.
*   **Job Scheduling (Cron Jobs):** 
    *   Runs automated checks on Savings Circle (Ajo) cycles to process payouts.
    *   Triggers automated weekly emails for user balances.

## 🛠 Tech Stack

*   **Runtime:** Node.js
*   **Framework:** Express.js
*   **Database Client:** Supabase JavaScript Client (`@supabase/supabase-js`)
*   **External APIs:**
    *   Paystack API (Payments & Auto-debits)
    *   Twilio API (WhatsApp & SMS messaging)
    *   Resend API (Transactional & Batch Emails)

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   NPM or Yarn
*   A Supabase project (for database and auth)
*   Paystack Secret Key
*   Twilio Account SID, Auth Token, and WhatsApp Number
*   Resend API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AmooAyomikun/debtfree-backend.git
   cd debtfree-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_KEY=your_supabase_service_role_key
   
   PAYSTACK_SECRET_KEY=your_paystack_secret_key
   
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_token
   TWILIO_WHATSAPP_NUMBER=your_twilio_whatsapp_number
   
   RESEND_API_KEY=your_resend_api_key
   
   FRONTEND_URL=your_frontend_url (e.g. https://debt-free-six.vercel.app)
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

## 📂 Project Structure
```text
src/
├── controllers/    # Request handlers (balance, email, group, payment, twilio)
├── routes/         # Express router definitions
├── services/       # Core business logic (paystack service, notification service)
├── index.js        # Express app configuration and server start
```

## 🤝 Contributing
Contributions, issues, and feature requests are welcome!

## 📄 License
This project is licensed under the MIT License.
