import { z } from 'zod';

const removeBulkZodSchema = z.object({
  body: z.object({
    itemIds: z.array(z.string()).min(1, 'At least one item ID is required'),
  }),
});

export const MyCollectionValidation = {
  removeBulkZodSchema,
};
