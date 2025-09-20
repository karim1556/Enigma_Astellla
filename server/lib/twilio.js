import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
let twilioClient = null;

export function getTwilio() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) return null;
  if (!twilioClient) {
    try {
      const twilio = require('twilio');
      twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    } catch (e) {
      return null;
    }
  }
  return twilioClient;
}

export function getTwilioFromNumber() {
  return TWILIO_FROM_NUMBER || null;
}
