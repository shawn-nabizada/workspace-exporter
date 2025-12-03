import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { TextDecoder } from 'util';
import { generateFileTree, formatOutput, isBinary } from './utils';

export interface TemplateDefinition {
  id: string;
  label: string;
  description: string;
  pattern: string;
  exclude: string;
}

export interface RuntimeTemplate extends TemplateDefinition {
  include: vscode.RelativePattern;
}

export interface ExportConfig {
  outputFormat: string;
  includeFileTree: boolean;
  globalExcludes: string[];
}

export const BUILTIN_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'react_vite_ts_tailwind',
    label: 'React + Vite + TypeScript + Tailwind',
    description: 'Typical Vite+React+TS+Tailwind project: src, config files, docs.',
    pattern:
      '**/{Dockerfile,docker-compose.yml,docker-compose.yaml,.dockerignore,*.ts,*.tsx,*.js,*.jsx,*.html,*.css,*.scss,*.sass,*.json,*.md,*.cjs,*.mjs,*.config.js,*.config.ts}',
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'generic_web',
    label: 'Generic Web Project',
    description: 'HTML, CSS, JS/TS, configs, docs.',
    pattern:
      '**/{Dockerfile,docker-compose.yml,docker-compose.yaml,.dockerignore,*.ts,*.tsx,*.js,*.jsx,*.html,*.css,*.scss,*.sass,*.less,*.styl,*.json,*.md}',
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'all_text_code',
    label: 'All text & code files',
    description: 'Any .txt, .md, code, configs – for broad export.',
    pattern:
      '**/{Dockerfile,docker-compose.yml,docker-compose.yaml,.dockerignore,*.txt,*.md,*.ts,*.tsx,*.js,*.jsx,*.html,*.css,*.scss,*.sass,*.json,*.cjs,*.mjs,*.kt,*.java,*.py,*.php,*.rb,*.go,*.rs,*.c,*.cpp,*.h,*.hpp,*.cs,*.swift,*.dart,*.lua,*.sh,*.yaml,*.yml,*.toml,*.xml,*.gradle,*.properties,*.sql}',
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage,bin,obj,target}/**'
  },
  {
    id: 'node_express_api',
    label: 'Node + Express API',
    description: 'Exports JS/TS, JSON, env examples, docs for a Node/Express API.',
    pattern:
      '**/{Dockerfile,docker-compose.yml,docker-compose.yaml,.dockerignore,*.js,*.jsx,*.ts,*.tsx,*.json,*.md,*.env.example,*.env.sample}',
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'swift_app',
    label: 'Swift App (iOS / macOS)',
    description:
      'Exports Swift source files, plist configs, storyboards, xib files, asset catalogs, and project metadata.',
    pattern:
      '**/{Dockerfile,docker-compose.yml,docker-compose.yaml,.dockerignore,*.swift,*.plist,*.xib,*.storyboard,*.md,*.json,*.xcconfig,*.entitlements,*.Podfile,*.Cartfile}',
    exclude: '**/{node_modules,dist,build,DerivedData,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'python_data_science',
    label: 'Python (Data Science)',
    description: 'Python scripts, notebooks, data configs, and docs.',
    pattern:
      '**/{Dockerfile,docker-compose.yml,docker-compose.yaml,.dockerignore,*.py,*.ipynb,*.json,*.yaml,*.yml,*.md,*.txt,*.csv,*.tsv}',
    exclude:
      '**/{node_modules,venv,.venv,env,.env,dist,build,.git,.idea,.vscode,coverage,__pycache__}/**'
  },
  {
    id: 'python_web_django_flask',
    label: 'Python Web (Django/Flask)',
    description: 'Python source, templates (HTML), static files (CSS/JS), and configs.',
    pattern:
      '**/{Dockerfile,docker-compose.yml,docker-compose.yaml,.dockerignore,*.py,*.html,*.css,*.js,*.json,*.yaml,*.yml,*.md,*.txt,*.ini,*.wsgi}',
    exclude:
      '**/{node_modules,venv,.venv,env,.env,dist,build,.git,.idea,.vscode,coverage,__pycache__,staticfiles}/**'
  },
  {
    id: 'java_maven_gradle',
    label: 'Java (Maven/Gradle)',
    description: 'Java source, build configs (pom.xml, build.gradle), and docs.',
    pattern:
      '**/{Dockerfile,docker-compose.yml,docker-compose.yaml,.dockerignore,*.java,*.xml,*.gradle,*.properties,*.md,*.txt,*.kts}',
    exclude: '**/{node_modules,target,build,bin,.git,.idea,.vscode,coverage,.gradle}/**'
  },
  {
    id: 'go_lang',
    label: 'Go Project',
    description: 'Go source files, mod/sum files, and docs.',
    pattern:
      '**/{Dockerfile,docker-compose.yml,docker-compose.yaml,.dockerignore,*.go,*.mod,*.sum,*.md,*.txt,*.json,*.yaml,*.yml}',
    exclude: '**/{node_modules,dist,build,bin,.git,.idea,.vscode,coverage,vendor}/**'
  },
  {
    id: 'rust_lang',
    label: 'Rust Project',
    description: 'Rust source files, Cargo.toml/lock, and docs.',
    pattern:
      '**/{Dockerfile,docker-compose.yml,docker-compose.yaml,.dockerignore,*.rs,*.toml,*.md,*.txt,*.json,*.yaml,*.yml}',
    exclude: '**/{node_modules,target,dist,build,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'cpp_project',
    label: 'C/C++ Project',
    description: 'C/C++ source/headers, Makefiles, CMakeLists, and docs.',
    pattern:
      '**/{Dockerfile,docker-compose.yml,docker-compose.yaml,.dockerignore,*.c,*.cpp,*.h,*.hpp,*.cc,*.hh,*.cxx,*.hxx,*.make,*.cmake,*.txt,*.md,*.json,*.yaml,*.yml,*.in}',
    exclude: '**/{node_modules,dist,build,bin,obj,.git,.idea,.vscode,coverage,.vs}/**'
  },
  {
    id: 'flutter_dart',
    label: 'Flutter / Dart',
    description: 'Dart source, pubspec, Android/iOS configs, and docs.',
    pattern:
      '**/{Dockerfile,docker-compose.yml,docker-compose.yaml,.dockerignore,*.dart,*.yaml,*.yml,*.md,*.txt,*.json,*.xml,*.plist,*.gradle,*.properties}',
    exclude: '**/{node_modules,build,.dart_tool,.git,.idea,.vscode,coverage,ios/Pods}/**'
  },
  {
    id: 'ruby_rails',
    label: 'Ruby on Rails',
    description: 'Ruby source, ERB templates, config files, and assets.',
    pattern:
      '**/{Dockerfile,docker-compose.yml,docker-compose.yaml,.dockerignore,*.rb,*.erb,*.yml,*.yaml,*.md,*.txt,*.js,*.css,*.html,*.json,*.gemfile,*.lock,*.rake}',
    exclude: '**/{node_modules,tmp,log,coverage,.git,.idea,.vscode,vendor}/**'
  },
  {
    id: 'php_laravel',
    label: 'PHP / Laravel',
    description: 'PHP source, Blade templates, configs, and docs.',
    pattern:
      '**/{Dockerfile,docker-compose.yml,docker-compose.yaml,.dockerignore,*.php,*.blade.php,*.json,*.xml,*.yml,*.yaml,*.md,*.txt,*.env.example,*.htaccess,*.ini}',
    exclude: '**/{node_modules,vendor,storage,bootstrap/cache,.git,.idea,.vscode,coverage}/**'
  },
  {
    id: 'dotnet_csharp',
    label: '.NET / C#',
    description: 'C# source, solution/project files, and configs.',
    pattern:
      '**/{Dockerfile,docker-compose.yml,docker-compose.yaml,.dockerignore,*.cs,*.csproj,*.sln,*.json,*.xml,*.config,*.md,*.txt,*.props,*.targets,*.xaml,*.razor}',
    exclude: '**/{node_modules,bin,obj,.git,.idea,.vscode,coverage,.vs}/**'
  },
  {
    id: 'devops_infra',
    label: 'DevOps / Infrastructure',
    description: 'Terraform, Docker, Kubernetes, Shell scripts, and CI/CD configs.',
    pattern:
      '**/{Dockerfile,docker-compose.yml,docker-compose.yaml,.dockerignore,*.tf,*.tfvars,*.hcl,*.dockerfile,*.yaml,*.yml,*.sh,*.bash,*.zsh,*.json,*.md,*.txt,*.conf,*.ini}',
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage,.terraform}/**'
  },
  {
    id: 'documentation',
    label: 'Documentation Only',
    description: 'Markdown, text, reStructuredText, and other doc files.',
    pattern: '**/{*.md,*.txt,*.rst,*.adoc,*.pdf,*.png,*.jpg,*.jpeg,*.gif,*.svg}',
    exclude: '**/{node_modules,dist,build,.git,.idea,.vscode,coverage}/**'
  }
];

