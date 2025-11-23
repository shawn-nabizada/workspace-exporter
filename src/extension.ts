import * as vscode from 'vscode';
import { TextEncoder, TextDecoder } from 'util';

const HEADER_BEGIN = '<<<WORKSPACE_EXPORTER_FILE_BEGIN>>>';
const HEADER_END = '<<<WORKSPACE_EXPORTER_FILE_END>>>';

interface TemplateDefinition {
  id: string;
  label: string;
  description: string;
  /** Glob pattern for file matching */
  pattern: string;
  /** Glob pattern for exclusion */
  exclude: string;
}

interface RuntimeTemplate extends TemplateDefinition {
  include: vscode.RelativePattern;
}

/**
 * Define built-in templates here.
 * These are the default presets available to the user.
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

  return allTemplates.map((def) => ({
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
    return `<workspace>\n${filesContent
      .map((f) => `  <file path="${f.path}">\n    <![CDATA[\n${f.content}\n    ]]>\n  </file>`)
      .join('\n')}\n</workspace>`;
  } else if (format === 'markdown') {
    return filesContent
      .map((f) => {
        const ext = f.path.split('.').pop() || '';
        return `## File: ${f.path}\n\`\`\`${ext}\n${f.content}\n\`\`\`\n`;
      })
      .join('\n');
  } else {
    // Default to text format
    return filesContent
      .map(
        (f) => `${HEADER_BEGIN} path="${f.path}"\n${f.content}\n${HEADER_END} path="${f.path}"\n`
      )
      .join('\n');
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
  const tree: Record<string, any> = {};

  // Build tree structure
  paths.forEach((path) => {
    const parts = path.split('/');
    let current = tree;
    parts.forEach((part) => {
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    });
  });

  // Render tree
  let output = 'Project Structure:\n';

  function renderNode(node: any, prefix: string) {
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
        renderNode(node[key], prefix + childPrefix);
      }
    });
  }

  renderNode(tree, '');
  return output + '\n' + '='.repeat(50) + '\n\n';
}

import * as cp from 'child_process';
import * as path from 'path';

/**
 * Get files from Git (staged or changed).
 */
async function getGitFiles(type: 'staged' | 'changes'): Promise<vscode.Uri[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }
  const rootPath = workspaceFolders[0].uri.fsPath;

  return new Promise((resolve) => {
    const command =
      type === 'staged' ? 'git diff --name-only --cached' : 'git diff --name-only HEAD';

    cp.exec(command, { cwd: rootPath }, (err, stdout) => {
      if (err) {
        console.error('Git command failed:', err);
        // Fallback or empty if git fails (e.g. not a repo)
        resolve([]);
        return;
      }

      const lines = stdout.split('\n').filter((line) => line.trim() !== '');
      const uris = lines.map((line) => vscode.Uri.file(path.join(rootPath, line.trim())));
      resolve(uris);
    });
  });
}

/**
 * Core export logic
 */
