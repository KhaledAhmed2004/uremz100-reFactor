"use strict";
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
exports.seedMovies = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const content_model_1 = require("../app/modules/content/content.model");
const genre_model_1 = require("../app/modules/genre/genre.model");
const logger_1 = require("../shared/logger");
// List of reliable horizontal (16:9) real free videos for Movies
const movieVideos = [
    'https://res.cloudinary.com/demo/video/upload/dog.mp4',
    'https://res.cloudinary.com/demo/video/upload/elephants.mp4',
    'https://res.cloudinary.com/demo/video/upload/sea_turtle.mp4',
    'http://vjs.zencdn.net/v/oceans.mp4',
    'https://media.w3.org/2010/05/sintel/trailer.mp4'
];
const seedMovies = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Connect to the database
        yield mongoose_1.default.connect(config_1.default.database_url);
        logger_1.logger.info('Connected to MongoDB for seeding Movies...');
        // 1. Setup Genres
        const genreNames = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Thriller'];
        const genreIds = [];
        for (const name of genreNames) {
            const genre = yield genre_model_1.Genre.findOneAndUpdate({ name }, { name, description: `${name} movies` }, { upsert: true, new: true });
            if (genre) {
                genreIds.push(genre._id);
            }
        }
        // 2. Prepare Movie Data
        const moviesData = [];
        // Let's create 15 realistic movies
        for (let i = 0; i < 15; i++) {
            const isPremium = i % 3 === 0; // Every 3rd movie is premium (e.g. MONTHLY plan)
            const videoId = i % movieVideos.length;
            // Select 1 to 3 random genres
            const randomGenres = [];
            const numGenres = Math.floor(Math.random() * 3) + 1;
            for (let j = 0; j < numGenres; j++) {
                if (genreIds.length > 0) {
                    const randIndex = Math.floor(Math.random() * genreIds.length);
                    if (!randomGenres.includes(genreIds[randIndex])) {
                        randomGenres.push(genreIds[randIndex]);
                    }
                }
            }
            // If premium, it might have a trailer. Let's use a short video as a trailer.
            const trailerUrl = isPremium
                ? 'https://res.cloudinary.com/demo/video/upload/kitten-playing.mp4'
                : undefined;
            moviesData.push({
                title: isPremium ? `Premium Blockbuster Movie ${i + 1}` : `Awesome Free Movie ${i + 1}`,
                description: `This is an amazing full-length movie seeded for testing. ${isPremium ? 'Subscribe to watch the full HD version.' : 'Enjoy this movie completely free!'}`,
                type: 'MOVIE',
                status: 'PUBLISHED',
                planStatus: isPremium ? ['MONTHLY', 'YEARLY'] : ['FREE'],
                genres: randomGenres,
                videoUrl: movieVideos[videoId],
                trailerUrl: trailerUrl,
                // Horizontal poster dimensions typical for movies
                posterUrl: `https://picsum.photos/seed/movie${i}/1920/1080`,
                duration: Math.floor(Math.random() * 60) + 90, // Duration between 90 and 150 minutes
                releaseYear: 2020 + Math.floor(Math.random() * 5), // 2020 to 2024
                publishedAt: new Date(Date.now() - i * 86400000), // Staggered over the last 15 days
                views: Math.floor(Math.random() * 100000) + 5000,
                dailyViews: Math.floor(Math.random() * 1000) + 100,
                weeklyViews: Math.floor(Math.random() * 5000) + 500,
                totalWatchTime: Math.floor(Math.random() * 5000000) + 100000,
                engagementScore: Math.floor(Math.random() * 100) + 50,
                trendingScore: Math.floor(Math.random() * 100) + 50,
                cast: ['Actor A', 'Actor B', 'Actress C'],
                isPopularSeries: false
            });
        }
        // Insert into DB
        yield content_model_1.Content.insertMany(moviesData);
        logger_1.logger.info(`✨ Successfully seeded ${moviesData.length} Movies into the development database!`);
    }
    catch (error) {
        logger_1.logger.error('Error seeding Movies:', error);
    }
    finally {
        // Cleanly close connection
        yield mongoose_1.default.disconnect();
        logger_1.logger.info('Disconnected from MongoDB.');
    }
});
exports.seedMovies = seedMovies;
// Execute
(0, exports.seedMovies)().then(() => process.exit(0));
