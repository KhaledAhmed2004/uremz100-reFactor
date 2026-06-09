"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRewardProgress = exports.Transaction = exports.Wallet = void 0;
const mongoose_1 = require("mongoose");
const reward_interface_1 = require("./reward.interface");
const bonusLedgerSchema = new mongoose_1.Schema({
    amount: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    source: { type: String, required: true },
}, { _id: false });
const walletSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    goldBalance: { type: Number, required: true, default: 0 },
    bonusLedger: { type: [bonusLedgerSchema], default: [] },
}, {
    timestamps: true,
});
exports.Wallet = (0, mongoose_1.model)('Wallet', walletSchema);
const transactionSchema = new mongoose_1.Schema({
    wallet: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Wallet', required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: Object.values(reward_interface_1.TransactionType), required: true },
    currencyType: { type: String, enum: Object.values(reward_interface_1.CurrencyType), required: true },
    source: { type: String, enum: Object.values(reward_interface_1.TransactionSource), required: true },
    description: { type: String },
}, {
    timestamps: true,
});
exports.Transaction = (0, mongoose_1.model)('Transaction', transactionSchema);
const userRewardProgressSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    dailyStreak: { type: Number, default: 0 },
    lastCheckInDate: { type: Date },
    adsWatchedToday: { type: Number, default: 0 },
    lastAdWatchDate: { type: Date },
    watchTimeMilestonesClaimed: { type: [Number], default: [] },
    hasClaimedNotificationReward: { type: Boolean, default: false },
    hasClaimedProfileReward: { type: Boolean, default: false },
    hasClaimedFacebookReward: { type: Boolean, default: false },
    hasClaimedInstagramReward: { type: Boolean, default: false },
    hasClaimedBindEmailReward: { type: Boolean, default: false },
    hasClaimedLoginReward: { type: Boolean, default: false },
    freshDramaWatchTimeClaimed: { type: [Number], default: [] },
}, {
    timestamps: true,
});
exports.UserRewardProgress = (0, mongoose_1.model)('UserRewardProgress', userRewardProgressSchema);
