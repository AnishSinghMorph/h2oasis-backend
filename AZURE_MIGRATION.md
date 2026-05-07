# H2Oasis Backend — AWS → Azure Migration

> **Purpose**: Track the full migration of H2Oasis backend from AWS to Azure.  
> **Client**: Masco Corporation / Watkins Engineering  
> **Started**: 2026-05-07  
> **Status**: 🟡 In Progress

---

## Azure Environment Details

| Item | Value |
|---|---|
| Portal | https://portal.azure.com |
| Subscription | Watkins Engineering |
| Tenant | Masco Corporation (`a19f8d53-91d3-403c-9b6c`) |
| Region | East US |
| Blob Storage | `stwath2oeusdev001` (container: `media`) |
| App Service Plan | `asp-wat-h2o-eus-dev-001` |
| Web App | `app-wat-h2o-eus-dev-001` |
| Service Bus Namespace | `sbns-wat-h2o-eus-dev-001` |
| Service Bus Queue | `task-queue` |

---

## AWS → Azure Service Mapping

| Purpose | AWS (old) | Azure (new) | Status |
|---|---|---|---|
| File uploads (profile pics) | S3 bucket `h2oasis-user-uploads` + CloudFront CDN | Blob Storage `stwath2oeusdev001` / container `media` | ✅ Code migrated |
| Message queue (webhooks) | SQS `rook-health-webhooks` + DLQ | Service Bus `sbns-wat-h2o-eus-dev-001` / queue `task-queue` | ✅ Code migrated |
| Email sending | SES (Simple Email Service) | TBD — may keep SES or switch to SendGrid/SMTP | ⏳ Pending |
| Server hosting | EC2 instance (manual SSH + PM2) | App Service `app-wat-h2o-eus-dev-001` | ⏳ Pending |
| CDN (image URLs) | CloudFront `d1yw7io8kom5du.cloudfront.net` | Azure Blob direct URL (CDN optional later) | ✅ Code migrated |

---

## Files Changed

### 1. `.env` — Added Azure config placeholders
- **What**: Added `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER_NAME`, `AZURE_SERVICE_BUS_CONNECTION_STRING`, `AZURE_SERVICE_BUS_QUEUE_NAME`
- **Why**: Backend code reads connection details from env vars. User pastes real values from Azure portal.
- **Status**: ✅ Placeholders added, user pasted real values

### 2. `src/utils/s3Upload.ts` — S3 → Azure Blob Storage
- **Before**: Used `@aws-sdk/client-s3` + `multer-s3` to stream uploads directly to S3
- **After**: Uses `@azure/storage-blob` + `multer` memory storage. File goes to RAM buffer first, then uploads to Azure Blob.
- **Exports**: `default` (multer upload middleware), `uploadToAzureBlob()`, `deleteFromAzureBlob()`
- **Status**: ✅ Done

### 3. `src/controllers/profile.controller.ts` — S3 delete + CloudFront URL → Azure Blob
- **Before**: Had its own `S3Client` instance, `DeleteObjectCommand`, and `convertToCloudFrontURL()` helper
- **After**: Imports `uploadToAzureBlob` and `deleteFromAzureBlob` from `s3Upload.ts`. Upload flow: multer receives file in memory → `uploadToAzureBlob(buffer, blobName, contentType)` → returns Azure Blob URL → saved to user profile in MongoDB
- **Status**: ✅ Done

### 4. `src/config/sqs.ts` — AWS SQS → Azure Service Bus
- **Before**: `SQSClient` with `sendToQueue()`, `receiveFromQueue()`, `deleteFromQueue(receiptHandle)`
- **After**: `ServiceBusClient` with `sendToQueue()`, `receiveFromQueue()`, `completeMessage(message)`, `abandonMessage(message)`, `deadLetterMessage(message, reason)`, `closeServiceBus()`
- **Key difference**: SQS uses a `receiptHandle` string to delete messages. Service Bus uses the full message object and has richer operations (complete/abandon/dead-letter).
- **Status**: ✅ Done

### 5. `src/workers/webhook-consumer.worker.ts` — SQS worker → Service Bus worker
- **Before**: Polled SQS, used `deleteFromQueue(message.ReceiptHandle)` on success
- **After**: Polls Service Bus, uses `completeMessage(message)` on success, `abandonMessage(message)` for temporary failures, `deadLetterMessage(message, reason)` for permanent failures. Graceful shutdown now calls `closeServiceBus()`.
- **Status**: ✅ Done

### 6. `package.json` — Added Azure SDK dependencies
- **Added**: `@azure/storage-blob`, `@azure/service-bus`
- **Kept**: AWS SDKs still in package.json (can remove after full migration verified)
- **Status**: ✅ Done

---

## Files NOT Changed (still using AWS or unchanged)

| File | Uses | Notes |
|---|---|---|
| `src/services/email.service.ts` | AWS SES | Still sends email via SES. May keep or switch to Azure Communication Services / SendGrid. Low priority — SES works globally. |
| `src/controllers/webhook.controller.ts` | `sendToQueue()` from `sqs.ts` | Only uses `sendToQueue()` which still works with same signature. Comments still say "SQS" but functionally it calls Service Bus now. |
| `server.ts` | No AWS | No changes needed |
| `Dockerfile` | Node 20 | May need minor tweaks for Azure App Service |

---

## Environment Variables Required on Azure App Service

These need to be set in **Portal → app-wat-h2o-eus-dev-001 → Configuration → Application settings**:

