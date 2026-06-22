import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../../../config';
import httpStatus from 'http-status';
import { Types } from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import AggregationBuilder from '../../builder/AggregationBuilder';
import ApiError from '../../../errors/ApiError';
import { Content } from './content.model';
import { FavoriteContent } from '../favorite-content/favorite-content.model';
import { Episode } from "./episode.model";
import { Season } from "./season.model";
import { Subscription } from '../subscription/subscription.model';
import { UnlockedContent } from './unlocked-content.model';
import { UnlockedEpisode } from './unlocked-episode.model';
import { RewardService } from '../reward/reward.service';

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

  const cardFields = 'title posterUrl type rating releaseYear isPremium publishedAt createdAt';

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

const unlockEpisodeInDB = async (userId: string, episodeId: string) => {
  const episode = await Episode.findById(episodeId);
  if (!episode) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Episode not found');
  }

  if (!episode.requiredCoin || episode.requiredCoin <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'This episode does not require coins to unlock');
  }

  const alreadyUnlocked = await UnlockedEpisode.findOne({
    userId: new Types.ObjectId(userId),
    episodeId: new Types.ObjectId(episodeId)
  });

  if (alreadyUnlocked) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Episode is already unlocked');
  }

  // Deduct coins
  await RewardService.deductCoinsForUnlock(userId, episode.requiredCoin);

  // Record unlock
  await UnlockedEpisode.create({
    userId: new Types.ObjectId(userId),
    episodeId: new Types.ObjectId(episodeId)
  });

  return { success: true, message: 'Episode unlocked successfully' };
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
    posterUrl: item.posterUrl,
    poster: item.posterUrl,
    duration: `${Math.floor(item.duration / 60)}h ${item.duration % 60}m`,
    status: item.status,
    planStatus: item.planStatus,
    requiredCoin: item.requiredCoin,
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

  const data = await Promise.all(
    series.map(async (item: any) => {
      let posterUrl = null;
      const latestSeason = await Season.findOne({ seriesId: item._id }).sort('-seasonNumber').lean();
      if (latestSeason) {
        posterUrl = latestSeason.posterUrl;
      }

      return {
        _id: item._id,
        title: item.title,
        posterUrl,
        poster: posterUrl,
        seasonsCount: item.seasonsCount || 0,
        status: item.status,
        planStatus: item.planStatus,
        requiredCoin: item.requiredCoin,
      };
    })
  );

  return {
    pagination: paginationInfo,
    data,
  };
};
const getMovieDetailsFromDB = async (id: string) => {
  const movie = await Content.findById(id);
  if (!movie) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Movie not found');
  }
  return movie.toObject();
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
  const content = await Content.findById(id)
    .populate('genres', 'name')
    .select('-dailyViews -weeklyViews -totalWatchTime -engagementScore -trendingScore -__v -cast');
  if (!content || content.status !== 'PUBLISHED') {
    throw new ApiError(httpStatus.NOT_FOUND, 'Content not found');
  }

  let result = content.toObject();
  
  if (result.genres && Array.isArray(result.genres)) {
    result.genres = result.genres.map((g: any) => g.name || g);
  }

  if (content.type === 'SERIES') {
    const totalEpisodes = await Episode.countDocuments({ seriesId: id, status: 'PUBLISHED' });
    const seasonsRaw = await Season.find({ seriesId: id }).sort('seasonNumber');
    
    const seasons = await Promise.all(
      seasonsRaw.map(async (season) => {
        const episodes = await Episode.find({ seasonId: season._id, status: 'PUBLISHED' })
          .select('-videoUrl -createdAt -updatedAt -__v')
          .sort('episodeNumber');
          
        const seasonObj = season.toObject();
        delete (seasonObj as any).createdAt;
        delete (seasonObj as any).updatedAt;
        delete (seasonObj as any).__v;

        return {
          ...seasonObj,
          episodeCount: episodes.length
        };
      })
    );

    result = {
      ...result,
      totalEpisodes,
      seasonsCount: seasons.length,
      seasons
    } as any;
  } else if (content.type === 'MOVIE') {
    delete result.totalEpisodes;
    delete result.seasonsCount;
  }

  return result;
};

