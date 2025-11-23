# Workspace Exporter

Export your entire VS Code workspace into a **single TXT file**, using different templates
designed for common tech stacks (React + Vite + TypeScript + Tailwind, generic web projects,
or “all text & code files”).

## Features

- 🧩 **Template-based exports**
  - React + Vite + TypeScript + Tailwind
  - Generic web project
  - All text & code files (multi-language)

- 🌳 **File Tree Visualization**
  - Includes a visual tree of the exported files at the top of the output.

- 🍃 **Git Integration**
  - Export only staged or changed files.

- 👁️ **Export Preview**
  - Preview file list and token estimates before exporting.

- 📋 **Clipboard Support**
  - Option to copy the output directly to the clipboard.

- ⚙️ **Highly Configurable**
  - Custom templates, global excludes, and output formats (Text, XML, Markdown).

- 📊 **Token Estimation**
  - Provides an estimated token count for LLM usage.

- 📄 **Single Output File**
  - Concatenates files with clear headers.

- 🔍 **Deterministic ordering**
  - Files are sorted by relative path for consistent diffs.

## Usage

1. Install **Workspace Exporter** from the VS Code Marketplace.
2. Open any folder/workspace in VS Code.
3. Press **Ctrl+Shift+P** and run one of the following commands:

   - **Export Workspace to TXT (Choose Template)**
   - **Export Staged Files**
   - **Export Changed Files**
   - **Preview Export**

4. If choosing a template, select one (e.g., *React + Vite + TypeScript + Tailwind*).
5. The extension generates a file (or copies to clipboard) based on your settings.

## Configuration

You can customize the extension in VS Code Settings (`Ctrl+,`):

- **`workspaceExporter.outputFormat`**:
  - `text` (default): Standard text format.
  - `xml`: Wraps files in XML tags.
  - `markdown`: Wraps files in Markdown code blocks.

- **`workspaceExporter.includeFileTree`**:
  - `true` (default): Include a visual file tree at the top.
  - `false`: Disable the file tree.

- **`workspaceExporter.copyToClipboard`**:
  - `true`: Copy output to clipboard.
  - `false` (default): Save to a file.

- **`workspaceExporter.globalExcludes`**:
  - Array of glob patterns to exclude from ALL templates (e.g., `["**/*.test.ts"]`).

- **`workspaceExporter.customTemplates`**:
  - Define your own templates with specific patterns and excludes.

## Templates

### React + Vite + TypeScript + Tailwind

**Includes:**

- `src/**/*.ts`, `src/**/*.tsx`, `src/**/*.js`, `src/**/*.jsx`
- `*.html`, `*.css`, `*.scss`, `*.sass`
- Config + metadata files (`*.json`, `*.mjs`, `*.cjs`)
- Markdown files such as `README.md`

**Excludes:**

- `node_modules`, `dist`, `build`, `.git`, `.idea`, `.vscode`, `coverage`

---

### Generic Web Project

Covers common web project structures with:

- HTML, CSS, JS, TS
- Markdown and config files
- Webpack/Vite/Parcel configs (as long as extensions match)

Excludes the same non-essential directories.

### Node + Express API

**Includes:**

- `**/*.{js,jsx,ts,tsx,json,md}`

**Excludes:**

- `node_modules`, `dist`, `build`, `.git`, `.idea`, `.vscode`, `coverage`

---

### All Text & Code Files

Useful when you want to capture the complete codebase:

**Languages included:**

- JavaScript, TypeScript, JSX, TSX
- HTML, CSS, SCSS, SASS
- JSON, Markdown
- Kotlin, Java
- Python, PHP, Ruby
- Go, Rust

And many more that use plain-text extensions.

---

## Why Use Workspace Exporter?

- Quickly share an entire codebase with an AI assistant.
- Produce a clean, readable snapshot of a project for review.
- Archive all relevant source files without vendor dependencies.
- Useful for debugging, education, code audits, or project walkthroughs.

## Known Limitations

- Binary files (images, fonts, compiled artifacts) are ignored by design.
- Very large workspaces may produce very large TXT outputs.
- Multi-root workspaces currently export only the **first** root folder.

## Contributing

This project uses **ESLint** and **Prettier** for code quality.

- Run linting: `npm run lint`
- Format code: `npm run format`
- Run tests: `npm test`

## License

MIT
