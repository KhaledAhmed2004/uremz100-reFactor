const fs = require('fs');

// 1. Fix USER_ROLES in content.route.ts
let contentRoute = fs.readFileSync('src/app/modules/content/content.route.ts', 'utf8');
contentRoute = contentRoute.replace(/USER_ROLES\.USER/g, 'USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH');
fs.writeFileSync('src/app/modules/content/content.route.ts', contentRoute);

// 2. Fix r2 and s3 in content.service.ts
let contentService = fs.readFileSync('src/app/modules/content/content.service.ts', 'utf8');
// Fix config.r2 issue - this project seems to use config without r2 in types, so we use any
contentService = contentService.replace(/config\.r2/g, '(config as any).r2');

// Fix s3 imports
const s3Imports = `
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

if (!contentService.includes('S3Client')) {
    contentService = contentService.replace('import config', s3Imports + '\nimport config');
}

fs.writeFileSync('src/app/modules/content/content.service.ts', contentService);

console.log("Fixed content.route.ts and content.service.ts");
