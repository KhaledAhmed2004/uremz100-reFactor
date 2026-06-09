"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Visitor = void 0;
const mongoose_1 = require("mongoose");
const visitorSchema = new mongoose_1.Schema({
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    path: { type: String, required: true },
    referrer: { type: String },
    metadata: { type: mongoose_1.Schema.Types.Mixed },
}, {
    timestamps: true,
});
exports.Visitor = (0, mongoose_1.model)('Visitor', visitorSchema);
