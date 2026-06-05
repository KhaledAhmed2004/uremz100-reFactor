import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { GenreService } from './genre.service';

const getAll = catchAsync(async (req: Request, res: Response) => {
  const result = await GenreService.getGenresFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Genres fetched successfully',
    meta: result.pagination,
    data: result.data,
  });
});

const createGenre = catchAsync(async (req: Request, res: Response) => {
  const result = await GenreService.createGenreToDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Genre created successfully',
    data: result,
  });
});

const updateById = catchAsync(async (req: Request, res: Response) => {
  const { genreId } = req.params;
  const result = await GenreService.updateGenreInDB(genreId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Genre updated successfully',
    data: result,
  });
});



const bulkDelete = catchAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;
  const result = await GenreService.bulkDeleteGenresFromDB(ids);

  const isPartial = result.failedCount > 0 && result.deletedCount > 0;
  const allFailed = result.deletedCount === 0;

  const statusCode = allFailed
    ? httpStatus.NOT_FOUND
    : isPartial
      ? 207
      : httpStatus.OK;

  const message = allFailed
    ? 'No genres were found to delete'
    : isPartial
      ? 'Bulk delete partially completed'
      : 'Genres deleted successfully';

  sendResponse(res, {
    statusCode,
    success: !allFailed,
    message,
    data: result,
  });
});

export const GenreController = {
  getAll,
  createGenre,
  updateById,
  bulkDelete,
};
