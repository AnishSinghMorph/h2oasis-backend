import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

/**
 * Initialize Sentry for error tracking and performance monitoring
 */
export const initSentry = () => {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn("⚠️  Sentry DSN not configured - error tracking disabled");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",

    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Profiling
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    integrations: [nodeProfilingIntegration()],

    // Filter out sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
        delete event.request.headers["x-firebase-uid"];
      }

      // Remove sensitive environment variables
      if (event.contexts?.runtime?.env) {
        const env = event.contexts.runtime.env as Record<string, any>;
        delete env.FIREBASE_PRIVATE_KEY;
        delete env.ROOK_SANDBOX_SECRET_KEY;
        delete env.ROOK_SECRET_HASH_KEY;
        delete env.OPENAI_API_KEY;
        delete env.ELEVENLABS_API_KEY;
        delete env.AWS_SECRET_ACCESS_KEY;
      }

      return event;
    },
  });

  console.log(`✅ Sentry initialized (${process.env.NODE_ENV})`);
};

export { Sentry };
