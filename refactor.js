const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project();
project.addSourceFilesAtPaths("src/app/modules/**/*.ts");

function moveFunctions(sourceFile, destFile, functionNames, sourceExportName, destExportName) {
    const sourceExports = sourceFile.getVariableDeclaration(sourceExportName).getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    const destExports = destFile.getVariableDeclaration(destExportName).getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);

    for (const funcName of functionNames) {
        // Find function declaration or variable declaration
        let stmt = sourceFile.getVariableStatement(stmt => stmt.getDeclarations().some(d => d.getName() === funcName));
        if (stmt) {
            destFile.addVariableStatement(stmt.getStructure());
            stmt.remove();
        } else {
            console.log("Could not find function:", funcName, "in", sourceFile.getFilePath());
        }

        // Move export property
        const prop = sourceExports.getProperty(funcName);
        if (prop) {
            prop.remove();
            destExports.addPropertyAssignment({ name: funcName, initializer: funcName });
        }
    }
}

async function refactor() {
    const adminCtrl = project.getSourceFileOrThrow('src/app/modules/admin/admin.controller.ts');
    const contentCtrl = project.getSourceFileOrThrow('src/app/modules/content/content.controller.ts');

    const adminService = project.getSourceFileOrThrow('src/app/modules/admin/admin.service.ts');
    const contentService = project.getSourceFileOrThrow('src/app/modules/content/content.service.ts');

    const ctrlFunctions = [
        'getAdminMovies', 'getAdminSeries', 'getSeriesDetails', 'createSeason', 'getSeasons', 
        'updateSeason', 'deleteSeason', 'getEpisodes', 'createEpisode', 'updateEpisode', 
        'deleteEpisode', 'createMovie', 'createSeries', 'updateSeries', 'deleteSeries', 
        'updateSeriesStatus', 'updateMovie', 'deleteMovie', 'updateMovieStatus', 
        'initiateUpload', 'getPresignedUrls', 'completeUpload'
    ];

    const serviceFunctions = [
        'getAdminMoviesList', 'getAdminSeriesList', 'getSeriesDetailsFromDB', 
        'getEpisodesFromDB', 'createEpisodeToDB', 'updateEpisodeInDB', 
        'deleteEpisodeFromDB', 'createMovieToDB', 'createSeriesToDB', 
        'updateSeriesInDB', 'deleteSeriesFromDB', 'updateSeriesStatusInDB', 
        'updateMovieInDB', 'deleteMovieFromDB', 'updateMovieStatusInDB', 
        'initiateMultipartUpload', 'generateMultipartPresignedUrls', 'completeMultipartUpload',
        'createSeasonToDB', 'getSeasonsBySeriesFromDB', 'updateSeasonInDB', 'deleteSeasonFromDB'
    ];

    moveFunctions(adminCtrl, contentCtrl, ctrlFunctions, 'AdminController', 'ContentController');
    moveFunctions(adminService, contentService, serviceFunctions, 'AdminService', 'ContentService');

    // Make sure we save everything
    await project.save();
    console.log("Moved functions successfully!");
}

refactor().catch(console.error);
