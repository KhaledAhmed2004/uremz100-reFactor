import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { ContentService } from './content.service';
import { StatusCodes } from "http-status-codes";

const searchContent = catchAsync(async (req: Request, res: Response) => {
  const result = await ContentService.searchContentFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Content searched successfully',
    meta: result.pagination,
    data: result.data,
  });
});

const favoriteContent = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const { contentId } = req.params;
  const result = await ContentService.favoriteContentInDB(user.id, contentId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Content favorited successfully',
    data: result,
  });
});

const unfavoriteContent = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const { contentId } = req.params;
  const result = await ContentService.unfavoriteContentFromDB(user.id, contentId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Content unfavorited successfully',
    data: result,
  });
});

const getBestMovies = catchAsync(async (req: Request, res: Response) => {
  const result = await ContentService.getBestMoviesFromDB();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Best movies retrieved successfully',
    data: result,
  });
});

const getComingSoonContent = catchAsync(async (req: Request, res: Response) => {
  const result = await ContentService.getComingSoonContentFromDB();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Coming soon content retrieved successfully',
    data: result,
  });
});


const getAdminMovies = catchAsync(async (req: Request, res: Response) => {
  const result = await ContentService.getAdminMoviesList(req.query);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Movies list fetched',
    // @ts-ignore
    pagination: result.pagination,
    data: result.data,
  });
});
const getAdminSeries = catchAsync(async (req: Request, res: Response) => {
  const result = await ContentService.getAdminSeriesList(req.query);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Series list fetched',
    // @ts-ignore
    pagination: result.pagination,
    data: result.data,
  });
});
const getSeriesDetails = catchAsync(async (req: Request, res: Response) => {
  const result = await ContentService.getSeriesDetailsFromDB(req.params.seriesId);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Series details retrieved successfully',
    data: result,
  });
});
const createSeason = catchAsync(async (req: Request, res: Response) => {
  const { seriesId } = req.params;
  const payload = { ...req.body };

  if (req.files) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files['posterFile']) {
      payload.poster = (files['posterFile'][0] as any).location || files['posterFile'][0].path;
    }
  }

  const result = await ContentService.createSeasonToDB(seriesId, payload);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Season created successfully',
    data: result,
  });
});
const getSeasons = catchAsync(async (req: Request, res: Response) => {
  const { seriesId } = req.params;
  const result = await ContentService.getSeasonsBySeriesFromDB(seriesId);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Seasons retrieved successfully',
    data: result,
  });
});
const updateSeason = catchAsync(async (req: Request, res: Response) => {
  const { seasonId } = req.params;
  const payload = { ...req.body };

  if (req.files) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files['posterFile']) {
      payload.poster = (files['posterFile'][0] as any).location || files['posterFile'][0].path;
    }
  }

  const result = await ContentService.updateSeasonInDB(seasonId, payload);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Season updated successfully',
    data: result,
  });
});
const deleteSeason = catchAsync(async (req: Request, res: Response) => {
  const { seasonId } = req.params;
  await ContentService.deleteSeasonFromDB(seasonId);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Season deleted successfully',
    data: null,
  });
});
const getEpisodes = catchAsync(async (req: Request, res: Response) => {
  const result = await ContentService.getEpisodesFromDB(
    req.params.seriesId,
    req.query,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Episodes list fetched',
    // @ts-ignore
    pagination: result.pagination,
    data: result.data,
  });
});
const createEpisode = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };

  if (req.files) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files['videoFile'])
      payload.videoUrl =
        (files['videoFile'][0] as any).location || files['videoFile'][0].path;
    if (files['thumbnailFile'])
      payload.thumbnail =
        (files['thumbnailFile'][0] as any).location ||
        files['thumbnailFile'][0].path;
  }

  const result = await ContentService.createEpisodeToDB(
    req.params.seriesId,
    payload,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Episode created successfully',
    data: result,
  });
});
const updateEpisode = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };

  if (req.files) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files['videoFile'])
      payload.videoUrl =
        (files['videoFile'][0] as any).location || files['videoFile'][0].path;
    if (files['thumbnailFile'])
      payload.thumbnail =
        (files['thumbnailFile'][0] as any).location ||
        files['thumbnailFile'][0].path;
  }

  const result = await ContentService.updateEpisodeInDB(
    req.params.episodeId,
    payload,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Episode updated successfully',
    data: result,
  });
});
const deleteEpisode = catchAsync(async (req: Request, res: Response) => {
  await ContentService.deleteEpisodeFromDB(req.params.episodeId);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Episode deleted successfully',
    data: null,
  });
});
const createMovie = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };

  // Handle files from fileUploadHandler
  if (req.files) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files['videoFile']) payload.videoUrl = (files['videoFile'][0] as any).location || files['videoFile'][0].path;
    if (files['trailerFile']) payload.trailerUrl = (files['trailerFile'][0] as any).location || files['trailerFile'][0].path;
    if (files['posterFile']) payload.poster = (files['posterFile'][0] as any).location || files['posterFile'][0].path;
    if (files['thumbnailFile']) payload.thumbnail = (files['thumbnailFile'][0] as any).location || files['thumbnailFile'][0].path;
  }

  const result = await ContentService.createMovieToDB(payload);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Movie created successfully',
    data: result,
  });
});
const createSeries = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };

  // Handle files from fileUploadHandler
  if (req.files) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files['trailerFile'])
      payload.trailerUrl =
        (files['trailerFile'][0] as any).location || files['trailerFile'][0].path;
    if (files['posterFile'])
      payload.poster =
        (files['posterFile'][0] as any).location || files['posterFile'][0].path;
    if (files['thumbnailFile'])
      payload.thumbnail =
        (files['thumbnailFile'][0] as any).location ||
        files['thumbnailFile'][0].path;
  }

  const result = await ContentService.createSeriesToDB(payload);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Series created successfully',
    data: result,
  });
});
const updateSeries = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };

  // Handle files from fileUploadHandler
  if (req.files) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files['trailerFile'])
      payload.trailerUrl =
        (files['trailerFile'][0] as any).location || files['trailerFile'][0].path;
    if (files['posterFile'])
      payload.poster =
        (files['posterFile'][0] as any).location || files['posterFile'][0].path;
    if (files['thumbnailFile'])
      payload.thumbnail =
        (files['thumbnailFile'][0] as any).location ||
        files['thumbnailFile'][0].path;
  }

  const result = await ContentService.updateSeriesInDB(
    req.params.seriesId,
    payload,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Series updated successfully',
    data: result,
  });
});
const deleteSeries = catchAsync(async (req: Request, res: Response) => {
  await ContentService.deleteSeriesFromDB(req.params.seriesId);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Series deleted successfully',
    data: null,
  });
});
const updateSeriesStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await ContentService.updateSeriesStatusInDB(
    req.params.seriesId,
    req.body.status,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Series status updated successfully',
    data: result,
  });
});
const updateMovie = catchAsync(async (req: Request, res: Response) => {
  const { movieId } = req.params;
  const payload = { ...req.body };

  // Handle files if updated
  if (req.files) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files['videoFile']) payload.videoUrl = (files['videoFile'][0] as any).location || files['videoFile'][0].path;
    if (files['trailerFile']) payload.trailerUrl = (files['trailerFile'][0] as any).location || files['trailerFile'][0].path;
    if (files['posterFile']) payload.poster = (files['posterFile'][0] as any).location || files['posterFile'][0].path;
    if (files['thumbnailFile']) payload.thumbnail = (files['thumbnailFile'][0] as any).location || files['thumbnailFile'][0].path;
  }

  const result = await ContentService.updateMovieInDB(movieId, payload);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Movie updated successfully',
    data: result,
  });
});
const deleteMovie = catchAsync(async (req: Request, res: Response) => {
  const { movieId } = req.params;
  await ContentService.deleteMovieFromDB(movieId);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Movie deleted',
  });
});
const updateMovieStatus = catchAsync(async (req: Request, res: Response) => {
  const { movieId } = req.params;
  const { status } = req.body;
  const result = await ContentService.updateMovieStatusInDB(movieId, status);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Movie status updated successfully',
    data: result,
  });
});
const initiateUpload = catchAsync(async (req: Request, res: Response) => {
  const { fileName, contentType } = req.body;
  const result = await ContentService.initiateMultipartUpload(fileName, contentType);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Upload initiated successfully',
    data: result,
  });
});
const getPresignedUrls = catchAsync(async (req: Request, res: Response) => {
  const { uploadId, key, partNumbers } = req.body;
  const result = await ContentService.generateMultipartPresignedUrls(uploadId, key, partNumbers);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Presigned URLs generated successfully',
    data: result,
  });
});
const completeUpload = catchAsync(async (req: Request, res: Response) => {
  const { uploadId, key, parts } = req.body;
  const result = await ContentService.completeMultipartUpload(uploadId, key, parts);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Upload completed successfully',
    data: result,
  });
});


export const ContentController = {
  searchContent,
  favoriteContent,
  unfavoriteContent,
  getBestMovies,
  getComingSoonContent,
  getAdminMovies: getAdminMovies,
  getAdminSeries: getAdminSeries,
  getSeriesDetails: getSeriesDetails,
  createSeason: createSeason,
  getSeasons: getSeasons,
  updateSeason: updateSeason,
  deleteSeason: deleteSeason,
  getEpisodes: getEpisodes,
  createEpisode: createEpisode,
  updateEpisode: updateEpisode,
  deleteEpisode: deleteEpisode,
  createMovie: createMovie,
  createSeries: createSeries,
  updateSeries: updateSeries,
  deleteSeries: deleteSeries,
  updateSeriesStatus: updateSeriesStatus,
  updateMovie: updateMovie,
  deleteMovie: deleteMovie,
  updateMovieStatus: updateMovieStatus,
  initiateUpload: initiateUpload,
  getPresignedUrls: getPresignedUrls,
  completeUpload: completeUpload
};