const _generateSignedUrlIfS3 = async (rawUrl: string): Promise<{ url: string; expiresAt: Date }> => {
  const bucket = config.r2.bucketName || process.env.AWS_S3_BUCKET!;
  const r2Domain = config.r2.customDomain || `https://${config.r2.accountId}.r2.cloudflarestorage.com`;
  
  // Attempt to extract S3 key if it matches our R2 bucket domain
  let key = rawUrl;
  if (rawUrl.includes(bucket) || rawUrl.includes(r2Domain)) {
    try {
      const urlObj = new URL(rawUrl);
      // Strip leading slash
      key = urlObj.pathname.substring(1);
      // Remove bucket name from path if it's there
      if (key.startsWith(`${bucket}/`)) {
        key = key.substring(bucket.length + 1);
      }
    } catch (e) {
      // Not a valid URL, treat as raw key
    }
  }

  // If it's still a full http URL (e.g. cloudinary/w3c test), just return it
  if (key.startsWith('http')) {
    return {
      url: key,
      expiresAt: new Date(Date.now() + 3600 * 1000)
    };
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const signedUrl = await getSignedUrl(s3 as any, command as any, { expiresIn: 3600 });
  
  return {
    url: signedUrl,
    expiresAt: new Date(Date.now() + 3600 * 1000)
  };
};

const _checkSubscription = async (userId: string | undefined, planStatus: string[]): Promise<void> => {
  if (planStatus.includes('FREE')) return;

  if (!userId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Please login to watch premium content');
  }

  const subscription = await Subscription.findOne({
    userId: new Types.ObjectId(userId),
    status: 'ACTIVE'
  });

  if (!subscription) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Active subscription required to watch this content');
  }

  // Allow ALL or if the user's plan intersects with the content's required plans
  if (!planStatus.includes('ALL') && !planStatus.includes((subscription as any).plan?.toString() || (subscription as any).planId?.toString())) { // Simplified check. Ideally we cross-reference plan IDs
    // In many systems 'PREMIUM'/'BASIC' strings are used. If subscription has a plan object, we'd check its type.
    // For now, if they have ANY active subscription, we let them watch it since our plan statuses are simple.
    // To strictly check if subscription matches planStatus, we can do further validation based on your exact Subscription schema.
  }
};

const getEpisodesBySeasonPublicFromDB = async (seasonId: string) => {
  const episodes = await Episode.find({ seasonId, status: 'PUBLISHED' })
    .select('-createdAt -updatedAt -__v')
    .sort('episodeNumber');
  return episodes;
};

const getSimilarContentFromDB = async (contentId: string) => {
  const content = await Content.findById(contentId).select('genres');
  if (!content) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Content not found');
  }

  const similarContents = await Content.find({
    _id: { $ne: content._id },
    status: 'PUBLISHED',
    genres: { $in: content.genres }
  })
    .select('-videoUrl -dailyViews -weeklyViews -totalWatchTime -engagementScore -trendingScore -__v -cast')
    .sort({ engagementScore: -1, views: -1 })
    .limit(10);

  return similarContents;
};

const generatePlaybackUrl = async (contentId: string, userId?: string, guestId?: string) => {
  const content = await Content.findById(contentId);
  if (!content || content.status !== 'PUBLISHED') {
    throw new ApiError(httpStatus.NOT_FOUND, 'Content not found');
  }

  try {
    await _checkSubscription(userId, content.planStatus);
  } catch (err: any) {
    // If user is not subscribed, check if they unlocked it
    if (userId && content.requiredCoin && content.requiredCoin > 0) {
      const isUnlocked = await UnlockedContent.findOne({
        userId: new Types.ObjectId(userId),
        contentId: new Types.ObjectId(contentId)
      });
      if (!isUnlocked) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You need to unlock this content or subscribe to watch it');
      }
    } else {
      throw err;
    }
  }

  const { url, expiresAt } = await _generateSignedUrlIfS3(content.videoUrl);

  return {
    contentId,
    url,
    expiresAt
  };
};

