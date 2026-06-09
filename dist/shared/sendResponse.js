"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Helper to recursively transform keys to camelCase and alias _id to id
const snakeToCamel = (str) => str.replace(/(_\w)/g, m => m[1].toUpperCase());
const formatData = (obj, seen = new WeakSet()) => {
    if (obj === null ||
        typeof obj !== 'object' ||
        obj instanceof Date ||
        obj instanceof Buffer) {
        return obj;
    }
    // Handle circular references
    if (seen.has(obj)) {
        return undefined;
    }
    // Add original object to seen set BEFORE any transforms to prevent infinite recursion
    // on circular Mongoose documents (e.g. populated virtuals)
    seen.add(obj);
    // Handle Mongoose documents/Objects
    // We only target Mongoose documents (which always have .toObject())
    // We prefer toJSON() over toObject() so that global plugins (like hiding password, __v) are respected
    if (typeof obj.toObject === 'function') {
        obj = typeof obj.toJSON === 'function' ? obj.toJSON() : obj.toObject();
        // Also add the transformed plain object to seen
        if (obj && typeof obj === 'object')
            seen.add(obj);
    }
    // Handle ObjectId (Mongoose)
    if (obj && obj.constructor && obj.constructor.name === 'ObjectId') {
        return obj.toString();
    }
    if (Array.isArray(obj)) {
        return obj.map(v => formatData(v, seen));
    }
    const keys = Object.keys(obj);
    const result = {};
    const standardEntries = [];
    let idEntry = null;
    let createdAtEntry = null;
    let updatedAtEntry = null;
    for (const key of keys) {
        let value = obj[key];
        value = formatData(value, seen);
        const newKey = key === '_id' ? 'id' : snakeToCamel(key);
        if (newKey === 'id') {
            idEntry = { key: newKey, value };
        }
        else if (newKey === 'createdAt') {
            createdAtEntry = { key: newKey, value };
        }
        else if (newKey === 'updatedAt') {
            updatedAtEntry = { key: newKey, value };
        }
        else {
            standardEntries.push({ key: newKey, value });
        }
    }
    // 1. Sort standard properties alphabetically to guarantee 100% deterministic consistency
    // regardless of whether the data came from .lean(), .toJSON(), or manual object creation
    standardEntries.sort((a, b) => a.key.localeCompare(b.key));
    for (const entry of standardEntries) {
        result[entry.key] = entry.value;
    }
    // 2. Add createdAt near the end
    if (createdAtEntry)
        result[createdAtEntry.key] = createdAtEntry.value;
    // 3. Add updatedAt near the end
    if (updatedAtEntry)
        result[updatedAtEntry.key] = updatedAtEntry.value;
    // 4. Ensure 'id' is always the very LAST property per convention
    if (idEntry)
        result[idEntry.key] = idEntry.value;
    return result;
};
const sendResponse = (res, data) => {
    // 👇 store full response data for logger middleware
    res.locals.responsePayload = data;
    const resData = {
        success: data.success,
        statusCode: data.statusCode,
        message: data.message,
        meta: data.meta,
        data: data.data ? formatData(data.data) : data.data,
    };
    res.status(data.statusCode).json(resData);
};
exports.default = sendResponse;
