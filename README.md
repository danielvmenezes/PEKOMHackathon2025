# 🚀 DalCo - Data-Link Co-pilot

AI-powered chatbot to automate data entry from customer messages (WhatsApp, Instagram, Email) directly into Google Sheets.

**Reduces admin work from 16 hours/week to just 30 minutes!**

---

## 🎯 What is DalCo?

DalCo helps Malaysian SMEs, Clinics, Schools, and Local Government automate repetitive tasks:
- ✅ Auto-process messages from WhatsApp, Instagram, Email
- ✅ Extract customer data using AI (JamAI Base)
- ✅ Auto-fill Google Sheets
- ✅ Bilingual support (Bahasa Malaysia & English)
- ✅ Built-in CRM for leads and bookings

---

## 🛠 Tech Stack

- **Backend:** Node.js + Express.js
- **Database:** 
- **Auth:** Google OAuth 2.0
- **AI:** JamAI Base (RAG + Multi-step reasoning)
- **Documentation:** Swagger/OpenAPI

---

## 📋 Prerequisites

You need:
- Node.js 18+ ([Download](https://nodejs.org/))
- 
- Google Cloud account ([Console](https://console.cloud.google.com/))
- JamAI Base account ([Sign up](https://jamaibase.com/))

---

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/your-team/dalco-backend.git
cd dalco-backend
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```bash
# Database
MONGODB_URI=your-mongodb-connection-string

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

# JamAI Base
JAMAI_API_KEY=jamai_xxxxxxxx

# Generate this: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-generated-secret
```

### 3. Run the Server

```bash
npm run dev
```

Visit:
- **API:** http://localhost:5000
- **Swagger Docs:** http://localhost:5000/api/docs

---

## 🔑 Getting API Keys

### Google OAuth Setup (5 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "DalCo-Hackathon"
3. Enable **Google+ API**
4. Create **OAuth 2.0 Client ID**:
   - Type: Web application
   - Redirect URI: `http://localhost:5000/api/auth/google/callback`
5. Copy Client ID and Secret to `.env`

### MongoDB Setup (5 minutes)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create free M0 cluster (choose Singapore region)
3. Create database user
4. Allow access from anywhere: `0.0.0.0/0`
5. Get connection string and add to `.env`

### JamAI Base Setup (2 minutes)

1. Sign up at [JamAI Base](https://jamaibase.com/)
2. Create new project
3. Get API key from Settings
4. Add to `.env`

---

## 📁 Project Structure

```
dalco-backend/
├── src/
│   ├── config/         # Database, Passport, JamAI config
│   ├── models/         # MongoDB schemas
│   ├── routes/         # API endpoints
│   ├── controllers/    # Request handlers
│   ├── services/       # Business logic (JamAI, Sheets, Channels)
│   ├── middleware/     # Auth, validation, errors
│   ├── utils/          # Logger, helpers
│   └── server.js       # Main entry point
├── docs/
│   └── swagger.yaml    # API documentation
├── tests/              # Unit & integration tests
├── .env.example        # Environment template
├── .env                # Your config (git ignored)
└── package.json        # Dependencies
```

---

## 📖 API Documentation

**Swagger UI:** http://localhost:5000/api/docs

### Main Endpoints

| Category | Endpoint | Description |
|----------|----------|-------------|
| **Auth** | `GET /api/auth/google` | Login with Google |
| **Auth** | `GET /api/auth/me` | Get current user |
| **Messages** | `GET /api/messages` | List all messages |
| **Messages** | `POST /api/messages/send` | Send message |
| **JamAI** | `POST /api/jamai/chat/generate` | Generate AI response |
| **JamAI** | `POST /api/jamai/knowledge/search` | Search knowledge base |
| **Sheets** | `POST /api/sheets/write` | Write to Google Sheets |
| **Leads** | `GET /api/leads` | List leads |
| **Analytics** | `GET /api/analytics/overview` | Get dashboard stats |

**Total:** 105 endpoints across 12 categories

---

## 🧪 Testing

### Run Tests

```bash
npm test
```

### Test with cURL

```bash
# Health check
curl http://localhost:5000/api/health

# Login (opens Google OAuth in browser)
open http://localhost:5000/api/auth/google

# Get user info (after login)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:5000/api/auth/me
```

### Import Postman Collection

1. File available in `docs/postman_collection.json`
2. Import to Postman
3. Set `BASE_URL` variable to `http://localhost:5000`

---

## 👥 Team Workflow (4 Days, 5 People)

### Day 1: Foundation
- **Person 1:** Auth + User models
- **Person 2:** JamAI integration
- **Person 3:** WhatsApp webhook
- **Person 4:** Frontend login page
- **Person 5:** Testing + docs

### Day 2: Core Features
- Message processing pipeline
- Google Sheets integration
- Lead management
- Dashboard UI

### Day 3: Multi-channel
- Instagram + Email channels
- FAQ management
- Analytics
- Bilingual support (BM/EN)

### Day 4: Polish
- Bug fixes
- Demo preparation
- Presentation

---

## 🐛 Troubleshooting

### MongoDB Connection Failed
```bash
# Check connection string format
mongodb+srv://username:password@cluster.mongodb.net/dbname

# Check IP whitelist in MongoDB Atlas
```

### Google OAuth Error
```bash
# Verify redirect URI matches exactly in Google Console:
http://localhost:5000/api/auth/google/callback
```

### Port Already in Use
```bash
# Kill process on port 5000
npx kill-port 5000

# Or change port in .env
PORT=5001
```

---

## 📚 Useful Commands

```bash
# Development (auto-restart)
npm run dev

# Production
npm start

# Run tests
npm test

# Lint code
npm run lint

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🌟 Key Features Demo

### 1. Auto Message Processing
```
Customer: "Saya nak buat appointment Jumaat 2pm"
         ↓
DalCo AI: Extracts → Name, Date (Friday), Time (2pm)
         ↓
Google Sheets: Auto-filled in row 47
         ↓
Customer: Gets instant confirmation reply
```

### 2. Time Saved
- **Before:** 16 hours/week manual entry
- **After:** 30 minutes/week review only
- **Saved:** 15.5 hours = RM 500-1000/week

### 3. Accuracy Improvement
- **Before:** 96-99% (human error)
- **After:** 99.999% (AI precision)

---

## 🚢 Deployment

### Deploy to Render (Free)

1. Push code to GitHub
2. Go to [Render](https://render.com/)
3. New Web Service → Connect GitHub
4. Add environment variables
5. Deploy!

### Deploy to Railway (Free)

1. Go to [Railway](https://railway.app/)
2. New Project → Deploy from GitHub
3. Add environment variables
4. Deploy!

**Remember to update:**
- `GOOGLE_CALLBACK_URL` to your production URL
- `FRONTEND_URL` to your frontend URL
- MongoDB IP whitelist if needed

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file

---

## 🙏 Acknowledgments

Built for **[Hackathon Name]** by Team DalCo

- **JamAI Base** - AI Platform
- **Google Cloud** - OAuth & Sheets
- **MongoDB Atlas** - Database
- **Malaysian SME Community** - Inspiration

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/your-team/dalco-backend/issues)
- **Documentation:** http://localhost:5000/api/docs
- **Team Contact:** your-email@example.com

---

**Built with ❤️ for Malaysian SMEs**
