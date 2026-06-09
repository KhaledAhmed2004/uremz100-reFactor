import mongoose from 'mongoose';
import { toJSONPlugin } from './toJSON.plugin';

// This file exists to ensure the mongoose plugin is registered
// BEFORE any models are imported and compiled. Due to ES6 import hoisting,
// we cannot just call mongoose.plugin() in the middle of app.ts imports.
mongoose.plugin(toJSONPlugin);
