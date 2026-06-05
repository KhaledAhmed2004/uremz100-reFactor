const fs = require('fs');

function moveExportToBottom(filePath, exportName) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Regex to match the export block
    const exportRegex = new RegExp(`export const ${exportName} = \\{[\\s\\S]*?\\};`);
    const match = content.match(exportRegex);
    
    if (match) {
        // Remove the block from its current position
        content = content.replace(match[0], '');
        // Append it to the bottom
        content += '\n\n' + match[0] + '\n';
        fs.writeFileSync(filePath, content);
        console.log(`Moved ${exportName} to bottom of ${filePath}`);
    } else {
        console.log(`Could not find ${exportName} in ${filePath}`);
    }
}

moveExportToBottom('src/app/modules/content/content.service.ts', 'ContentService');
moveExportToBottom('src/app/modules/content/content.controller.ts', 'ContentController');
moveExportToBottom('src/app/modules/admin/admin.service.ts', 'AdminService');
moveExportToBottom('src/app/modules/admin/admin.controller.ts', 'AdminController');
