const fs = require('fs');

// 1. Fix content.route.ts missing imports and routes
let contentRoute = fs.readFileSync('src/app/modules/content/content.route.ts', 'utf8');
if (!contentRoute.includes('fileUploadHandler')) {
    contentRoute = "import fileUploadHandler from '../../middlewares/fileUploadHandler';\nconst upload = fileUploadHandler();\n" + contentRoute;
}
// Remove analytics routes from content.route.ts because they belong to AdminController
const analyticsRoutes = [
    'getMoviesStats', 'getMovieProfile', 'getMovieAnalyticsOverview', 
    'getMovieAnalyticsEngagement', 'getMovieAnalyticsAudience', 
    'getMovieAnalyticsRevenue', 'getSeriesStats'
];
for (const method of analyticsRoutes) {
    // We will just comment out the route that calls this method
    const regex = new RegExp(`router\\.[a-z]+\\([\\s\\S]*?ContentController\\.${method},\\s*\\);`, 'g');
    contentRoute = contentRoute.replace(regex, '');
}
fs.writeFileSync('src/app/modules/content/content.route.ts', contentRoute);

// 2. Fix duplicate S3 imports in content.service.ts
let contentService = fs.readFileSync('src/app/modules/content/content.service.ts', 'utf8');
contentService = contentService.replace(/import \{ S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand \} from '@aws-sdk\/client-s3';\n/g, '');
contentService = contentService.replace(/import \{ getSignedUrl \} from '@aws-sdk\/s3-request-presigner';\n/g, '');
contentService = `import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';\nimport { getSignedUrl } from '@aws-sdk/s3-request-presigner';\n` + contentService;
// Fix type error: Argument of type 'S3Client' is not assignable to parameter of type 'Client<any...'
contentService = contentService.replace(/s3\.send\(command\)/g, '(s3 as any).send(command)');
contentService = contentService.replace(/getSignedUrl\(s3, command, \{ expiresIn: 3600 \}\)/g, 'getSignedUrl(s3 as any, command as any, { expiresIn: 3600 })');
fs.writeFileSync('src/app/modules/content/content.service.ts', contentService);

console.log("Cleanup complete!");