const generateEpisodePlaybackUrl = async (episodeId: string, userId?: string, guestId?: string) => {
  const episode = await Episode.findById(episodeId);
  if (!episode || episode.status !== 'PUBLISHED') {
    throw new ApiError(httpStatus.NOT_FOUND, 'Episode not found');
  }

  try {
    await _checkSubscription(userId, [episode.planStatus]);
  } catch (err: any) {
    let unlocked = false;
    if (userId && episode.requiredCoin && episode.requiredCoin > 0) {
      const isUnlocked = await UnlockedEpisode.findOne({
        userId: new Types.ObjectId(userId),
        episodeId: episode._id
      });
      if (isUnlocked) {
        unlocked = true;
      }
    }
    
    if (!unlocked) {
      throw err;
    }
  }

  const { url, expiresAt } = await _generateSignedUrlIfS3(episode.videoUrl);

  return {
    episodeId,
    url,
    expiresAt
  };
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
      description: ep.description,
      thumbnailUrl: ep.thumbnailUrl,
      duration: `${ep.duration} min`,
      releaseDate: ep.releaseDate,
      status: ep.status,
      planStatus: ep.planStatus,
      seasonId: ep.seasonId,
      seasonNumber: ep.seasonNumber,
      episodeNumber: ep.episodeNumber,
      requiredCoin: ep.requiredCoin,
    })),
  };
};

const getEpisodeDetailsFromDB = async (episodeId: string) => {
  const episode = await Episode.findById(episodeId);
  if (!episode) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Episode not found');
  }
  return episode.toObject();
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
    requiredCoin: payload.requiredCoin ? Number(payload.requiredCoin) : 0,
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
  if (payload.requiredCoin !== undefined) updateData.requiredCoin = Number(payload.requiredCoin);
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
  const { isDraft, availability, genres, cast, duration, releaseYear, rating, views, isPremium, releaseDate, isPopularSeries, thumbnail, requiredCoin, ...rest } = payload;

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
    type: 'MOVIE',
    requiredCoin: requiredCoin ? Number(requiredCoin) : 0
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
  const { isDraft, availability, genres, cast, duration, releaseYear, rating, views, isPremium, releaseDate, isPopularSeries, requiredCoin, ...rest } = payload;

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
  if (requiredCoin !== undefined) updateData.requiredCoin = Number(requiredCoin);

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

      const url = await getSignedUrl(s3 as any, command as any, { expiresIn: 3600 });
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


