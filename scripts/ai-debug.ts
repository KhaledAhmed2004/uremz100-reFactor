import mongoose from 'mongoose';
import config from '../src/config';
import { redisClient } from '../src/shared/redisClient';

/**
 * ==========================================================
 * 🤖 AI-DEBUG PLAYGROUND
 * ==========================================================
 * Use this file for fast, on-the-fly debugging, data querying, 
 * or logic testing. This script automatically connects to 
 * MongoDB and Redis so the AI doesn't have to write boilerplate.
 * 
 * Run using: npm run ai:debug
 */

const main = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(config.database_url as string);
    console.log('✅ MongoDB connected!');

    // ==========================================
    // ✍️ WRITE YOUR DEBUGGING LOGIC BELOW THIS
    // ==========================================

    const { Content } = await import('../src/app/modules/content/content.model');
    const freeMovie = await Content.findOne({ 
      status: 'PUBLISHED', 
      planStatus: 'FREE' 
    });
    
    if (freeMovie) {
      console.log('🎉 Found a FREE Content!');
      console.log('Title:', freeMovie.title);
      console.log('ID:', freeMovie._id.toString());
    } else {
      console.log('No free content found.');
    }

  } catch (error) {
    console.error('❌ Error during AI debug session:', error);
  } finally {
    console.log('🧹 Cleaning up connections...');
    await mongoose.disconnect();
    redisClient.quit();
    process.exit(0);
  }
};

main();
