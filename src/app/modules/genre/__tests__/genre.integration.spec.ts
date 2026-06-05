import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { GenreService } from '../genre.service';
import { Genre } from '../genre.model';
import { Content } from '../../content/content.model';

let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Genre.deleteMany({});
  await Content.deleteMany({});
  vi.clearAllMocks();
});

describe('GenreService Integration', () => {
  describe('createGenreToDB', () => {
    it('successfully creates a genre', async () => {
      const payload = { name: 'Action', description: 'Action genre description' };
      const result = await GenreService.createGenreToDB(payload);

      expect(result).toBeDefined();
      expect(result.name).toBe(payload.name);
      expect(result.description).toBe(payload.description);

      const dbCheck = await Genre.findById(result._id);
      expect(dbCheck).not.toBeNull();
      expect(dbCheck?.name).toBe(payload.name);
    });
  });

  describe('getGenresFromDB', () => {
    it('successfully retrieves genres and aggregates content count', async () => {
      // Create genres
      const genre1 = await Genre.create({ name: 'Sci-Fi' });
      const genre2 = await Genre.create({ name: 'Comedy' });

      // Create contents referencing genres
      await Content.create({
        title: 'Content 1',
        description: 'Test description 1',
        genres: [genre1._id],
        type: 'MOVIE',
        videoUrl: 'https://example.com/video1.mp4',
        duration: 120,
        releaseYear: 2024,
        status: 'PUBLISHED',
      });
      await Content.create({
        title: 'Content 2',
        description: 'Test description 2',
        genres: [genre1._id, genre2._id],
        type: 'SERIES',
        duration: 45,
        releaseYear: 2023,
        status: 'PUBLISHED',
      });

      const result = await GenreService.getGenresFromDB({});

      expect(result.data).toBeDefined();
      expect(result.data.length).toBe(2);

      const sciFi = result.data.find((g: any) => g.name === 'Sci-Fi');
      const comedy = result.data.find((g: any) => g.name === 'Comedy');

      expect(sciFi.contentCount).toBe(2); // Referenced in both Content 1 & 2
      expect(comedy.contentCount).toBe(1); // Referenced in Content 2
    });

    it('successfully searches genres by name and description', async () => {
      await Genre.create({ name: 'Action', description: 'Explosions and car chases' });
      await Genre.create({ name: 'Comedy', description: 'Funny and hilarious' });
      await Genre.create({ name: 'Drama', description: 'Serious storytelling' });

      // Search by description keyword
      const result1 = await GenreService.getGenresFromDB({ searchTerm: 'Explosions' });
      expect(result1.data).toHaveLength(1);
      expect(result1.data[0].name).toBe('Action');

      // Search by name keyword
      const result2 = await GenreService.getGenresFromDB({ searchTerm: 'Comedy' });
      expect(result2.data).toHaveLength(1);
      expect(result2.data[0].name).toBe('Comedy');
      
      // Search matching nothing
      const result3 = await GenreService.getGenresFromDB({ searchTerm: 'Aliens' });
      expect(result3.data).toHaveLength(0);
    });
  });

  describe('updateGenreInDB', () => {
    it('successfully updates a genre', async () => {
      const genre = await Genre.create({ name: 'Old Name' });

      const updated = await GenreService.updateGenreInDB(genre._id.toString(), { name: 'New Name' });
      
      expect(updated).not.toBeNull();
      expect(updated?.name).toBe('New Name');

      const dbCheck = await Genre.findById(genre._id);
      expect(dbCheck?.name).toBe('New Name');
    });
  });


  describe('bulkDeleteGenresFromDB', () => {
    it('successfully deletes all provided genres (200 all-success case)', async () => {
      const genre1 = await Genre.create({ name: 'Horror' });
      const genre2 = await Genre.create({ name: 'Comedy' });
      const genre3 = await Genre.create({ name: 'Thriller' });

      const ids = [genre1._id.toString(), genre2._id.toString(), genre3._id.toString()];
      const result = await GenreService.bulkDeleteGenresFromDB(ids);
      console.log('--- bulkDeleteGenresFromDB (ALL SUCCESS) Response ---\n', JSON.stringify(result, null, 2));

      expect(result.deletedCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.deletedIds).toHaveLength(3);
      expect(result.failed).toHaveLength(0);

      // Verify all removed from DB
      const remaining = await Genre.countDocuments({ _id: { $in: ids } });
      expect(remaining).toBe(0);
    });

    it('returns partial result (207 case) when some IDs do not exist', async () => {
      const genre1 = await Genre.create({ name: 'Action' });
      const genre2 = await Genre.create({ name: 'Drama' });
      const fakeId = new (await import('mongoose')).default.Types.ObjectId().toString();

      const ids = [genre1._id.toString(), fakeId, genre2._id.toString()];
      const result = await GenreService.bulkDeleteGenresFromDB(ids);
      console.log('--- bulkDeleteGenresFromDB (PARTIAL) Response ---\n', JSON.stringify(result, null, 2));

      expect(result.deletedCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.deletedIds).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe(fakeId);
      expect(result.failed[0].reason).toBe('NOT_FOUND');

      // Verify existing ones removed
      const remaining = await Genre.countDocuments({ _id: { $in: [genre1._id, genre2._id] } });
      expect(remaining).toBe(0);
    });

    it('returns all-failed result when none of the IDs exist', async () => {
      const fakeId1 = new (await import('mongoose')).default.Types.ObjectId().toString();
      const fakeId2 = new (await import('mongoose')).default.Types.ObjectId().toString();

      const result = await GenreService.bulkDeleteGenresFromDB([fakeId1, fakeId2]);
      console.log('--- bulkDeleteGenresFromDB (ALL FAILED) Response ---\n', JSON.stringify(result, null, 2));

      expect(result.deletedCount).toBe(0);
      expect(result.failedCount).toBe(2);
      expect(result.deletedIds).toHaveLength(0);
      expect(result.failed).toHaveLength(2);
    });
  });
});
