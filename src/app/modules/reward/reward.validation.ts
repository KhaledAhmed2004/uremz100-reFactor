import { z } from 'zod';

const claimWatchTimeRewardZodSchema = z.object({
  body: z.object({
    videoDuration: z.number({ required_error: 'videoDuration is required' }).min(0, 'ভিডিও ডুরেশন ধনাত্মক হতে হবে।'),
  }),
});

const claimSocialRewardZodSchema = z.object({
  body: z.object({
    platform: z.enum(['facebook', 'instagram', 'youtube'], { required_error: 'Platform must be facebook, instagram or youtube' }),
  }),
});

export const RewardValidation = {
  claimWatchTimeRewardZodSchema,
  claimSocialRewardZodSchema,
};

