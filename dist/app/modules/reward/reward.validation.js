"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RewardValidation = void 0;
const zod_1 = require("zod");
const claimWatchTimeRewardZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        videoDuration: zod_1.z.number({ required_error: 'videoDuration is required' }).min(0, 'ভিডিও ডুরেশন ধনাত্মক হতে হবে।'),
    }),
});
const claimTaskZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        taskType: zod_1.z.enum(['LOGIN', 'NOTIFICATION', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE', 'BIND_EMAIL', 'PROFILE_COMPLETION', 'WATCH_AD'], { required_error: 'taskType is required and must be a valid task type' }),
    }),
});
exports.RewardValidation = {
    claimWatchTimeRewardZodSchema,
    claimTaskZodSchema,
};
