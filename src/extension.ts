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
 * Define built-in templates here.
 */
const BUILTIN_TEMPLATES: TemplateDefinition[] = [
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
 * Get templates merging built-in and user-defined ones.
 */
function getTemplatesForCurrentWorkspace(): RuntimeTemplate[] {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }

  const root = workspaceFolders[0];
  const config = vscode.workspace.getConfiguration('workspaceExporter');
  const customTemplates = config.get<TemplateDefinition[]>('customTemplates', []);

  const allTemplates = [...BUILTIN_TEMPLATES, ...customTemplates];

  return allTemplates.map(def => ({
    ...def,
    include: new vscode.RelativePattern(root, def.pattern)
  }));
}

/**
 * Get global excludes from configuration.
 */
function getGlobalExcludes(): string[] {
  const config = vscode.workspace.getConfiguration('workspaceExporter');
  return config.get<string[]>('globalExcludes', []);
}

/**
 * Format the output content based on the selected format.
 */
function formatOutput(filesContent: { path: string; content: string }[], format: string): string {
  if (format === 'xml') {
    return `<workspace>\n${filesContent.map(f =>
      `  <file path="${f.path}">\n    <![CDATA[\n${f.content}\n    ]]>\n  </file>`
    ).join('\n')}\n</workspace>`;
  } else if (format === 'markdown') {
    return filesContent.map(f => {
      const ext = f.path.split('.').pop() || '';
      return `## File: ${f.path}\n\`\`\`${ext}\n${f.content}\n\`\`\`\n`;
    }).join('\n');
  } else {
    // Default to text format
    return filesContent.map(f =>
      `${HEADER_BEGIN} path="${f.path}"\n${f.content}\n${HEADER_END} path="${f.path}"\n`
    ).join('\n');
  }
}

/**
 * Estimate token count (simple char/4 heuristic).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Generate a visual file tree from a list of relative paths.
 */
function generateFileTree(paths: string[]): string {
  const tree: any = {};

  // Build tree structure
  paths.forEach(path => {
    const parts = path.split('/');
    let current = tree;
    parts.forEach(part => {
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    });
  });

  // Render tree
  let output = 'Project Structure:\n';

  function renderNode(node: any, prefix: string, isLast: boolean) {
    const keys = Object.keys(node).sort((a, b) => {
      // Directories first, then files
      const aIsDir = Object.keys(node[a]).length > 0;
      const bIsDir = Object.keys(node[b]).length > 0;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    });

    keys.forEach((key, index) => {
      const isLastChild = index === keys.length - 1;
      const connector = isLastChild ? '└── ' : '├── ';
      const childPrefix = isLastChild ? '    ' : '│   ';

      output += `${prefix}${connector}${key}\n`;

      if (Object.keys(node[key]).length > 0) {
        renderNode(node[key], prefix + childPrefix, isLastChild);
      }
    });
  }

  renderNode(tree, '', true);
  return output + '\n' + '='.repeat(50) + '\n\n';
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
  const decoder = new TextDecoder('utf-8');

  vscode.window.showInformationMessage(
    `Exporting workspace using template: ${template.label}…`
  );

  // Get global excludes and merge with template exclude
  const globalExcludes = getGlobalExcludes();
  const excludePattern = globalExcludes.length > 0
    ? `{${template.exclude},${globalExcludes.join(',')}}`
    : template.exclude;

  // Find files
  const files = await vscode.workspace.findFiles(template.include, excludePattern);

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

  const filesContent: { path: string; content: string }[] = [];
  const relativePaths: string[] = [];

  for (const fileUri of sortedFiles) {
    const relPath = vscode.workspace.asRelativePath(fileUri, false);
    relativePaths.push(relPath);
    try {
      const bytes = await vscode.workspace.fs.readFile(fileUri);
      const text = decoder.decode(bytes);
      filesContent.push({ path: relPath, content: text });
    } catch (err) {
      console.error(`Failed to read ${fileUri.toString()}:`, err);
      filesContent.push({ path: relPath, content: 'ERROR READING FILE' });
    }
  }

  // Get configuration
  const config = vscode.workspace.getConfiguration('workspaceExporter');
  const outputFormat = config.get<string>('outputFormat', 'text');
  const copyToClipboard = config.get<boolean>('copyToClipboard', false);
  const includeFileTree = config.get<boolean>('includeFileTree', true);

  let outputContent = '';

  if (includeFileTree && outputFormat !== 'xml') {
    outputContent += generateFileTree(relativePaths);
  }

  outputContent += formatOutput(filesContent, outputFormat);
  const tokenCount = estimateTokens(outputContent);

  // Handle Clipboard
  if (copyToClipboard) {
    await vscode.env.clipboard.writeText(outputContent);
    vscode.window.showInformationMessage(`Exported ${files.length} files to clipboard (~${tokenCount} tokens).`);
  } else {
    // Write to file
    const outputFileName = `${rootFolder.name}_${template.id}_export.${outputFormat === 'xml' ? 'xml' : outputFormat === 'markdown' ? 'md' : 'txt'}`;
    const outputUri = vscode.Uri.joinPath(rootUri, outputFileName);
    const encoder = new TextEncoder();

    try {
      await vscode.workspace.fs.writeFile(outputUri, encoder.encode(outputContent));
      vscode.window
        .showInformationMessage(`Export complete: ${outputFileName} (~${tokenCount} tokens)`, 'Open file')
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
