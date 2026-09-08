import 'dotenv/config';

const required = ['MONGODB_URI', 'JWT_SECRET'];
if (process.env.NODE_ENV === 'production') {
  required.forEach((key) => { if (!process.env[key]) throw new Error(`Missing ${key}`); });
}

export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kra',
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN || '',
  cloudflareImagesHash: process.env.CLOUDFLARE_IMAGES_HASH || '',
  twilioStatusCallbackUrl: process.env.TWILIO_STATUS_CALLBACK_URL || ''
};
