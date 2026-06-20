"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevenueTransaction = void 0;
const mongoose_1 = require("mongoose");
const revenue_interface_1 = require("./revenue.interface");
const revenueTransactionSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trxId: { type: String, required: true, unique: true, index: true },
    coinAmount: { type: Number, required: true, default: 0 },
    subscriptionAmount: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    currency: { type: String, required: true, default: 'USD' },
    platform: { type: String, enum: Object.values(revenue_interface_1.REVENUE_PLATFORM), required: true },
    status: { type: String, enum: Object.values(revenue_interface_1.REVENUE_STATUS), required: true, default: revenue_interface_1.REVENUE_STATUS.SUCCESS },
    metadata: { type: mongoose_1.Schema.Types.Mixed },
}, {
    timestamps: true,
});
// Indexes for revenue calculations over time
revenueTransactionSchema.index({ createdAt: -1 });
revenueTransactionSchema.index({ status: 1, createdAt: -1 });
exports.RevenueTransaction = (0, mongoose_1.model)('RevenueTransaction', revenueTransactionSchema);
