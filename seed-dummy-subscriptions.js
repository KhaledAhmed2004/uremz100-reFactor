const path = require('path');
require('ts-node').register({ project: path.join(__dirname, 'tsconfig.json'), transpileOnly: true });
require('dotenv').config();

const mongoose = require('mongoose');
const { Subscription } = require('./src/app/modules/subscription/subscription.model');
const { User } = require('./src/app/modules/user/user.model');

async function seed() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('Connected to DB');

    const user = await User.findOne();
    if(user) {
      await Subscription.create({ 
        userId: user._id, 
        plan: 'PREMIUM', 
        status: 'active', 
        platform: 'apple', 
        productId: 'premium_weekly', 
        appleOriginalTransactionId: 'TRX-APPLE-USER-1234',
        startedAt: new Date(), 
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) 
      });
      console.log('Created User Subscription for', user.email);
    } else {
      console.log('No user found in DB to link subscription to.');
    }

    await Subscription.create({ 
      guestId: 'guest-' + Math.random().toString(36).substring(7), 
      plan: 'PREMIUM', 
      status: 'active', 
      platform: 'google', 
      productId: 'premium_monthly', 
      googleOrderId: 'GPA.1234-5678-9012-34567', 
      startedAt: new Date(), 
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) 
    });
    console.log('Created Guest Subscription');

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from DB');
  }
}

seed();
