import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { MyCollectionService } from './my-collection.service';

const addToCollection = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const result = await MyCollectionService.addToCollectionInDB(user.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Added to collection successfully',
    data: result,
  });
});

const removeFromCollection = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { collectionId } = req.params;
  await MyCollectionService.removeFromCollectionFromDB(user.id, collectionId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Removed from collection successfully',
    data: null,
  });
});

const getMyCollection = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const result = await MyCollectionService.getMyCollectionFromDB(user.id, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My collection retrieved successfully',
    // @ts-ignore
    pagination: result.pagination,
    data: result.data,
  });
});

export const MyCollectionController = {
  addToCollection,
  removeFromCollection,
  getMyCollection,
};
