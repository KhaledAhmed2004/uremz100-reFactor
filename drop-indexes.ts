import mongoose from 'mongoose';
import config from './src/config';
import { Wallet, UserRewardProgress } from './src/app/modules/reward/reward.model';

const dropIndexes = async () => {
  try {
    await mongoose.connect(config.database_url as string);
    console.log('Connected to DB');
    
    // Drop the problematic index
    await Wallet.collection.dropIndex('user_1').catch(e => console.log('Wallet user_1 not found or already dropped'));
    await UserRewardProgress.collection.dropIndex('user_1').catch(e => console.log('UserRewardProgress user_1 not found or already dropped'));
    
    // Sync to create the new correct sparse indexes
    await Wallet.syncIndexes();
    await UserRewardProgress.syncIndexes();
    console.log('Indexes synced successfully');
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
dropIndexes();
