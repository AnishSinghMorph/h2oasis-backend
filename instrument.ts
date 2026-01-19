// Load environment variables FIRST
import dotenv from "dotenv";
dotenv.config();

import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const sentryDsn = process.env.SENTRY_DSN;

if (!sentryDsn) {
  console.warn(
    "⚠️ SENTRY_DSN not found in environment variables. Sentry will not be initialized.",
  );
} else {
  console.log(
    "🔧 Initializing Sentry with DSN:",
    sentryDsn.substring(0, 20) + "...",
  );

  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || "development",

    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of transactions in production you may want to lower this

    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,

    // Send default PII (IP address, user info)
    sendDefaultPii: true,

    integrations: [nodeProfilingIntegration()],
  });

  console.log("✅ Sentry initialized successfully");
}
