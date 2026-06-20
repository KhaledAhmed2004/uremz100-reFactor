import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { User } from './src/app/modules/user/user.model';
import { Subscription } from './src/app/modules/subscription/subscription.model';
import { randomUUID } from 'crypto';
import SubscriptionService from './src/app/modules/subscription/subscription.service';

async function run() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  const regularUser = await User.create({
    name: 'Target User',
    role: 'USER',
    email: `target_${randomUUID()}@test.com`,
    password: 'securePassword123!',
    isVerified: true,
    status: 'ACTIVE',
  });
  
  await Subscription.create({
    userId: regularUser._id.toString(),
    plan: 'PREMIUM',
    status: 'active',
    platform: 'admin',
    productId: 'premium_weekly',
    startedAt: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const query = { searchTerm: 'target_' };
  const res = await SubscriptionService.getAllSubscriptions(query);
  console.log("Response:", JSON.stringify(res, null, 2));

  await mongoose.disconnect();
  await replSet.stop();
}

run().catch(console.error);
