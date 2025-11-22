const vscode = require('vscode');
const path = require('path');
const { TextEncoder, TextDecoder } = require('util');

/**
 * Define templates here.
 * Each template controls which files to include/exclude.
 */
const TEMPLATES = [
  {
    id: 'react_vite_ts_tailwind',
    label: 'React + Vite + TypeScript + Tailwind',
    description: 'Typical Vite+React+TS+Tailwind project: src, config files, docs.',
    include: new vscode.RelativePattern(
      vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : '',
      '**/*.{ts,tsx,js,jsx,html,css,scss,sass,json,md,cjs,mjs}'
    ),
    // Exclude heavy/generated & config dirs
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'generic_web',
    label: 'Generic Web Project',
    description: 'HTML, CSS, JS/TS, configs, docs.',
    include: new vscode.RelativePattern(
      vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : '',
      '**/*.{ts,tsx,js,jsx,html,css,scss,sass,json,md}'
    ),
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'all_text_code',
    label: 'All text & code files',
    description: 'Any .txt, .md, code, configs – for broad export.',
    include: new vscode.RelativePattern(
      vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : '',
      '**/*.{txt,md,ts,tsx,js,jsx,html,css,scss,sass,json,cjs,mjs,kt,java,py,php,rb,go,rs}'
    ),
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'node_express_api',
    label: 'Node + Express API',
    description: 'Exports JS/TS, JSON, env examples, docs for a Node/Express API.',
    include: new vscode.RelativePattern(
        vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : '',
        '**/*.{js,jsx,ts,tsx,json,md}'
    ),
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage}/**'
  },
];

function getTemplatesForCurrentWorkspace() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }
  const root = workspaceFolders[0];
  // Rebuild templates with correct RelativePattern bound to current workspace
  return TEMPLATES.map(t => ({
    ...t,
    include: new vscode.RelativePattern(root, t.include.pattern || t.include),
    exclude: t.exclude
  }));
}

/**
 * Core export logic
 */
async function exportWithTemplate(template) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder is open.');
    return;
  }

  const rootFolder = workspaceFolders[0];
  const rootUri = rootFolder.uri;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8');

  vscode.window.showInformationMessage(
    `Exporting workspace using template: ${template.label}…`
  );

  // Find files
  const files = await vscode.workspace.findFiles(template.include, template.exclude);

  if (!files || files.length === 0) {
    vscode.window.showWarningMessage('No matching files found for this template.');
    return;
  }

  // Sort by relative path
  const sortedFiles = files.sort((a, b) => {
    const relA = vscode.workspace.asRelativePath(a, false);
    const relB = vscode.workspace.asRelativePath(b, false);
    return relA.localeCompare(relB);
  });

  let outputContent = '';
  for (const fileUri of sortedFiles) {
    const relPath = vscode.workspace.asRelativePath(fileUri, false);

    try {
      const bytes = await vscode.workspace.fs.readFile(fileUri);
      const text = decoder.decode(bytes);

      const HEADER_BEGIN = '<<<WORKSPACE_EXPORTER_FILE_BEGIN>>>';
      const HEADER_END = '<<<WORKSPACE_EXPORTER_FILE_END>>>';

      outputContent += `${HEADER_BEGIN} path="${relPath}"\n`;
      outputContent += text;
      outputContent += `\n${HEADER_END} path="${relPath}"\n\n`;
    } catch (err) {
      console.error(`Failed to read ${fileUri.toString()}:`, err);
      outputContent += `===== FILE: ${relPath} (ERROR READING FILE) =====\n\n`;
    }
  }

  const outputFileName = `${rootFolder.name}_${template.id}_export.txt`;
  const outputUri = vscode.Uri.joinPath(rootUri, outputFileName);

  try {
    await vscode.workspace.fs.writeFile(outputUri, encoder.encode(outputContent));
    vscode.window.showInformationMessage(
      `Export complete: ${outputFileName}`,
      'Open file'
    ).then(choice => {
      if (choice === 'Open file') {
        vscode.window.showTextDocument(outputUri);
      }
    });
  } catch (err) {
    console.error('Failed to write export file:', err);
    vscode.window.showErrorMessage('Failed to write export file. See console for details.');
  }
}

/**
 * Command handler: show Quick Pick, then run export
 */
async function handleExportCommand() {
  const templates = getTemplatesForCurrentWorkspace();

  if (templates.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open, cannot export.');
    return;
  }

  const picked = await vscode.window.showQuickPick(
    templates.map(t => ({
      label: t.label,
      description: t.description,
      template: t
    })),
    {
      placeHolder: 'Select an export template'
    }
  );

  if (!picked) {
    return; // user cancelled
  }

  await exportWithTemplate(picked.template);
}

function activate(context) {
  let disposable = vscode.commands.registerCommand(
    'workspaceExporter.exportWithTemplate',
    handleExportCommand
  );

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
