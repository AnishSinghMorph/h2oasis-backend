# 🚀 H2Oasis Backend

[![CI/CD Pipeline](https://github.com/AnishSinghMorph/h2oasis-backend/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/AnishSinghMorph/h2oasis-backend/actions/workflows/ci-cd.yml)
[![Development Pipeline](https://github.com/AnishSinghMorph/h2oasis-backend/actions/workflows/dev-pipeline.yml/badge.svg)](https://github.com/AnishSinghMorph/h2oasis-backend/actions/workflows/dev-pipeline.yml)
[![Dependency Updates](https://github.com/AnishSinghMorph/h2oasis-backend/actions/workflows/dependency-updates.yml/badge.svg)](https://github.com/AnishSinghMorph/h2oasis-backend/actions/workflows/dependency-updates.yml)

Authentication backend for H2Oasis built with Firebase Functions, TypeScript, Express, and MongoDB.

## 🌟 Features

- ✅ **Firebase Authentication** - Google OAuth & Email/Password
- ✅ **MongoDB Integration** - User data persistence
- ✅ **JWT Token Validation** - Secure API endpoints
- ✅ **TypeScript** - Type-safe development
- ✅ **Express.js** - RESTful API framework
- ✅ **CI/CD Pipeline** - Automated testing and deployment

## 🏗️ Architecture

```
src/
├── models/           # MongoDB schemas
├── middleware/       # Authentication middleware
├── services/         # Business logic
└── utils/           # Utilities & configurations
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase CLI
- MongoDB Atlas account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AnishSinghMorph/h2oasis-backend.git
   cd h2oasis-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Fill in your Firebase and MongoDB credentials
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 📡 API Endpoints

### Authentication
- `POST /auth/create-user` - Create new user
- `POST /auth/login` - Email/password login
- `POST /auth/google-signin` - Google OAuth login
- `GET /auth/profile` - Get user profile (protected)

### Health Check
- `GET /health` - System health status

## 🔧 Development

### Available Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm run dev` - Start development server
- `npm run start` - Start production server
- `npm run type-check` - Run TypeScript type checking
- `npm run deploy` - Deploy to Firebase Functions

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_WEB_API_KEY=your-web-api-key
MONGODB_URI=your-mongodb-uri
NODE_ENV=development
```

## 🚀 Deployment

### Automatic Deployment
- **Main Branch**: Automatically deploys to production via GitHub Actions
- **Develop Branch**: Runs validation and testing

### Manual Deployment
```bash
npm run deploy
```

## 🔒 Security

- Firebase service account keys excluded from repository
- Environment variables for sensitive data
- JWT token validation for protected routes
- Automated security audits via CI/CD

## 🧪 Testing

```bash
npm test        # Run tests
npm run test:watch  # Watch mode (when configured)
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Firebase Console](https://console.firebase.google.com/)
- [MongoDB Atlas](https://cloud.mongodb.com/)
- [GitHub Actions](https://github.com/AnishSinghMorph/h2oasis-backend/actions)

---

