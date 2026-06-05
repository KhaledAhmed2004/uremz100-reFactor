import { Request } from 'express';
import fs from 'fs';
import { StatusCodes } from 'http-status-codes';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import ApiError from '../../errors/ApiError';

const fileUploadHandler = () => {
  //create upload folder
  const baseUploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(baseUploadDir)) {
    fs.mkdirSync(baseUploadDir);
  }

  //folder create for different file
  const createDir = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }
  };

  //create filename
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      let uploadDir;
      switch (file.fieldname) {
        case 'image':
        case 'posterFile':
        case 'thumbnailFile':
          uploadDir = path.join(baseUploadDir, 'image');
          break;
        case 'media':
        case 'videoFile':
        case 'trailerFile':
          uploadDir = path.join(baseUploadDir, 'media');
          break;
        case 'doc':
          uploadDir = path.join(baseUploadDir, 'doc');
          break;
        default:
          throw new ApiError(StatusCodes.BAD_REQUEST, 'File is not supported');
      }
      createDir(uploadDir);
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const fileExt = path.extname(file.originalname);
      const fileName =
        file.originalname
          .replace(fileExt, '')
          .toLowerCase()
          .split(' ')
          .join('-') +
        '-' +
        Date.now();
      cb(null, fileName + fileExt);
    },
  });

  //file filter
  const filterFilter = (req: Request, file: any, cb: FileFilterCallback) => {
    if (file.fieldname === 'image' || file.fieldname === 'posterFile' || file.fieldname === 'thumbnailFile') {
      if (
        file.mimetype === 'image/jpeg' ||
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg'
      ) {
        cb(null, true);
      } else {
        cb(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            'Only .jpeg, .png, .jpg file supported'
          )
        );
      }
    } else if (file.fieldname === 'media' || file.fieldname === 'videoFile' || file.fieldname === 'trailerFile') {
      const allowed = [
        'video/mp4',
        'video/webm',
        'video/x-matroska', // MKV
        'video/quicktime', // MOV
        'audio/mpeg',
        'audio/webm',
        'audio/ogg',
        'audio/wav',
        'audio/mp4',
      ];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            'Only mp4/webm (video) and mp3/webm/ogg/wav/mp4 (audio) supported'
          )
        );
      }
    } else if (file.fieldname === 'doc') {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new ApiError(StatusCodes.BAD_REQUEST, 'Only pdf supported'));
      }
    } else {
      cb(new ApiError(StatusCodes.BAD_REQUEST, 'This file is not supported'));
    }
  };

  const upload = multer({
    storage: storage,
    fileFilter: filterFilter,
    limits: {
      fileSize: 5 * 1024 * 1024 * 1024, // 5GB max overall
    }
  });

  return upload;
};

export default fileUploadHandler;
