// index.js
import 'dotenv/config';
import { connectToWhatsApp } from './src/services/whatsappGateway.js';

console.log("🚀 Starting Assist AI...");

// Boot up the WhatsApp Gateway
connectToWhatsApp();