```
# Firebase
FIREBASE_PROJECT_ID=h2oasis-74d5b
FIREBASE_PRIVATE_KEY=<the full private key>
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@h2oasis-74d5b.iam.gserviceaccount.com
FIREBASE_WEB_API_KEY=AIzaSyDN9ZTgkjgLxf19e_bSK21mlwgZNNDBPEs

# MongoDB
MONGODB_URI=mongodb+srv://anish15may:****@h2oasis.pqlwf2q.mongodb.net/h2oasis?retryWrites=true&w=majority&appName=h2oasis

# Environment
NODE_ENV=production

# Sentry
SENTRY_DSN=https://c651673fceaabe057870e1d4ba49e922@o4510578141102080.ingest.us.sentry.io/4510735900934144

# H2Oasis AI
H2OASIS_AI_URL=https://h2oasis.azurewebsites.net/api/h2oasisChat/PostAllCustomGPTAsync
H2OASIS_AI_KEY=SK2a0747eba6abf96b7e123

# ROOK
ROOK_SANDBOX_CLIENT_UUID=a6aed140-6f6b-4650-acee-e61c594c68ce
ROOK_SANDBOX_SECRET_KEY=ywqDeiJeucdn39qKKkIB6vdsdnk5IKihfIjT
ROOK_SANDBOX_BASE_URL=https://api.rook-connect.review
ROOK_SECRET_HASH_KEY=f97f69c9b57dd983f6cad7d97fdec7f8b8a91fd8cfb912c5516279b42aacb796

# OAuth
OAUTH_REDIRECT_URL=<update to new Azure URL after deployment>
WEBHOOK_BASE_URL=<update to new Azure URL after deployment>

# ElevenLabs
ELEVENLABS_API_KEY=sk_7ed7c0af7ed077dc4d09d857f3be5b8dae234e1bb1674aae
ELEVENLABS_VOICE_LENA=Xb7hH8MSUJpSbSDYk0k2
ELEVENLABS_VOICE_ARJUN=pqHfZKP75CvOlQylNhV4
ELEVENLABS_VOICE_SOPHIA=MF3mGyEYCl7XYWbV9V6O
ELEVENLABS_AGENT_ID=agent_5201k5rk7h5yef2bx35b10pfvzj7

# Azure Blob Storage (replaces AWS S3)
AZURE_STORAGE_CONNECTION_STRING=<from portal>
AZURE_STORAGE_CONTAINER_NAME=media

# Azure Service Bus (replaces AWS SQS)
AZURE_SERVICE_BUS_CONNECTION_STRING=<from portal>
AZURE_SERVICE_BUS_QUEUE_NAME=task-queue

# AWS (kept for SES email — can remove after email migration)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<SES key>
AWS_SECRET_ACCESS_KEY=<SES secret>
SES_FROM_EMAIL=anish@getmorph.com
```

---

## Remaining Steps

### Step 1: Local Testing ⬅️ WE ARE HERE
- [ ] Run `npm run dev` locally to verify backend starts without errors
- [ ] Test profile picture upload via Swagger/API docs (`/api-docs`)
- [ ] Verify file appears in Azure Blob container `media`
- [ ] Test webhook queue by sending a test message

### Step 2: Set Azure App Service Environment Variables
- [ ] Go to Portal → `app-wat-h2o-eus-dev-001` → Configuration → Application settings
- [ ] Add all env vars listed above (one by one)
- [ ] Set startup command: `pm2-runtime ecosystem.config.js`

### Step 3: Deploy to Azure App Service
- [ ] Option A: GitHub Actions (auto-deploy on push to main)
- [ ] Option B: ZIP deploy via Azure CLI
- [ ] Option C: Connect to GitHub repo in Deployment Center

### Step 4: Post-Deployment Verification
- [ ] Hit `https://app-wat-h2o-eus-dev-001.azurewebsites.net/health` — should return OK
- [ ] Hit `/api-docs` — Swagger should load
- [ ] Update `WEBHOOK_BASE_URL` and `OAUTH_REDIRECT_URL` to new Azure URL
- [ ] Update frontend `api.ts` to point to new Azure backend URL
- [ ] Test full flow: app → backend → blob storage / service bus

### Step 5: Email Service Decision
- [ ] Decide: Keep AWS SES (works fine globally) OR migrate to Azure Communication Services / SendGrid
- [ ] If migrating, rewrite `src/services/email.service.ts`

### Step 6: Cleanup
- [ ] Remove unused AWS SDK packages from `package.json` (after email decision)
- [ ] Remove old AWS env vars from `.env`
- [ ] Update `CORS_ORIGINS` for production Azure URL

---

## Architecture Diagram

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│  React Native   │     │  Azure App Service (PM2)             │
│  Mobile App     │────▶│  ┌────────────┐  ┌────────────────┐  │
│  (Expo)         │     │  │ API Server │  │ Webhook Worker │  │
└─────────────────┘     │  │ (port 3000)│  │ (polls queue)  │  │
                        │  └─────┬──────┘  └───────┬────────┘  │
                        └────────┼─────────────────┼───────────┘
                                 │                 │
                    ┌────────────┼─────────────────┼────────────┐
                    │            ▼                 ▼            │
                    │  ┌─────────────────┐ ┌──────────────────┐ │
                    │  │ Azure Blob      │ │ Azure Service    │ │
                    │  │ Storage         │ │ Bus Queue        │ │
                    │  │ (profile pics)  │ │ (webhook msgs)   │ │
                    │  └─────────────────┘ └──────────────────┘ │
                    │         Azure East US                      │
                    └───────────────────────────────────────────┘
                                 │
                                 ▼
                        ┌────────────────┐
                        │ MongoDB Atlas  │
                        │ (database)     │
                        └────────────────┘
```
