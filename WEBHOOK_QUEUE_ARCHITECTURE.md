# 🏗️ Webhook Queue Architecture - Learning Guide

## 📚 Table of Contents
1. [Why We Need Queues](#why-we-need-queues)
2. [How AWS SQS Works](#how-aws-sqs-works)
3. [Architecture Flow](#architecture-flow)
4. [Code Implementation](#code-implementation)
5. [Concurrency & Race Conditions](#concurrency--race-conditions)

---

## 🎯 Why We Need Queues

### Current Problem: Synchronous Processing

When ROOK sends 10-11 webhooks instantly:

```
Webhook 1: Sleep Data    ─┐
Webhook 2: Activity Data ─┤
Webhook 3: Body Data     ─┤─→ All hit MongoDB at same time
Webhook 4: Heart Rate    ─┤
...                      ─┘
```

**What happens:**
1. All webhooks call `User.findById(userId)` simultaneously
2. Each gets a COPY of the user document
3. Each modifies its copy independently
4. Each calls `.save()` - **LAST ONE WINS, others lost!** 💥

### Solution: Queue-Based Processing

```
Webhook 1 ─┐
Webhook 2 ─┤
Webhook 3 ─┤─→ SQS Queue ─→ Worker processes ONE at a time
Webhook 4 ─┤              ─→ No race conditions!
...       ─┘
```

---

## 🌊 How AWS SQS Works

### SQS = Simple Queue Service (Message Buffer)

Think of SQS like a **line at Starbucks**:
- Customers (webhooks) arrive in bursts
- They join a queue (SQS)
- Barista (worker) serves ONE customer at a time
- No one gets their order mixed up!

### Key Concepts:

#### 1. **Producer** (Your webhook endpoint)
```typescript
// Fast operation: Just add message to queue
await sqs.send(new SendMessageCommand({
  QueueUrl: "https://sqs.us-east-1.amazonaws.com/xxx/rook-health-webhooks",
  MessageBody: JSON.stringify(webhookData)
}));
// Returns immediately! No waiting for processing.
```

#### 2. **Queue** (AWS SQS)
```
Messages waiting: [msg1, msg2, msg3, msg4, ...]
                   ↑
                   Worker polls here
```

Properties:
- **Visibility Timeout**: 60s (worker has 60s to process before message becomes visible again)
- **Message Retention**: 4 days (if worker fails, message stays for retry)
- **Dead Letter Queue**: After 3 failed attempts, move to DLQ for manual investigation

#### 3. **Consumer** (Worker process)
```typescript
// Continuously polls SQS
while (true) {
  const messages = await sqs.receiveMessage({ MaxMessages: 1 });
  
  for (const message of messages) {
    await processWebhook(message); // Do the heavy work
    await sqs.deleteMessage(message); // Remove from queue
  }
}
```

---

## 🔄 Architecture Flow

### Step-by-Step Webhook Processing

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ROOK sends webhook                                       │
│    POST /api/webhooks/rook/health-data                      │
│    Body: { user_id, data_structure, physical_health: {...} }│
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Webhook Controller (FAST - <50ms)                        │
│    ✓ Verify HMAC signature                                  │
│    ✓ Store raw payload in MongoDB (rook_raw_webhooks)       │
│    ✓ Send to SQS queue                                      │
│    ✓ Return 200 OK to ROOK immediately                      │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. AWS SQS Queue (Buffer)                                   │
│    Message stored safely, waiting for worker                │
│    Retry if worker fails (automatic!)                       │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Worker Process (SLOW - runs separately)                  │
│    Poll SQS every 1 second                                  │
│    Get ONE message at a time                                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Process Message                                          │
│    • Find user by external_user_id (MongoDB ObjectId)       │
│    • Transform webhook data (extract sleep/activity/body)   │
│    • Atomic MongoDB update (no race conditions!)            │
│    • Clear Redis cache                                      │
│    • Delete message from SQS                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧩 Code Implementation

### 1. Raw Webhook Storage (Immutable Audit Log)

**Why?** Keep original webhook for:
- Debugging (if processing fails, replay it)
- Compliance (audit trail)
- Data recovery (if transformation had a bug)

```typescript
// models/RawWebhook.model.ts
{
  provider: "rook",
  externalUserId: "68da80c9ffda7e51bd9ac167",
  dataStructure: "sleep_summary",
  payload: { /* entire ROOK payload */ },
  receivedAt: ISODate("2025-12-23T10:00:00Z"),
  processed: false,
  processedAt: null,
  error: null
}
```

### 2. SQS Message Format

```json
{
  "provider": "rook",
  "data_structure": "sleep_summary",
  "external_user_id": "68da80c9ffda7e51bd9ac167",
  "raw_webhook_id": "67890abc...",
  "payload": {
    "version": 2,
    "sleep_health": { /* ROOK data */ }
  },
  "receivedAt": "2025-12-23T10:00:00.000Z"
}
```

### 3. Worker Processing Logic

```typescript
// Pseudo-code
async function processMessage(message) {
  const { external_user_id, payload, data_structure, raw_webhook_id } = message;
  
  // 1. Find user
  const user = await User.findById(external_user_id);
  if (!user) {
    // Mark as failed but DON'T delete raw webhook
    await RawWebhook.findByIdAndUpdate(raw_webhook_id, {
      processed: true,
      error: "User not found"
    });
    return;
  }
  
  // 2. Transform data
  const transformed = HealthDataTransformer.transform(payload);
  // transformed = { sleep: {...}, activity: {...}, body: {...} }
  
  // 3. Get data type
  const dataType = getDataType(data_structure);
  // "sleep_summary" → "sleep"
  
  // 4. ATOMIC UPDATE (no race conditions!)
  await User.findByIdAndUpdate(external_user_id, {
    $set: {
      [`wearables.garmin.data.${dataType}`]: transformed[dataType],
      [`wearables.garmin.lastSync`]: new Date(),
      [`wearables.garmin.connected`]: true
    }
  });
  
  // 5. Clear cache
  await redis.del(`wearables:${external_user_id}`);
  
  // 6. Mark as processed
  await RawWebhook.findByIdAndUpdate(raw_webhook_id, {
    processed: true,
    processedAt: new Date()
  });
}
```

---

## ⚡ Concurrency & Race Conditions

### Understanding the Problem

**Bad Code (Race Condition):**
```typescript
// ❌ DON'T DO THIS
const user = await User.findById(userId);  // Read
user.wearables.garmin.data.sleep = newData; // Modify
await user.save();                          // Write

// If 2 webhooks run this simultaneously:
// Webhook 1: Read (gets v1) → Modify sleep → Write (saves v2)
// Webhook 2: Read (gets v1) → Modify activity → Write (saves v3, OVERWRITES sleep!)
```

**Good Code (Atomic Update):**
```typescript
// ✅ DO THIS
await User.findByIdAndUpdate(userId, {
  $set: {
    "wearables.garmin.data.sleep": newData
  }
});

// MongoDB guarantees this happens atomically (all-or-nothing)
// Even if 10 webhooks call this, no data loss!
```

### How MongoDB Handles Atomic Updates

```
MongoDB receives 3 update commands simultaneously:
  Update 1: Set sleep data     ─┐
  Update 2: Set activity data  ─┤─→ MongoDB queues them internally
  Update 3: Set body data      ─┘   Executes ONE at a time

Result: All 3 updates applied correctly, no overwrites!
```

---

## 🎓 Key Takeaways

1. **Webhooks should respond FAST** (<100ms) - Just store and enqueue
2. **Heavy processing happens async** - Worker polls SQS
3. **Always use atomic updates** - No find → modify → save
4. **Keep raw webhooks** - Immutable audit log for replay
5. **SQS handles retries** - No manual retry loops needed

---

## 📊 Performance Benefits

**Before (Synchronous):**
```
Webhook processing time: 500-1000ms per webhook
10 webhooks = 5-10 seconds total
ROOK may timeout and retry!
```

**After (Queue-Based):**
```
Webhook response time: <50ms (just store + enqueue)
10 webhooks = <500ms total (all queued instantly!)
Worker processes them in background (5-10 seconds)
No ROOK timeouts!
```

---

## 🚀 Next Steps

1. Set up AWS SQS queue
2. Implement SQS producer in webhook controller
3. Create worker process
4. Test with ROOK JSON simulator
5. Deploy worker to EC2
6. Monitor CloudWatch metrics

Let's build it! 🛠️
