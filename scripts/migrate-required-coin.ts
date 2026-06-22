import mongoose from 'mongoose';
import config from '../src/config';
import { Content } from '../src/app/modules/content/content.model';
import { logger } from '../src/shared/logger';

async function migrate() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.database_url as string);
    console.log('Database connected successfully.');

    console.log('Starting migration for requiredCoin...');
    const result = await Content.updateMany(
      { requiredCoin: { $exists: false } },
      { $set: { requiredCoin: 0 } }
    );

    console.log(`Migration completed successfully!`);
    console.log(`Matched documents: ${result.matchedCount}`);
    console.log(`Modified documents: ${result.modifiedCount}`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.');
    process.exit(0);
  }
}

migrate();
