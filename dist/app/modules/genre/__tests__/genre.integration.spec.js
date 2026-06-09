"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const genre_service_1 = require("../genre.service");
const genre_model_1 = require("../genre.model");
const content_model_1 = require("../../content/content.model");
let replSet;
(0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    replSet = yield mongodb_memory_server_1.MongoMemoryReplSet.create({ replSet: { count: 1 } });
    yield mongoose_1.default.connect(replSet.getUri());
}));
(0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.disconnect();
    yield replSet.stop();
}));
(0, vitest_1.beforeEach)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield genre_model_1.Genre.deleteMany({});
    yield content_model_1.Content.deleteMany({});
    vitest_1.vi.clearAllMocks();
}));
(0, vitest_1.describe)('GenreService Integration', () => {
    (0, vitest_1.describe)('createGenreToDB', () => {
        (0, vitest_1.it)('successfully creates a genre', () => __awaiter(void 0, void 0, void 0, function* () {
            const payload = { name: 'Action', description: 'Action genre description' };
            const result = yield genre_service_1.GenreService.createGenreToDB(payload);
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.expect)(result.name).toBe(payload.name);
            (0, vitest_1.expect)(result.description).toBe(payload.description);
            const dbCheck = yield genre_model_1.Genre.findById(result._id);
            (0, vitest_1.expect)(dbCheck).not.toBeNull();
            (0, vitest_1.expect)(dbCheck === null || dbCheck === void 0 ? void 0 : dbCheck.name).toBe(payload.name);
        }));
    });
    (0, vitest_1.describe)('getGenresFromDB', () => {
        (0, vitest_1.it)('successfully retrieves genres and aggregates content count', () => __awaiter(void 0, void 0, void 0, function* () {
            // Create genres
            const genre1 = yield genre_model_1.Genre.create({ name: 'Sci-Fi' });
            const genre2 = yield genre_model_1.Genre.create({ name: 'Comedy' });
            // Create contents referencing genres
            yield content_model_1.Content.create({
                title: 'Content 1',
                description: 'Test description 1',
                genres: [genre1._id],
                type: 'MOVIE',
                videoUrl: 'https://example.com/video1.mp4',
                duration: 120,
                releaseYear: 2024,
                status: 'PUBLISHED',
            });
            yield content_model_1.Content.create({
                title: 'Content 2',
                description: 'Test description 2',
                genres: [genre1._id, genre2._id],
                type: 'SERIES',
                duration: 45,
                releaseYear: 2023,
                status: 'PUBLISHED',
            });
            const result = yield genre_service_1.GenreService.getGenresFromDB({});
            (0, vitest_1.expect)(result.data).toBeDefined();
            (0, vitest_1.expect)(result.data.length).toBe(2);
            const sciFi = result.data.find((g) => g.name === 'Sci-Fi');
            const comedy = result.data.find((g) => g.name === 'Comedy');
            (0, vitest_1.expect)(sciFi.contentCount).toBe(2); // Referenced in both Content 1 & 2
            (0, vitest_1.expect)(comedy.contentCount).toBe(1); // Referenced in Content 2
        }));
        (0, vitest_1.it)('successfully searches genres by name and description', () => __awaiter(void 0, void 0, void 0, function* () {
            yield genre_model_1.Genre.create({ name: 'Action', description: 'Explosions and car chases' });
            yield genre_model_1.Genre.create({ name: 'Comedy', description: 'Funny and hilarious' });
            yield genre_model_1.Genre.create({ name: 'Drama', description: 'Serious storytelling' });
            // Search by description keyword
            const result1 = yield genre_service_1.GenreService.getGenresFromDB({ searchTerm: 'Explosions' });
            (0, vitest_1.expect)(result1.data).toHaveLength(1);
            (0, vitest_1.expect)(result1.data[0].name).toBe('Action');
            // Search by name keyword
            const result2 = yield genre_service_1.GenreService.getGenresFromDB({ searchTerm: 'Comedy' });
            (0, vitest_1.expect)(result2.data).toHaveLength(1);
            (0, vitest_1.expect)(result2.data[0].name).toBe('Comedy');
            // Search matching nothing
            const result3 = yield genre_service_1.GenreService.getGenresFromDB({ searchTerm: 'Aliens' });
            (0, vitest_1.expect)(result3.data).toHaveLength(0);
        }));
    });
    (0, vitest_1.describe)('updateGenreInDB', () => {
        (0, vitest_1.it)('successfully updates a genre', () => __awaiter(void 0, void 0, void 0, function* () {
            const genre = yield genre_model_1.Genre.create({ name: 'Old Name' });
            const updated = yield genre_service_1.GenreService.updateGenreInDB(genre._id.toString(), { name: 'New Name' });
            (0, vitest_1.expect)(updated).not.toBeNull();
            (0, vitest_1.expect)(updated === null || updated === void 0 ? void 0 : updated.name).toBe('New Name');
            const dbCheck = yield genre_model_1.Genre.findById(genre._id);
            (0, vitest_1.expect)(dbCheck === null || dbCheck === void 0 ? void 0 : dbCheck.name).toBe('New Name');
        }));
    });
    (0, vitest_1.describe)('bulkDeleteGenresFromDB', () => {
        (0, vitest_1.it)('successfully deletes all provided genres (200 all-success case)', () => __awaiter(void 0, void 0, void 0, function* () {
            const genre1 = yield genre_model_1.Genre.create({ name: 'Horror' });
            const genre2 = yield genre_model_1.Genre.create({ name: 'Comedy' });
            const genre3 = yield genre_model_1.Genre.create({ name: 'Thriller' });
            const ids = [genre1._id.toString(), genre2._id.toString(), genre3._id.toString()];
            const result = yield genre_service_1.GenreService.bulkDeleteGenresFromDB(ids);
            console.log('--- bulkDeleteGenresFromDB (ALL SUCCESS) Response ---\n', JSON.stringify(result, null, 2));
            (0, vitest_1.expect)(result.deletedCount).toBe(3);
            (0, vitest_1.expect)(result.failedCount).toBe(0);
            (0, vitest_1.expect)(result.deletedIds).toHaveLength(3);
            (0, vitest_1.expect)(result.failed).toHaveLength(0);
            // Verify all removed from DB
            const remaining = yield genre_model_1.Genre.countDocuments({ _id: { $in: ids } });
            (0, vitest_1.expect)(remaining).toBe(0);
        }));
        (0, vitest_1.it)('returns partial result (207 case) when some IDs do not exist', () => __awaiter(void 0, void 0, void 0, function* () {
            const genre1 = yield genre_model_1.Genre.create({ name: 'Action' });
            const genre2 = yield genre_model_1.Genre.create({ name: 'Drama' });
            const fakeId = new (yield Promise.resolve().then(() => __importStar(require('mongoose')))).default.Types.ObjectId().toString();
            const ids = [genre1._id.toString(), fakeId, genre2._id.toString()];
            const result = yield genre_service_1.GenreService.bulkDeleteGenresFromDB(ids);
            console.log('--- bulkDeleteGenresFromDB (PARTIAL) Response ---\n', JSON.stringify(result, null, 2));
            (0, vitest_1.expect)(result.deletedCount).toBe(2);
            (0, vitest_1.expect)(result.failedCount).toBe(1);
            (0, vitest_1.expect)(result.deletedIds).toHaveLength(2);
            (0, vitest_1.expect)(result.failed).toHaveLength(1);
            (0, vitest_1.expect)(result.failed[0].id).toBe(fakeId);
            (0, vitest_1.expect)(result.failed[0].reason).toBe('NOT_FOUND');
            // Verify existing ones removed
            const remaining = yield genre_model_1.Genre.countDocuments({ _id: { $in: [genre1._id, genre2._id] } });
            (0, vitest_1.expect)(remaining).toBe(0);
        }));
        (0, vitest_1.it)('returns all-failed result when none of the IDs exist', () => __awaiter(void 0, void 0, void 0, function* () {
            const fakeId1 = new (yield Promise.resolve().then(() => __importStar(require('mongoose')))).default.Types.ObjectId().toString();
            const fakeId2 = new (yield Promise.resolve().then(() => __importStar(require('mongoose')))).default.Types.ObjectId().toString();
            const result = yield genre_service_1.GenreService.bulkDeleteGenresFromDB([fakeId1, fakeId2]);
            console.log('--- bulkDeleteGenresFromDB (ALL FAILED) Response ---\n', JSON.stringify(result, null, 2));
            (0, vitest_1.expect)(result.deletedCount).toBe(0);
            (0, vitest_1.expect)(result.failedCount).toBe(2);
            (0, vitest_1.expect)(result.deletedIds).toHaveLength(0);
            (0, vitest_1.expect)(result.failed).toHaveLength(2);
        }));
    });
});
