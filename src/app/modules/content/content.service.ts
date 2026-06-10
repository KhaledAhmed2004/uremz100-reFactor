import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../../../config';
import httpStatus from 'http-status';
import { Types } from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import ApiError from '../../../errors/ApiError';
import { Content } from './content.model';
import { FavoriteContent } from '../favorite-content/favorite-content.model';
import { Episode } from "./episode.model";
import { Season } from "./season.model";

const s3 = new S3Client({
  region: 'auto',
  credentials: {
    accessKeyId: config.r2.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: config.r2.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  endpoint: config.r2.s3ApiUrl || process.env.AWS_S3_ENDPOINT || undefined,
  forcePathStyle: true,
});

const searchContentFromDB = async (query: Record<string, unknown>) => {
  const searchableFields = ['title', 'description'];

  // Handle specific "filter" parameter from documentation
  if (query.filter === 'popular') {
    query.sort = '-views';
  } else if (query.filter === 'new') {
    query.sort = '-createdAt';
  }

  const cardFields = 'title poster type rating releaseYear isPremium publishedAt createdAt';

  const contentQuery = new QueryBuilder(Content.find().select(cardFields), query)
    .search(searchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await contentQuery.modelQuery;
  const pagination = await contentQuery.getPaginationInfo();

  return {
    pagination,
    data: result,
  };
};

const favoriteContentInDB = async (userId: string, contentId: string) => {
  const isContentExist = await Content.findById(contentId);
  if (!isContentExist) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Content not found');
  }

  const result = await FavoriteContent.findOneAndUpdate(
    {
      userId: new Types.ObjectId(userId),
      contentId: new Types.ObjectId(contentId),
    },
    {
      userId: new Types.ObjectId(userId),
      contentId: new Types.ObjectId(contentId),
    },
    { upsert: true, new: true },
  );
  return result;
};

const unfavoriteContentFromDB = async (userId: string, contentId: string) => {
  const result = await FavoriteContent.findOneAndDelete({
    userId: new Types.ObjectId(userId),
    contentId: new Types.ObjectId(contentId),
  });
  return result;
};

const getBestMoviesFromDB = async () => {
  const result = await Content.find({ type: 'MOVIE' }).sort({ rating: -1 }).limit(10);
  return result;
};

const getComingSoonContentFromDB = async () => {
  const now = new Date();
  const result = await Content.find({
    $and: [
      { releaseDate: { $exists: true, $ne: null } },
      { releaseDate: { $gte: now } },
      { status: 'PUBLISHED' }
    ]
  }).sort({ releaseDate: 1 }).limit(10);
  return result;
};


const getAdminMoviesList = async (query: Record<string, unknown>) => {
  const movieQuery = new QueryBuilder(Content.find({ type: 'MOVIE' }), query)
    .search(['title'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const movies = await movieQuery.modelQuery;
  const paginationInfo = await movieQuery.getPaginationInfo();

  const data = movies.map((item: any) => ({
    _id: item._id,
    title: item.title,
    poster: item.poster,
    duration: `${Math.floor(item.duration / 60)}h ${item.duration % 60}m`,
    status: item.status,
    planStatus: item.planStatus,
  }));

  return {
    pagination: paginationInfo,
    data,
  };
};
const getAdminSeriesList = async (query: Record<string, unknown>) => {
  const seriesQuery = new QueryBuilder(Content.find({ type: 'SERIES' }), query)
    .search(['title'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const series = await seriesQuery.modelQuery;
  const paginationInfo = await seriesQuery.getPaginationInfo();

  const data = series.map((item: any) => ({
    _id: item._id,
    title: item.title,
    poster: item.poster,
    seasonsCount: item.seasonsCount || 0,
    status: item.status,
    subscriptionType: item.planStatus,
  }));

  return {
    pagination: paginationInfo,
    data,
  };
};
const getSeriesDetailsFromDB = async (id: string) => {
  const series = await Content.findById(id);
  if (!series) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Series not found');
  }

  // Double check total episodes count from Episode collection
  const totalEpisodes = await Episode.countDocuments({ seriesId: id });

  // Fetch seasons for this series and count episodes for each season
  const seasonsRaw = await Season.find({ seriesId: id }).sort('seasonNumber');

  const seasons = await Promise.all(
    seasonsRaw.map(async (season) => {
      const episodeCount = await Episode.countDocuments({ seasonId: season._id });
      return {
        ...season.toObject(),
        episodeCount,
      };
    })
  );

  return {
    ...series.toObject(),
    totalEpisodes: totalEpisodes,
    seasons: seasons,
  };
};

const getContentDetailsPublicFromDB = async (id: string) => {
  const content = await Content.findById(id);
  if (!content || content.status !== 'PUBLISHED') {
    throw new ApiError(httpStatus.NOT_FOUND, 'Content not found');
  }

  let result = content.toObject();

  if (content.type === 'SERIES') {
    const totalEpisodes = await Episode.countDocuments({ seriesId: id, status: 'PUBLISHED' });
    const seasonsRaw = await Season.find({ seriesId: id }).sort('seasonNumber');
    
    const seasons = await Promise.all(
      seasonsRaw.map(async (season) => {
        const episodes = await Episode.find({ seasonId: season._id, status: 'PUBLISHED' }).sort('episodeNumber');
        return {
          ...season.toObject(),
          episodeCount: episodes.length,
          episodes: episodes
        };
      })
    );

    result = {
      ...result,
      totalEpisodes,
      seasons
    };
  }

  return result;
};
const getEpisodesFromDB = async (seriesId: string, query: Record<string, unknown>) => {
  const filter: any = { seriesId: new Types.ObjectId(seriesId) };

  // Support filtering by seasonId or seasonNumber
  if (query.seasonId) {
    filter.seasonId = new Types.ObjectId(query.seasonId as string);
    delete query.seasonId;
  } else if (query.seasonNumber) {
    filter.seasonNumber = Number(query.seasonNumber);
    delete query.seasonNumber;
  }

  const episodeQuery = new QueryBuilder(
    Episode.find(filter),
    query,
  )
    .search(['title'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const episodes = await episodeQuery.modelQuery;
  const paginationInfo = await episodeQuery.getPaginationInfo();

  return {
    pagination: paginationInfo,
    data: episodes.map((ep: any) => ({
      _id: ep._id,
      title: ep.title,
      duration: `${ep.duration} min`,
      releaseDate: ep.releaseDate,
      status: ep.status,
      planStatus: ep.planStatus,
      seasonId: ep.seasonId,
      seasonNumber: ep.seasonNumber,
      episodeNumber: ep.episodeNumber,
    })),
  };
};
const createEpisodeToDB = async (seriesId: string, payload: any) => {
  const series = await Content.findById(seriesId);
  if (!series) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Series not found');
  }

  // If seasonId is provided, verify it exists
  if (payload.seasonId) {
    const season = await Season.findById(payload.seasonId);
    if (!season) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Season not found');
    }
    // Automatically set seasonNumber from the season record if not provided
    if (!payload.seasonNumber) {
      payload.seasonNumber = season.seasonNumber;
    }
  }

  const episodeData = {
    ...payload,
    seriesId: new Types.ObjectId(seriesId),
    seasonId: payload.seasonId ? new Types.ObjectId(payload.seasonId as string) : undefined,
    duration: payload.duration ? Number(payload.duration) : 0,
    seasonNumber: payload.seasonNumber ? Number(payload.seasonNumber) : 1,
    episodeNumber: payload.episodeNumber ? Number(payload.episodeNumber) : 1,
    releaseDate: payload.releaseDate ? new Date(payload.releaseDate) : new Date(),
    planStatus: payload.availability || 'FREE',
    status: payload.isDraft === 'true' || payload.isDraft === true ? 'DRAFT' : 'PUBLISHED',
  };

  const result = await Episode.create(episodeData);

  // Update series aggregate counts
  const totalEpisodes = await Episode.countDocuments({ seriesId });
  const maxSeason = await Episode.aggregate([
    { $match: { seriesId: new Types.ObjectId(seriesId) } },
    { $group: { _id: null, maxSeason: { $max: '$seasonNumber' } } }
  ]);

  await Content.findByIdAndUpdate(seriesId, {
    totalEpisodes,
    seasonsCount: maxSeason[0]?.maxSeason || 1
  });

  return result;
};
const updateEpisodeInDB = async (id: string, payload: any) => {
  const updateData = { ...payload };
  if (payload.duration) updateData.duration = Number(payload.duration);
  if (payload.seasonNumber) updateData.seasonNumber = Number(payload.seasonNumber);
  if (payload.releaseDate) updateData.releaseDate = new Date(payload.releaseDate);
  if (payload.availability) updateData.planStatus = payload.availability;
  if (payload.isDraft !== undefined) {
    updateData.status = payload.isDraft === 'true' || payload.isDraft === true ? 'DRAFT' : 'PUBLISHED';
  }

  const result = await Episode.findByIdAndUpdate(id, updateData, { new: true });

  if (result) {
    // Sync series aggregate counts
    const seriesId = result.seriesId;
    const totalEpisodes = await Episode.countDocuments({ seriesId });
    const maxSeason = await Episode.aggregate([
      { $match: { seriesId: new Types.ObjectId(seriesId as any) } },
      { $group: { _id: null, maxSeason: { $max: '$seasonNumber' } } }
    ]);

    await Content.findByIdAndUpdate(seriesId, {
      totalEpisodes,
      seasonsCount: maxSeason[0]?.maxSeason || 1
    });
  }

  return result;
};
const deleteEpisodeFromDB = async (id: string) => {
  const episode = await Episode.findById(id);
  if (!episode) return null;

  const seriesId = episode.seriesId;
  const result = await Episode.findByIdAndDelete(id);

  // Sync series aggregate counts
  const totalEpisodes = await Episode.countDocuments({ seriesId });
  const maxSeason = await Episode.aggregate([
    { $match: { seriesId: new Types.ObjectId(seriesId as any) } },
    { $group: { _id: null, maxSeason: { $max: '$seasonNumber' } } }
  ]);

  await Content.findByIdAndUpdate(seriesId, {
    totalEpisodes,
    seasonsCount: maxSeason[0]?.maxSeason || 1
  });

  return result;
};
const createMovieToDB = async (payload: any) => {
  const { isDraft, availability, genres, cast, duration, releaseYear, rating, views, isPremium, releaseDate, isPopularSeries, thumbnail, ...rest } = payload;

  const movieData: any = {
    ...rest,
    genres: Array.isArray(genres) ? genres : (genres ? [genres] : []),
    cast: Array.isArray(cast) ? cast : (cast ? [cast] : []),
    duration: duration ? Number(duration) : 0,
    releaseYear: releaseYear ? Number(releaseYear) : new Date().getFullYear(),
    rating: rating ? Number(rating) : 0,
    views: views ? Number(views) : 0,
    isPopularSeries: isPopularSeries === 'true' || isPopularSeries === true,
    planStatus: Array.isArray(availability) ? availability : (availability ? [availability] : ['FREE']),
    status: isDraft === 'true' || isDraft === true ? 'DRAFT' : 'PUBLISHED',
    publishedAt: isDraft === 'true' || isDraft === true ? undefined : new Date(),
    type: 'MOVIE'
  };

  if (isPremium !== undefined) movieData.isPremium = isPremium === 'true' || isPremium === true;
  if (releaseDate !== undefined) movieData.releaseDate = new Date(releaseDate);

  const result = await Content.create(movieData);
  return result;
};
const createSeriesToDB = async (payload: any) => {
  const { isDraft, availability, genres, releaseYear, rating, views, isPremium, releaseDate, isPopularSeries, cast, thumbnail, ...rest } = payload;

  const seriesData: any = {
    ...rest,
    genres: Array.isArray(genres) ? genres : (genres ? [genres] : []),
    cast: Array.isArray(cast) ? cast : (cast ? [cast] : []),
    duration: 0, // Series duration is aggregate of episodes usually
    releaseYear: releaseYear ? Number(releaseYear) : new Date().getFullYear(),
    rating: rating ? Number(rating) : 0,
    views: views ? Number(views) : 0,
    isPopularSeries: isPopularSeries === 'true' || isPopularSeries === true,
    planStatus: Array.isArray(availability) ? availability : (availability ? [availability] : ['FREE']),
    status: isDraft === 'true' || isDraft === true ? 'DRAFT' : 'PUBLISHED',
    publishedAt: isDraft === 'true' || isDraft === true ? undefined : new Date(),
    type: 'SERIES',
  };

  if (isPremium !== undefined) seriesData.isPremium = isPremium === 'true' || isPremium === true;
  if (releaseDate !== undefined) seriesData.releaseDate = new Date(releaseDate);

  const result = await Content.create(seriesData);
  return result;
};
const updateSeriesInDB = async (id: string, payload: any) => {
  const { isDraft, availability, genres, releaseYear, rating, views, isPremium, releaseDate, isPopularSeries, cast, thumbnail, ...rest } = payload;

  const updateData: any = { ...rest };
  if (genres) updateData.genres = Array.isArray(genres) ? genres : [genres];
  if (cast) updateData.cast = Array.isArray(cast) ? cast : [cast];
  if (releaseYear !== undefined) updateData.releaseYear = Number(releaseYear);
  if (rating !== undefined) updateData.rating = Number(rating);
  if (views !== undefined) updateData.views = Number(views);
  if (isPremium !== undefined) updateData.isPremium = isPremium === 'true' || isPremium === true;
  if (releaseDate !== undefined) updateData.releaseDate = new Date(releaseDate);
  if (isPopularSeries !== undefined) updateData.isPopularSeries = isPopularSeries === 'true' || isPopularSeries === true;

  if (availability) updateData.planStatus = Array.isArray(availability) ? availability : [availability];
  if (isDraft !== undefined) {
    const isDraftBool = isDraft === 'true' || isDraft === true;
    updateData.status = isDraftBool ? 'DRAFT' : 'PUBLISHED';
    if (!isDraftBool) updateData.publishedAt = new Date();
  }

  const result = await Content.findByIdAndUpdate(id, updateData, { new: true });
  return result;
};
const deleteSeriesFromDB = async (id: string) => {
  // 1. Delete all episodes associated with this series
  await Episode.deleteMany({ seriesId: new Types.ObjectId(id) });

  // 2. Delete the series content
  const result = await Content.findByIdAndDelete(id);
  return result;
};
const updateSeriesStatusInDB = async (id: string, status: string) => {
  const result = await Content.findByIdAndUpdate(id, { status }, { new: true });
  return result;
};
const updateMovieInDB = async (id: string, payload: any) => {
  const { isDraft, availability, genres, cast, duration, releaseYear, rating, views, isPremium, releaseDate, isPopularSeries, ...rest } = payload;

  const updateData: any = { ...rest };
  if (genres) updateData.genres = Array.isArray(genres) ? genres : [genres];
  if (cast) updateData.cast = Array.isArray(cast) ? cast : [cast];
  if (duration !== undefined) updateData.duration = Number(duration);
  if (releaseYear !== undefined) updateData.releaseYear = Number(releaseYear);
  if (rating !== undefined) updateData.rating = Number(rating);
  if (views !== undefined) updateData.views = Number(views);
  if (isPremium !== undefined) updateData.isPremium = isPremium === 'true' || isPremium === true;
  if (releaseDate !== undefined) updateData.releaseDate = new Date(releaseDate);
  if (isPopularSeries !== undefined) updateData.isPopularSeries = isPopularSeries === 'true' || isPopularSeries === true;

  if (availability) updateData.planStatus = Array.isArray(availability) ? availability : [availability];
  if (isDraft !== undefined) {
    const isDraftBool = isDraft === 'true' || isDraft === true;
    updateData.status = isDraftBool ? 'DRAFT' : 'PUBLISHED';
    if (!isDraftBool) updateData.publishedAt = new Date();
  }

  const result = await Content.findByIdAndUpdate(id, updateData, { new: true });
  return result;
};
const deleteMovieFromDB = async (id: string) => {
  const result = await Content.findByIdAndDelete(id);
  return result;
};
const updateMovieStatusInDB = async (id: string, status: string) => {
  const result = await Content.findByIdAndUpdate(id, { status }, { new: true });
  return result;
};
const initiateMultipartUpload = async (fileName: string, contentType: string) => {
  const key = `media/videos/${Date.now()}-${fileName}`;
  const bucket = config.r2.bucketName || process.env.AWS_S3_BUCKET!;

  const command = new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const response = await s3.send(command);
  return {
    uploadId: response.UploadId,
    key: key,
  };
};
const generateMultipartPresignedUrls = async (
  uploadId: string,
  key: string,
  partNumbers: number[]
) => {
  const bucket = config.r2.bucketName || process.env.AWS_S3_BUCKET!;
  const urls = await Promise.all(
    partNumbers.map(async (partNumber) => {
      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
      return { partNumber, url };
    })
  );

  return urls;
};
const completeMultipartUpload = async (
  uploadId: string,
  key: string,
  parts: { ETag: string; PartNumber: number }[]
) => {
  const bucket = config.r2.bucketName || process.env.AWS_S3_BUCKET!;

  const command = new CompleteMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
    },
  });

  await s3.send(command);

  let location = '';
  if (config.r2.customDomain) {
    location = `${config.r2.customDomain.replace(/\/$/, '')}/${key}`;
  } else if (config.r2.accountId) {
    location = `https://${config.r2.accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
  } else {
    const region = process.env.AWS_REGION || 'us-east-1';
    location = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  return {
    location,
    key: key,
  };
};
const createSeasonToDB = async (seriesId: string, payload: any) => {
  const series = await Content.findById(seriesId);
  if (!series) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Series not found');
  }

  const result = await Season.create({
    ...payload,
    seriesId,
  });

  // Update series seasonsCount
  await Content.findByIdAndUpdate(seriesId, {
    $inc: { seasonsCount: 1 },
  });

  return result;
};
const getSeasonsBySeriesFromDB = async (seriesId: string) => {
  return await Season.find({ seriesId }).sort('seasonNumber');
};
const updateSeasonInDB = async (id: string, payload: any) => {
  const result = await Season.findByIdAndUpdate(id, payload, { new: true });
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Season not found');
  }
  return result;
};
const deleteSeasonFromDB = async (id: string) => {
  const season = await Season.findById(id);
  if (!season) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Season not found');
  }

  // Delete all episodes in this season
  await Episode.deleteMany({ seasonId: id });

  // Delete season
  await Season.findByIdAndDelete(id);

  // Decrement series seasonsCount
  await Content.findByIdAndUpdate(season.seriesId, {
    $inc: { seasonsCount: -1 },
  });

  return null;
};


export const ContentService = {
  searchContentFromDB,
  favoriteContentInDB,
  unfavoriteContentFromDB,
  getBestMoviesFromDB,
  getComingSoonContentFromDB,
  getAdminMoviesList: getAdminMoviesList,
  getAdminSeriesList: getAdminSeriesList,
  getSeriesDetailsFromDB: getSeriesDetailsFromDB,
  getEpisodesFromDB: getEpisodesFromDB,
  createEpisodeToDB: createEpisodeToDB,
  updateEpisodeInDB: updateEpisodeInDB,
  deleteEpisodeFromDB: deleteEpisodeFromDB,
  createMovieToDB: createMovieToDB,
  createSeriesToDB: createSeriesToDB,
  updateSeriesInDB: updateSeriesInDB,
  deleteSeriesFromDB: deleteSeriesFromDB,
  updateSeriesStatusInDB: updateSeriesStatusInDB,
  updateMovieInDB: updateMovieInDB,
  deleteMovieFromDB: deleteMovieFromDB,
  updateMovieStatusInDB: updateMovieStatusInDB,
  initiateMultipartUpload: initiateMultipartUpload,
  generateMultipartPresignedUrls: generateMultipartPresignedUrls,
  completeMultipartUpload: completeMultipartUpload,
  createSeasonToDB: createSeasonToDB,
  getSeasonsBySeriesFromDB: getSeasonsBySeriesFromDB,
  updateSeasonInDB: updateSeasonInDB,
  deleteSeasonFromDB: deleteSeasonFromDB,
  getContentDetailsPublicFromDB: getContentDetailsPublicFromDB
};
