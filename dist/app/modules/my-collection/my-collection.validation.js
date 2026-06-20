"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyCollectionValidation = void 0;
const zod_1 = require("zod");
const removeBulkZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        itemIds: zod_1.z.array(zod_1.z.string()).min(1, 'At least one item ID is required'),
    }),
});
exports.MyCollectionValidation = {
    removeBulkZodSchema,
};
