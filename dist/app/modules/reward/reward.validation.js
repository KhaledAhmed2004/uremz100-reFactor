"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RewardValidation = void 0;
const zod_1 = require("zod");
const claimWatchTimeRewardZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        minutes: zod_1.z.number({ required_error: 'Minutes is required' }).min(1, 'Minimum 1 minute required'),
    }),
});
const claimSocialRewardZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        platform: zod_1.z.enum(['facebook', 'instagram'], { required_error: 'Platform must be facebook or instagram' }),
    }),
});
exports.RewardValidation = {
    claimWatchTimeRewardZodSchema,
    claimSocialRewardZodSchema,
};
