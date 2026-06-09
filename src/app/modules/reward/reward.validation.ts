import { z } from 'zod';

const claimWatchTimeRewardZodSchema = z.object({
  body: z.object({
    minutes: z.number({ required_error: 'Minutes is required' }).min(1, 'Minimum 1 minute required'),
  }),
});

const claimSocialRewardZodSchema = z.object({
  body: z.object({
    platform: z.enum(['facebook', 'instagram'], { required_error: 'Platform must be facebook or instagram' }),
  }),
});

export const RewardValidation = {
  claimWatchTimeRewardZodSchema,
  claimSocialRewardZodSchema,
};

