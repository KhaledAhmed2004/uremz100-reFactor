import { Schema } from 'mongoose';

/**
 * A global mongoose plugin that applies to every schema.
 * It ensures that when a mongoose document is serialized to JSON (e.g. by Express res.json),
 * sensitive and internal fields are stripped away globally.
 */
export const toJSONPlugin = (schema: Schema) => {
  schema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
      // 1. Convert _id to id safely
      if (ret._id) {
        ret.id = ret._id;
        delete (ret as any)._id;
      }
      
      // 2. Always remove Mongoose version key
      delete (ret as any).__v;
      
      // 3. Globally strip password from any response
      if (ret.password) {
        delete (ret as any).password;
      }
      
      return ret;
    },
  });
};