async function exportWithTemplate(
  template: RuntimeTemplate | null,
  specificFiles?: vscode.Uri[]
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder is open.');
    return;
  }

  const rootFolder = workspaceFolders[0];
  const rootUri = rootFolder.uri;
  const decoder = new TextDecoder('utf-8');

  let files: vscode.Uri[] = [];

  if (specificFiles) {
    files = specificFiles;
    vscode.window.showInformationMessage(`Exporting ${files.length} specific files…`);
  } else if (template) {
    vscode.window.showInformationMessage(`Exporting workspace using template: ${template.label}…`);

    // Get global excludes and merge with template exclude
    const globalExcludes = getGlobalExcludes();
    const excludePattern =
      globalExcludes.length > 0
        ? `{${template.exclude},${globalExcludes.join(',')}}`
        : template.exclude;

    // Find files
    files = await vscode.workspace.findFiles(template.include, excludePattern);
  } else {
    return;
  }

  if (!files || files.length === 0) {
    vscode.window.showWarningMessage('No matching files found.');
    return;
  }

  // Interactive Selection:
  // Allow the user to manually uncheck files from the list before exporting.
  // This provides granular control over the final output.

  const selected = await vscode.window.showQuickPick(
    files.map((f) => ({
      label: vscode.workspace.asRelativePath(f, false),
      uri: f,
      picked: true
    })),
    {
      canPickMany: true,
      placeHolder: 'Select files to include in the export',
      title: 'Confirm Files'
    }
  );

  if (!selected) {
    return; // User cancelled
  }

  const finalFiles = selected.map((item) => item.uri);

  // Sort by relative path
  const sortedFiles = finalFiles.sort((a, b) => {
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
  const chunkSize = config.get<number>('chunkSize', 0);

  // Helper to process output
  const processOutput = async (content: string, partSuffix: string = '') => {
    const tokenCount = estimateTokens(content);

    if (copyToClipboard) {
      await vscode.env.clipboard.writeText(content);
      vscode.window.showInformationMessage(
        `Exported to clipboard (~${tokenCount} tokens)${partSuffix}.`
      );
    } else {
      const baseName = template ? template.id : 'custom_export';
      const ext = outputFormat === 'xml' ? 'xml' : outputFormat === 'markdown' ? 'md' : 'txt';
      const outputFileName = `${rootFolder.name}_${baseName}${partSuffix}.${ext}`;
      const outputUri = vscode.Uri.joinPath(rootUri, outputFileName);
      const encoder = new TextEncoder();

      try {
        await vscode.workspace.fs.writeFile(outputUri, encoder.encode(content));
        vscode.window
          .showInformationMessage(
            `Export complete: ${outputFileName} (~${tokenCount} tokens)`,
            'Open file'
          )
          .then((choice) => {
            if (choice === 'Open file') {
              vscode.window.showTextDocument(outputUri);
            }
          });
      } catch (err) {
        console.error('Failed to write export file:', err);
        vscode.window.showErrorMessage('Failed to write export file.');
      }
    }
  };

  // Chunking Logic
  if (chunkSize > 0) {
    let currentChunkContent = '';
    let currentChunkIndex = 1;

    // Include the file tree only in the first chunk to provide context without redundancy.
    if (includeFileTree && outputFormat !== 'xml') {
      currentChunkContent += generateFileTree(relativePaths);
    }

    for (const file of filesContent) {
      const fileOutput = formatOutput([file], outputFormat);
      const fileTokens = estimateTokens(fileOutput);
      const currentTokens = estimateTokens(currentChunkContent);

      // If adding this file exceeds the limit...
      if (currentTokens + fileTokens > chunkSize) {
        // If the current chunk is not empty, flush it and start a new one
        if (currentChunkContent.length > 0) {
          await processOutput(currentChunkContent, `_part${currentChunkIndex}`);
          currentChunkContent = '';
          currentChunkIndex++;
        }

        // Edge Case: If a single file is larger than the chunk size, we cannot split it
        // without breaking the "atomic file" rule. In this case, we place it in its own chunk
        // (the new one we just started), effectively allowing that specific chunk to exceed the limit.
      }

      currentChunkContent += fileOutput;
    }

    // Flush remaining
    if (currentChunkContent.length > 0) {
      await processOutput(currentChunkContent, `_part${currentChunkIndex}`);
    }
  } else {
    // No chunking
    let outputContent = '';

    if (includeFileTree && outputFormat !== 'xml') {
      outputContent += generateFileTree(relativePaths);
    }

    outputContent += formatOutput(filesContent, outputFormat);
    await processOutput(outputContent);
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
    templates.map((t) => ({
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

async function handleExportStaged(): Promise<void> {
  const files = await getGitFiles('staged');
  if (files.length === 0) {
    vscode.window.showInformationMessage('No staged files found.');
    return;
  }
  await exportWithTemplate(null, files);
}

async function handleExportChanges(): Promise<void> {
  const files = await getGitFiles('changes');
  if (files.length === 0) {
    vscode.window.showInformationMessage('No changed files found.');
    return;
  }
  await exportWithTemplate(null, files);
}

import { PreviewPanel } from './webview';

async function handlePreviewCommand(context: vscode.ExtensionContext): Promise<void> {
  const templates = getTemplatesForCurrentWorkspace();
  if (templates.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const picked = await vscode.window.showQuickPick(
    templates.map((t) => ({
      label: t.label,
      description: t.description,
      template: t
    })),
    { placeHolder: 'Select a template to preview' }
  );

  if (!picked) {
    return;
  }

  const template = picked.template;

  // Show loading...
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Calculating stats...',
      cancellable: false
    },
    async () => {
      // Get global excludes
      const globalExcludes = getGlobalExcludes();
      const excludePattern =
        globalExcludes.length > 0
          ? `{${template.exclude},${globalExcludes.join(',')}}`
          : template.exclude;

      const files = await vscode.workspace.findFiles(template.include, excludePattern);
      const sortedFiles = files.sort((a, b) => a.path.localeCompare(b.path));

      let totalTokens = 0;
      const fileList: string[] = [];
      const decoder = new TextDecoder('utf-8');

      for (const file of sortedFiles) {
        try {
          const bytes = await vscode.workspace.fs.readFile(file);
          const text = decoder.decode(bytes);
          totalTokens += estimateTokens(text);
          fileList.push(vscode.workspace.asRelativePath(file, false));
        } catch {
          // ignore read errors for stats
        }
      }

      PreviewPanel.createOrShow(context.extensionUri);
      if (PreviewPanel.currentPanel) {
        PreviewPanel.currentPanel.update({
          totalFiles: files.length,
          totalTokens: totalTokens,
          fileList: fileList
        });
      }
    }
  );
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('workspaceExporter.exportWithTemplate', handleExportCommand),
    vscode.commands.registerCommand('workspaceExporter.exportStaged', handleExportStaged),
    vscode.commands.registerCommand('workspaceExporter.exportChanges', handleExportChanges),
    vscode.commands.registerCommand('workspaceExporter.previewExport', () =>
      handlePreviewCommand(context)
    )
  );
}

export function deactivate(): void {
  // no-op for now
}
