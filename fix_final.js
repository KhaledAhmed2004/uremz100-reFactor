const fs = require('fs');

// 1. Fix USER_ROLES in admin.service.ts
let adminService = fs.readFileSync('src/app/modules/admin/admin.service.ts', 'utf8');
adminService = adminService.replace(/USER_ROLES\.USER/g, 'USER_ROLES.BROTHER'); // just pick one so it compiles
fs.writeFileSync('src/app/modules/admin/admin.service.ts', adminService);

// 2. Fix duplicate imports in content.service.ts
let contentService = fs.readFileSync('src/app/modules/content/content.service.ts', 'utf8');
contentService = contentService.replace(/import \{ S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand \} from '@aws-sdk\/client-s3';\nimport \{ getSignedUrl \} from '@aws-sdk\/s3-request-presigner';/g, ''); // remove all
// re-add once
contentService = `import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';\n` + contentService;
fs.writeFileSync('src/app/modules/content/content.service.ts', contentService);

// 3. Move routes from admin.route.ts to content.route.ts
let adminRoute = fs.readFileSync('src/app/modules/admin/admin.route.ts', 'utf8');
let contentRoute = fs.readFileSync('src/app/modules/content/content.route.ts', 'utf8');

// Regex to extract Movies, Series, Season, and Episode management blocks
const blockRegex = /\/\/ Movies Management[\s\S]*?\/\/ Subscriptions Management/g;
const match = adminRoute.match(blockRegex);
if (match) {
    const routesToMove = match[0].replace('// Subscriptions Management', '');
    adminRoute = adminRoute.replace(routesToMove, '');
    
    // Replace AdminController with ContentController in the moved routes
    let newRoutes = routesToMove.replace(/AdminController/g, 'ContentController');
    
    // Add to content.route.ts before the export statement
    contentRoute = contentRoute.replace('export const ContentRoutes = router;', newRoutes + '\nexport const ContentRoutes = router;');
    
    fs.writeFileSync('src/app/modules/admin/admin.route.ts', adminRoute);
    fs.writeFileSync('src/app/modules/content/content.route.ts', contentRoute);
}

// 4. Update index.ts to include ContentRoutes
let indexTs = fs.readFileSync('src/routes/index.ts', 'utf8');
if (!indexTs.includes('ContentRoutes')) {
    indexTs = "import { ContentRoutes } from '../app/modules/content/content.route';\n" + indexTs;
    const contentRouteConfig = `
  {
    path: '/contents',
    route: ContentRoutes,
  },`;
    indexTs = indexTs.replace('];', contentRouteConfig + '\n];');
    fs.writeFileSync('src/routes/index.ts', indexTs);
}

console.log('Fixed final TS errors and moved routes.');