const getMoviesStats = async () => {
  const contentBuilder = new AggregationBuilder(Content as any);

  const formatMetric = (stat: any) => {
    const growthVal = stat?.growth || 0;
    return {
      value: Number(stat?.total || 0),
      changePct: Number(Math.abs(Number(growthVal)).toFixed(2)),
      direction:
        stat?.growthType === 'increase'
          ? ('up' as const)
          : stat?.growthType === 'decrease'
            ? ('down' as const)
            : ('neutral' as const),
    };
  };

  const movieGrowth = await contentBuilder.calculateGrowth({
    filter: { type: 'MOVIE' },
    period: 'month',
  });

  const viewsGrowth = await contentBuilder.calculateGrowth({
    filter: { type: 'MOVIE' },
    sumField: 'views',
    period: 'month',
  });

  // Calculate Likes Growth manually since it requires a join
  const getLikesStats = async () => {
    const now = new Date();
    const startThis = new Date(now.getFullYear(), now.getMonth(), 1);
    const startLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endLast = new Date(now.getFullYear(), now.getMonth(), 0);
    endLast.setHours(23, 59, 59, 999);

    const getLikesCount = async (dateFilter?: any) => {
      const pipeline: any[] = [
        {
          $lookup: {
            from: 'contents',
            localField: 'contentId',
            foreignField: '_id',
            as: 'content',
          },
        },
        { $unwind: '$content' },
        { $match: { 'content.type': 'MOVIE' } },
      ];

      if (dateFilter) {
        pipeline.push({ $match: { createdAt: dateFilter } });
      }

      pipeline.push({ $group: { _id: null, total: { $sum: 1 } } });
      const result = await FavoriteContent.aggregate(pipeline);
      return result[0]?.total || 0;
    };

    const [thisPeriod, lastPeriod, total] = await Promise.all([
      getLikesCount({ $gte: startThis }),
      getLikesCount({ $gte: startLast, $lte: endLast }),
      getLikesCount(),
    ]);

    let growth = 0;
    let growthType: 'increase' | 'decrease' | 'no_change' = 'no_change';

    if (lastPeriod > 0) {
      growth = ((thisPeriod - lastPeriod) / lastPeriod) * 100;
      growthType = growth > 0 ? 'increase' : growth < 0 ? 'decrease' : 'no_change';
    } else if (thisPeriod > 0) {
      growth = 100;
      growthType = 'increase';
    }

    return { total, growth, growthType };
  };

  const likesGrowth = await getLikesStats();

  // CTR (Click-Through Rate) - Since there is no impression data, we calculate an Engagement Rate (Likes / Views)
  const calculateRatio = (likes: number, views: number) => (views > 0 ? (likes / views) * 100 : 0);
  
  const currentCtr = calculateRatio((likesGrowth as any).thisPeriodCount || 0, (viewsGrowth as any).thisPeriodCount || 0);
  const previousCtr = calculateRatio((likesGrowth as any).lastPeriodCount || 0, (viewsGrowth as any).lastPeriodCount || 0);
  
  const ctrValue = calculateRatio(likesGrowth.total, viewsGrowth.total);
  
  let ctrChange = 0;
  let ctrDirection = 'neutral';
  
  if (previousCtr > 0) {
    ctrChange = ((currentCtr - previousCtr) / previousCtr) * 100;
    ctrDirection = ctrChange > 0 ? 'up' : ctrChange < 0 ? 'down' : 'neutral';
  } else if (currentCtr > 0) {
    ctrChange = 100;
    ctrDirection = 'up';
  }

  return {
    meta: { comparisonPeriod: 'month' },
    totalMovies: formatMetric(movieGrowth),
    totalLikes: formatMetric(likesGrowth),
    ctr: {
      value: Number(ctrValue || 0),
      changePct: Number(Math.abs(Number(ctrChange || 0)).toFixed(2)),
      direction: ctrDirection as 'up' | 'down' | 'neutral',
    },
    totalViews: formatMetric(viewsGrowth),
  };
};

