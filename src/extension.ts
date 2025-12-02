import * as vscode from 'vscode';
import { TextEncoder, TextDecoder } from 'util';
import { estimateTokens } from './utils';
import { ExporterService, RuntimeTemplate, ExportConfig } from './exporter';
import { PreviewPanel } from './webview';

const service = new ExporterService();

/**
 * Core export logic with Progress Bar and Streaming/Chunking support.
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

  let files: vscode.Uri[] = [];

  // 1. Find Files
  if (specificFiles) {
    files = specificFiles;
  } else if (template) {
    files = await service.findFiles(template);
  } else {
    return;
  }

  if (!files || files.length === 0) {
    vscode.window.showWarningMessage('No matching files found.');
    return;
  }

  // 2. Interactive Selection (Skip if specificFiles were passed, e.g. from Webview)
  // If specificFiles are passed, we assume the user already selected them in the Webview or Git command.
  // However, for template-based exports (template != null), we still offer the QuickPick.
  let finalFiles: vscode.Uri[] = files;

  if (template && !specificFiles) {
    const selected = await vscode.window.showQuickPick(
      files.map((f) => ({
        label: vscode.workspace.asRelativePath(f, false),
        uri: f,
        picked: true
      })),
      {
        canPickMany: true,
        placeHolder: 'Select files to include in the export',
        title: `Confirm Files (${files.length} found)`
      }
    );

    if (!selected) {
      return; // User cancelled
    }
    finalFiles = selected.map((item) => item.uri);
  }

  // 3. Prepare Config
  const config = vscode.workspace.getConfiguration('workspaceExporter');
  const exportConfig: ExportConfig = {
    outputFormat: config.get<string>('outputFormat', 'text'),
    includeFileTree: config.get<boolean>('includeFileTree', true),
    globalExcludes: service.getGlobalExcludes()
  };
  const copyToClipboard = config.get<boolean>('copyToClipboard', false);
  const chunkSize = config.get<number>('chunkSize', 0);

  // 4. Process Files with Progress Bar
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Exporting workspace...',
      cancellable: true
    },
    async (progress, token) => {
      let currentChunkContent = '';
      let currentChunkIndex = 1;
      let processedCount = 0;
      const totalFiles = finalFiles.length;

      const saveChunk = async (content: string, suffix: string = '') => {
        const tokenCount = estimateTokens(content);
        if (copyToClipboard) {
          await vscode.env.clipboard.writeText(content);
          vscode.window.showInformationMessage(
            `Exported to clipboard (~${tokenCount} tokens)${suffix}.`
          );
        } else {
          const baseName = template ? template.id : 'custom_export';
          const ext =
            exportConfig.outputFormat === 'xml'
              ? 'xml'
              : exportConfig.outputFormat === 'markdown'
              ? 'md'
              : 'txt';
          const outputFileName = `${rootFolder.name}_${baseName}${suffix}.${ext}`;
          const outputUri = vscode.Uri.joinPath(rootUri, outputFileName);
          const encoder = new TextEncoder();
          await vscode.workspace.fs.writeFile(outputUri, encoder.encode(content));
          
          if (suffix === '' || suffix === '_part1') {
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
          }
        }
      };

      for await (const fileOutput of service.processFiles(finalFiles, exportConfig)) {
        if (token.isCancellationRequested) break;

        if (chunkSize > 0) {
          const currentTokens = estimateTokens(currentChunkContent);
          const newTokens = estimateTokens(fileOutput);

          if (currentTokens + newTokens > chunkSize && currentChunkContent.length > 0) {
            await saveChunk(currentChunkContent, `_part${currentChunkIndex}`);
            currentChunkContent = '';
            currentChunkIndex++;
          }
        }

        currentChunkContent += fileOutput;
        processedCount++;
        progress.report({
          message: `${processedCount}/${totalFiles}`,
          increment: 100 / totalFiles
        });
      }

      if (currentChunkContent.length > 0 && !token.isCancellationRequested) {
        const suffix = chunkSize > 0 ? `_part${currentChunkIndex}` : '';
        await saveChunk(currentChunkContent, suffix);
      }
    }
  );
}

// --- Command Handlers ---

async function handleExportCommand(): Promise<void> {
  const templates = service.getTemplates();
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
    { placeHolder: 'Select an export template' }
  );

  if (!picked) return;
  await exportWithTemplate(picked.template);
}

async function handleExportStaged(): Promise<void> {
  const files = await service.getGitFiles('staged');
  if (files.length === 0) {
    vscode.window.showInformationMessage('No staged files found.');
    return;
  }
  await exportWithTemplate(null, files);
}

async function handleExportChanges(): Promise<void> {
  const files = await service.getGitFiles('changes');
  if (files.length === 0) {
    vscode.window.showInformationMessage('No changed files found.');
    return;
  }
  await exportWithTemplate(null, files);
}

/**
 * Handles the "Export" button click from the Webview.
 * receives a list of relative paths, resolves them, and exports.
 */
async function handleExportSubset(relativePaths: string[]): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return;

  const rootUri = workspaceFolders[0].uri;
  // Resolve relative paths back to Uris
  const uris = relativePaths.map((p) => vscode.Uri.joinPath(rootUri, p));

  await exportWithTemplate(null, uris);
}

async function handlePreviewCommand(): Promise<void> {
  const templates = service.getTemplates();
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

  if (!picked) return;

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Calculating stats...',
      cancellable: false
    },
    async () => {
      const files = await service.findFiles(picked.template);
      const sortedFiles = files.sort((a, b) => a.path.localeCompare(b.path));
      
      let totalTokens = 0;
      const fileList: { path: string; tokens: number }[] = [];
      const decoder = new TextDecoder('utf-8');

      for (const file of sortedFiles) {
        try {
          const bytes = await vscode.workspace.fs.readFile(file);
          const text = decoder.decode(bytes);
          const tokens = estimateTokens(text);
          totalTokens += tokens;
          fileList.push({
            path: vscode.workspace.asRelativePath(file, false),
            tokens: tokens
          });
        } catch {
          // ignore
        }
      }

      // No arguments needed now
      PreviewPanel.createOrShow();
      
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
    vscode.commands.registerCommand('workspaceExporter.previewExport', handlePreviewCommand),
    vscode.commands.registerCommand('workspaceExporter.exportSubset', handleExportSubset)
  );
}

export function deactivate(): void {}