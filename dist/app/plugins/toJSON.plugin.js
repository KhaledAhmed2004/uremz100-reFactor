"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toJSONPlugin = void 0;
/**
 * A global mongoose plugin that applies to every schema.
 * It ensures that when a mongoose document is serialized to JSON (e.g. by Express res.json),
 * sensitive and internal fields are stripped away globally.
 */
const toJSONPlugin = (schema) => {
    schema.set('toJSON', {
        transform: (doc, ret) => {
            // 1. Convert _id to id safely
            if (ret._id) {
                ret.id = ret._id;
                delete ret._id;
            }
            // 2. Always remove Mongoose version key
            delete ret.__v;
            // 3. Globally strip password from any response
            if (ret.password) {
                delete ret.password;
            }
            return ret;
        },
    });
};
exports.toJSONPlugin = toJSONPlugin;