export class ExporterService {
  private decoder = new TextDecoder('utf-8');

  /**
   * Get templates merging built-in and user-defined ones.
   */
  public getTemplates(): RuntimeTemplate[] {
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

  public getGlobalExcludes(): string[] {
    const config = vscode.workspace.getConfiguration('workspaceExporter');
    return config.get<string[]>('globalExcludes', []);
  }

  /**
   * Get files from Git (staged or changed).
   */
  public async getGitFiles(type: 'staged' | 'changes'): Promise<vscode.Uri[]> {
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
   * Find files based on template and global excludes.
   */
  public async findFiles(template: RuntimeTemplate): Promise<vscode.Uri[]> {
    const globalExcludes = this.getGlobalExcludes();
    const excludePattern =
      globalExcludes.length > 0
        ? `{${template.exclude},${globalExcludes.join(',')}}`
        : template.exclude;

    return await vscode.workspace.findFiles(template.include, excludePattern);
  }

  /**
   * Generator that yields processed file content chunks.
   * This is the streaming implementation to avoid holding all files in RAM.
   */
  public async *processFiles(files: vscode.Uri[], config: ExportConfig): AsyncGenerator<string> {
    // 1. Yield File Tree if requested
    if (config.includeFileTree && config.outputFormat !== 'xml') {
      const relativePaths = files.map((uri) => vscode.workspace.asRelativePath(uri, false));
      // Sort for tree generation (already consistent with sortedFiles iteration below if we sort there too)
      relativePaths.sort();
      yield generateFileTree(relativePaths);
    }

    // 2. Sort files to ensure deterministic order
    const sortedFiles = files.sort((a, b) => {
      const relA = vscode.workspace.asRelativePath(a, false);
      const relB = vscode.workspace.asRelativePath(b, false);
      return relA.localeCompare(relB);
    });

    // 3. Process files one by one
    for (const fileUri of sortedFiles) {
      const relPath = vscode.workspace.asRelativePath(fileUri, false);
      let content = '';

      try {
        const bytes = await vscode.workspace.fs.readFile(fileUri);

        // Check for binary content before decoding
        if (isBinary(bytes)) {
          content = '[Binary File Omitted]';
        } else {
          content = this.decoder.decode(bytes);
        }
      } catch (err) {
        console.error(`Failed to read ${fileUri.toString()}:`, err);
        content = 'ERROR READING FILE';
      }

      const formatted = formatOutput([{ path: relPath, content }], config.outputFormat);
      yield formatted;
    }
  }
}
