"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const toJSON_plugin_1 = require("./toJSON.plugin");
// This file exists to ensure the mongoose plugin is registered
// BEFORE any models are imported and compiled. Due to ES6 import hoisting,
// we cannot just call mongoose.plugin() in the middle of app.ts imports.
mongoose_1.default.plugin(toJSON_plugin_1.toJSONPlugin);
