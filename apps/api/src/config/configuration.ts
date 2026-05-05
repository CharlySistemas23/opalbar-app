// ─────────────────────────────────────────────
//  Configuration factory — loaded via @nestjs/config
// ─────────────────────────────────────────────

export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  appName: process.env.APP_NAME || 'opalbar-api',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:8081',
  apiPrefix: process.env.API_PREFIX || 'api/v1',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    // 1h access / 30d refresh: refresh rotation + Redis blocklist handle revocation.
    // Audit 2026-05-05 reduced from 4h/90d (token-theft window minimization).
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  otp: {
    length: parseInt(process.env.OTP_LENGTH || '6', 10),
    expiresMinutes: parseInt(process.env.OTP_EXPIRES_MINUTES || '10', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
  },

  email: {
    // Resend (preferido). Si RESEND_API_KEY está presente, OtpService lo usa.
    // Si no, hace fallback al transporte SMTP de Gmail.
    resendApiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM || 'OPAL BAR <onboarding@resend.dev>',
    replyTo: process.env.EMAIL_REPLY_TO || 'carlosalonsog966@gmail.com',
    // SMTP fallback (legacy)
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID,
    verifyLocale: process.env.TWILIO_VERIFY_LOCALE || 'es',
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT,
  },

  fcm: {
    serverKey: process.env.FCM_SERVER_KEY,
  },

  apns: {
    keyId: process.env.APNS_KEY_ID,
    teamId: process.env.APNS_TEAM_ID,
    keyPath: process.env.APNS_KEY_PATH,
    bundleId: process.env.APNS_BUNDLE_ID,
  },

  sentry: {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || 'development',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.2'),
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
    auth: {
      ttl: parseInt(process.env.THROTTLE_AUTH_TTL || '60', 10),
      limit: parseInt(process.env.THROTTLE_AUTH_LIMIT || '10', 10),
    },
    otp: {
      ttl: parseInt(process.env.THROTTLE_OTP_TTL || '300', 10),
      limit: parseInt(process.env.THROTTLE_OTP_LIMIT || '3', 10),
    },
  },

  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  },

  gdpr: {
    retentionDays: parseInt(process.env.DATA_RETENTION_DAYS || '730', 10),
    deletionDelayDays: parseInt(process.env.GDPR_DELETION_DELAY_DAYS || '30', 10),
  },
});