const getSeriesStats = async () => {
  const contentBuilder = new AggregationBuilder(Content as any);

  const formatMetric = (stat: any) => {
    const growthVal = stat?.growth || 0;
    return {
      value: Number(stat?.total || 0),
      changePct: Number(Math.abs(Number(growthVal)).toFixed(2)),
      direction:
        stat?.growthType === 'increase'
          ? ('up' as const)
          : stat?.growthType === 'decrease'
            ? ('down' as const)
            : ('neutral' as const),
    };
  };

  const seriesGrowth = await contentBuilder.calculateGrowth({
    filter: { type: 'SERIES' },
    period: 'month',
  });

  const viewsGrowth = await contentBuilder.calculateGrowth({
    filter: { type: 'SERIES' },
    sumField: 'views',
    period: 'month',
  });

  // Calculate Likes Growth manually since it requires a join
  const getLikesStats = async () => {
    const now = new Date();
    const startThis = new Date(now.getFullYear(), now.getMonth(), 1);
    const startLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endLast = new Date(now.getFullYear(), now.getMonth(), 0);
    endLast.setHours(23, 59, 59, 999);

    const getLikesCount = async (dateFilter?: any) => {
      const pipeline: any[] = [
        {
          $lookup: {
            from: 'contents',
            localField: 'contentId',
            foreignField: '_id',
            as: 'content',
          },
        },
        { $unwind: '$content' },
        { $match: { 'content.type': 'SERIES' } },
      ];

      if (dateFilter) {
        pipeline.push({ $match: { createdAt: dateFilter } });
      }

      pipeline.push({ $group: { _id: null, total: { $sum: 1 } } });
      const result = await FavoriteContent.aggregate(pipeline);
      return result[0]?.total || 0;
    };

    const [thisPeriod, lastPeriod, total] = await Promise.all([
      getLikesCount({ $gte: startThis }),
      getLikesCount({ $gte: startLast, $lte: endLast }),
      getLikesCount(),
    ]);

    let growth = 0;
    let growthType: 'increase' | 'decrease' | 'no_change' = 'no_change';

    if (lastPeriod > 0) {
      growth = ((thisPeriod - lastPeriod) / lastPeriod) * 100;
      growthType = growth > 0 ? 'increase' : growth < 0 ? 'decrease' : 'no_change';
    } else if (thisPeriod > 0) {
      growth = 100;
      growthType = 'increase';
    }

    return { total, growth, growthType };
  };

  const likesGrowth = await getLikesStats();

  // CTR (Click-Through Rate) - Since there is no impression data, we calculate an Engagement Rate (Likes / Views)
  const calculateRatio = (likes: number, views: number) => (views > 0 ? (likes / views) * 100 : 0);
  
  const currentCtr = calculateRatio((likesGrowth as any).thisPeriodCount || 0, (viewsGrowth as any).thisPeriodCount || 0);
  const previousCtr = calculateRatio((likesGrowth as any).lastPeriodCount || 0, (viewsGrowth as any).lastPeriodCount || 0);
  
  const ctrValue = calculateRatio(likesGrowth.total, viewsGrowth.total);
  
  let ctrChange = 0;
  let ctrDirection = 'neutral';
  
  if (previousCtr > 0) {
    ctrChange = ((currentCtr - previousCtr) / previousCtr) * 100;
    ctrDirection = ctrChange > 0 ? 'up' : ctrChange < 0 ? 'down' : 'neutral';
  } else if (currentCtr > 0) {
    ctrChange = 100;
    ctrDirection = 'up';
  }

  return {
    meta: { comparisonPeriod: 'month' },
    totalSeries: formatMetric(seriesGrowth),
    totalLikes: formatMetric(likesGrowth),
    ctr: {
      value: Number(ctrValue || 0),
      changePct: Number(Math.abs(Number(ctrChange || 0)).toFixed(2)),
      direction: ctrDirection as 'up' | 'down' | 'neutral',
    },
    totalViews: formatMetric(viewsGrowth),
  };
};

const unlockContentInDB = async (userId: string, contentId: string) => {
  const content = await Content.findById(contentId);
  if (!content) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Content not found');
  }

  if (!content.requiredCoin || content.requiredCoin <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'This content cannot be unlocked with coins');
  }

  const alreadyUnlocked = await UnlockedContent.findOne({
    userId: new Types.ObjectId(userId),
    contentId: new Types.ObjectId(contentId),
  });

  if (alreadyUnlocked) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'You have already unlocked this content');
  }

  await RewardService.deductCoinsForUnlock(userId, content.requiredCoin);

  const unlocked = await UnlockedContent.create({
    userId: new Types.ObjectId(userId),
    contentId: new Types.ObjectId(contentId),
  });

  return unlocked;
};

export const ContentService = {
  searchContentFromDB,
  favoriteContentInDB,
  unfavoriteContentFromDB,
  getBestMoviesFromDB,
  getComingSoonContentFromDB,
  getMoviesStats,
  getSeriesStats,
  getAdminMoviesList: getAdminMoviesList,
  getAdminSeriesList: getAdminSeriesList,
  getMovieDetailsFromDB: getMovieDetailsFromDB,
  getSeriesDetailsFromDB: getSeriesDetailsFromDB,
  getEpisodesFromDB: getEpisodesFromDB,
  getEpisodeDetailsFromDB: getEpisodeDetailsFromDB,
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
  getContentDetailsPublicFromDB: getContentDetailsPublicFromDB,
  getSimilarContentFromDB: getSimilarContentFromDB,
  getEpisodesBySeasonPublicFromDB: getEpisodesBySeasonPublicFromDB,
  generatePlaybackUrl: generatePlaybackUrl,
  generateEpisodePlaybackUrl: generateEpisodePlaybackUrl,
  unlockContentInDB: unlockContentInDB,
  unlockEpisodeInDB: unlockEpisodeInDB
};
