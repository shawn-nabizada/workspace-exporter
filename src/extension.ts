import * as vscode from 'vscode';
import { TextEncoder, TextDecoder } from 'util';

import { estimateTokens, generateFileTree, formatOutput, HEADER_BEGIN, HEADER_END } from './utils';

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
    pattern: '**/*.{ts,tsx,js,jsx,html,css,scss,sass,json,md,cjs,mjs,config.js,config.ts}',
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'generic_web',
    label: 'Generic Web Project',
    description: 'HTML, CSS, JS/TS, configs, docs.',
    pattern: '**/*.{ts,tsx,js,jsx,html,css,scss,sass,less,styl,json,md}',
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'all_text_code',
    label: 'All text & code files',
    description: 'Any .txt, .md, code, configs – for broad export.',
    pattern: '**/*.{txt,md,ts,tsx,js,jsx,html,css,scss,sass,json,cjs,mjs,kt,java,py,php,rb,go,rs,c,cpp,h,hpp,cs,swift,dart,lua,sh,yaml,yml,toml,xml,gradle,properties,sql}',
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage,bin,obj,target}/**'
  },
  {
    id: 'node_express_api',
    label: 'Node + Express API',
    description: 'Exports JS/TS, JSON, env examples, docs for a Node/Express API.',
    pattern: '**/*.{js,jsx,ts,tsx,json,md,env.example,env.sample}',
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'swift_app',
    label: 'Swift App (iOS / macOS)',
    description: 'Exports Swift source files, plist configs, storyboards, xib files, asset catalogs, and project metadata.',
    pattern: '**/*.{swift,plist,xib,storyboard,md,json,xcconfig,entitlements,Podfile,Cartfile}',
    exclude: '**/{node_modules,dist,build,DerivedData,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'python_data_science',
    label: 'Python (Data Science)',
    description: 'Python scripts, notebooks, data configs, and docs.',
    pattern: '**/*.{py,ipynb,json,yaml,yml,md,txt,csv,tsv}',
    exclude: '**/{node_modules,venv,.venv,env,.env,dist,build,.git,.idea,.vscode,coverage,__pycache__}/**'
  },
  {
    id: 'python_web_django_flask',
    label: 'Python Web (Django/Flask)',
    description: 'Python source, templates (HTML), static files (CSS/JS), and configs.',
    pattern: '**/*.{py,html,css,js,json,yaml,yml,md,txt,ini,wsgi}',
    exclude: '**/{node_modules,venv,.venv,env,.env,dist,build,.git,.idea,.vscode,coverage,__pycache__,staticfiles}/**'
  },
  {
    id: 'java_maven_gradle',
    label: 'Java (Maven/Gradle)',
    description: 'Java source, build configs (pom.xml, build.gradle), and docs.',
    pattern: '**/*.{java,xml,gradle,properties,md,txt,kts}',
    exclude: '**/{node_modules,target,build,bin,.git,.idea,.vscode,coverage,.gradle}/**'
  },
  {
    id: 'go_lang',
    label: 'Go Project',
    description: 'Go source files, mod/sum files, and docs.',
    pattern: '**/*.{go,mod,sum,md,txt,json,yaml,yml}',
    exclude: '**/{node_modules,dist,build,bin,.git,.idea,.vscode,coverage,vendor}/**'
  },
  {
    id: 'rust_lang',
    label: 'Rust Project',
    description: 'Rust source files, Cargo.toml/lock, and docs.',
    pattern: '**/*.{rs,toml,md,txt,json,yaml,yml}',
    exclude: '**/{node_modules,target,dist,build,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'cpp_project',
    label: 'C/C++ Project',
    description: 'C/C++ source/headers, Makefiles, CMakeLists, and docs.',
    pattern: '**/*.{c,cpp,h,hpp,cc,hh,cxx,hxx,make,cmake,txt,md,json,yaml,yml,in}',
    exclude: '**/{node_modules,dist,build,bin,obj,.git,.idea,.vscode,coverage,.vs}/**'
  },
  {
    id: 'flutter_dart',
    label: 'Flutter / Dart',
    description: 'Dart source, pubspec, Android/iOS configs, and docs.',
    pattern: '**/*.{dart,yaml,yml,md,txt,json,xml,plist,gradle,properties}',
    exclude: '**/{node_modules,build,.dart_tool,.git,.idea,.vscode,coverage,ios/Pods}/**'
  },
  {
    id: 'ruby_rails',
    label: 'Ruby on Rails',
    description: 'Ruby source, ERB templates, config files, and assets.',
    pattern: '**/*.{rb,erb,yml,yaml,md,txt,js,css,html,json,gemfile,lock,rake}',
    exclude: '**/{node_modules,tmp,log,coverage,.git,.idea,.vscode,vendor}/**'
  },
  {
    id: 'php_laravel',
    label: 'PHP / Laravel',
    description: 'PHP source, Blade templates, configs, and docs.',
    pattern: '**/*.{php,blade.php,json,xml,yml,yaml,md,txt,env.example,htaccess,ini}',
    exclude: '**/{node_modules,vendor,storage,bootstrap/cache,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'dotnet_csharp',
    label: '.NET / C#',
    description: 'C# source, solution/project files, and configs.',
    pattern: '**/*.{cs,csproj,sln,json,xml,config,md,txt,props,targets,xaml,razor}',
    exclude: '**/{node_modules,bin,obj,.git,.idea,.vscode,coverage,.vs}/**'
  },
  {
    id: 'devops_infra',
    label: 'DevOps / Infrastructure',
    description: 'Terraform, Docker, Kubernetes, Shell scripts, and CI/CD configs.',
    pattern: '**/*.{tf,tfvars,hcl,dockerfile,yaml,yml,sh,bash,zsh,json,md,txt,conf,ini}',
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage,.terraform}/**'
  },
  {
    id: 'documentation',
    label: 'Documentation Only',
    description: 'Markdown, text, reStructuredText, and other doc files.',
    pattern: '**/*.{md,txt,rst,adoc,pdf,png,jpg,jpeg,gif,svg}',
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
