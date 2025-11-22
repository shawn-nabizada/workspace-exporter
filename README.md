# Workspace Exporter

Export your entire VS Code workspace into a **single TXT file**, using different templates
designed for common tech stacks (React + Vite + TypeScript + Tailwind, generic web projects,
or “all text & code files”).

## Features

- 🧩 **Template-based exports**
  - React + Vite + TypeScript + Tailwind
  - Generic web project
  - All text & code files (multi-language)

- 📄 **Single TXT output**
  - Concatenates files with clear headers:
    ```txt
    ===== FILE: src/App.tsx =====
    ...
    ```

- 🧹 **Smart excludes**
  - Skips `node_modules`, `dist`, `build`, `.git`, `.vscode`, `.idea`, `coverage`, and other non-essential directories.

- 🔍 **Deterministic ordering**
  - Files are sorted by relative path for consistent diffs, debugging, and AI model uploads.

## Usage

1. Install **Workspace Exporter** from the VS Code Marketplace.
2. Open any folder/workspace in VS Code.
3. Press **Ctrl+Shift+P** and run:

   > **Export Workspace to TXT (Choose Template)**

4. Select a template (e.g., *React + Vite + TypeScript + Tailwind*).
5. The extension generates a TXT file at the workspace root, for example: my-project-react_vite_ts_tailwind_export.txt
6. Open the output TXT file or share it with collaborators or AI tools for analysis.

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

## License

MIT
