import { z } from 'zod';

const claimWatchTimeRewardZodSchema = z.object({
  body: z.object({
    videoDuration: z.number({ required_error: 'videoDuration is required' }).min(0, 'ভিডিও ডুরেশন ধনাত্মক হতে হবে।'),
  }),
});

const claimTaskZodSchema = z.object({
  body: z.object({
    taskType: z.enum(
      ['LOGIN', 'NOTIFICATION', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE', 'BIND_EMAIL', 'PROFILE_COMPLETION', 'WATCH_AD'],
      { required_error: 'taskType is required and must be a valid task type' }
    ),
  }),
});

export const RewardValidation = {
  claimWatchTimeRewardZodSchema,
  claimTaskZodSchema,
};

