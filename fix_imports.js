const { Project } = require('ts-morph');
const fs = require('fs');

async function fixImports() {
    const project = new Project();
    project.addSourceFilesAtPaths("src/app/modules/**/*.ts");

    const contentCtrl = project.getSourceFileOrThrow('src/app/modules/content/content.controller.ts');
    const contentService = project.getSourceFileOrThrow('src/app/modules/content/content.service.ts');
    const adminCtrl = project.getSourceFileOrThrow('src/app/modules/admin/admin.controller.ts');
    const adminService = project.getSourceFileOrThrow('src/app/modules/admin/admin.service.ts');

    contentCtrl.fixMissingImports();
    contentService.fixMissingImports();
    adminCtrl.fixMissingImports();
    adminService.fixMissingImports();

    // Sometimes fixMissingImports removes unused imports, let's also remove unused imports.
    contentCtrl.fixUnusedIdentifiers();
    contentService.fixUnusedIdentifiers();
    adminCtrl.fixUnusedIdentifiers();
    adminService.fixUnusedIdentifiers();

    await project.save();
    console.log("Fixed imports successfully!");
}

fixImports().catch(console.error);
