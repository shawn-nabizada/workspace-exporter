import * as vscode from 'vscode';
import { TextEncoder, TextDecoder } from 'util';

const HEADER_BEGIN = '<<<WORKSPACE_EXPORTER_FILE_BEGIN>>>';
const HEADER_END = '<<<WORKSPACE_EXPORTER_FILE_END>>>';

interface TemplateDefinition {
  id: string;
  label: string;
  description: string;
  pattern: string;        // glob pattern
  exclude: string;        // exclude glob
}

interface RuntimeTemplate extends TemplateDefinition {
  include: vscode.RelativePattern;
}

/**
 * Define templates here.
 * Each template controls which files to include/exclude.
 *
 * These are "definitions" that will be bound to the current workspace
 * as vscode.RelativePattern instances in getTemplatesForCurrentWorkspace().
 */
const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    id: 'react_vite_ts_tailwind',
    label: 'React + Vite + TypeScript + Tailwind',
    description: 'Typical Vite+React+TS+Tailwind project: src, config files, docs.',
    pattern: '**/*.{ts,tsx,js,jsx,html,css,scss,sass,json,md,cjs,mjs}',
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'generic_web',
    label: 'Generic Web Project',
    description: 'HTML, CSS, JS/TS, configs, docs.',
    pattern: '**/*.{ts,tsx,js,jsx,html,css,scss,sass,json,md}',
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'all_text_code',
    label: 'All text & code files',
    description: 'Any .txt, .md, code, configs – for broad export.',
    pattern: '**/*.{txt,md,ts,tsx,js,jsx,html,css,scss,sass,json,cjs,mjs,kt,java,py,php,rb,go,rs}',
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'node_express_api',
    label: 'Node + Express API',
    description: 'Exports JS/TS, JSON, env examples, docs for a Node/Express API.',
    pattern: '**/*.{js,jsx,ts,tsx,json,md}',
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage}/**'
  }
];

/**
 * Bind template definitions to the current workspace
 * by turning patterns into vscode.RelativePattern instances.
 */
function getTemplatesForCurrentWorkspace(): RuntimeTemplate[] {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }

  const root = workspaceFolders[0];

  return TEMPLATE_DEFINITIONS.map(def => ({
    ...def,
    include: new vscode.RelativePattern(root, def.pattern)
  }));
}

/**
 * Core export logic
 */
async function exportWithTemplate(template: RuntimeTemplate): Promise<void> {
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

      outputContent += `${HEADER_BEGIN} path="${relPath}"\n`;
      outputContent += text;
      outputContent += `\n${HEADER_END} path="${relPath}"\n\n`;
    } catch (err) {
      console.error(`Failed to read ${fileUri.toString()}:`, err);
      outputContent += `${HEADER_BEGIN} path="${relPath}"\n`;
      outputContent += `ERROR READING FILE\n`;
      outputContent += `${HEADER_END} path="${relPath}"\n\n`;
    }
  }

  const outputFileName = `${rootFolder.name}_${template.id}_export.txt`;
  const outputUri = vscode.Uri.joinPath(rootUri, outputFileName);

  try {
    await vscode.workspace.fs.writeFile(outputUri, encoder.encode(outputContent));
    vscode.window
      .showInformationMessage(`Export complete: ${outputFileName}`, 'Open file')
      .then(choice => {
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
async function handleExportCommand(): Promise<void> {
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

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    'workspaceExporter.exportWithTemplate',
    handleExportCommand
  );

  context.subscriptions.push(disposable);
}

export function deactivate(): void {
  // no-op for now
}
