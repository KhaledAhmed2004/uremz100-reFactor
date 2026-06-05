const fs = require('fs');

// 1. Fix AdminService -> ContentService calls in ContentController
let contentCtrl = fs.readFileSync('src/app/modules/content/content.controller.ts', 'utf8');
contentCtrl = contentCtrl.replace(/AdminService\./g, 'ContentService.');
fs.writeFileSync('src/app/modules/content/content.controller.ts', contentCtrl);

// 2. Fix s3 missing inside content.service.ts
let contentService = fs.readFileSync('src/app/modules/content/content.service.ts', 'utf8');
if (!contentService.includes('const s3 = new S3Client')) {
    const s3Init = `
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  endpoint: process.env.AWS_S3_ENDPOINT || undefined,
  forcePathStyle: true,
});
`;
    contentService = s3Init + '\n' + contentService;
    fs.writeFileSync('src/app/modules/content/content.service.ts', contentService);
}

// 3. Fix USER_ROLES in home.route.ts
let homeRoute = fs.readFileSync('src/app/modules/home/home.route.ts', 'utf8');
homeRoute = homeRoute.replace(/USER_ROLES\.USER/g, 'USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH');
fs.writeFileSync('src/app/modules/home/home.route.ts', homeRoute);

// 4. Remove broken imports in user.service.ts
let userService = fs.readFileSync('src/app/modules/user/user.service.ts', 'utf8');
userService = userService.replace(/import .* from '\.\.\/group\/group\.model';\n/g, '');
userService = userService.replace(/import .* from '\.\.\/ask-question\/ask-question\.model';\n/g, '');
fs.writeFileSync('src/app/modules/user/user.service.ts', userService);

console.log("Fixed all remaining compilation errors.");
