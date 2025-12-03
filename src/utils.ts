export const HEADER_BEGIN = '<<<WORKSPACE_EXPORTER_FILE_BEGIN>>>';
export const HEADER_END = '<<<WORKSPACE_EXPORTER_FILE_END>>>';

/**
 * Estimate token count (simple char/4 heuristic).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Generate a visual file tree from a list of relative paths.
 */
export function generateFileTree(paths: string[]): string {
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

/**
 * Format the output content based on the selected format.
 */
export function formatOutput(
  filesContent: { path: string; content: string }[],
  format: string
): string {
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
 * Checks if a buffer is likely binary by looking for null bytes in the first 8000 bytes.
 */
export function isBinary(buffer: Uint8Array): boolean {
  const chunkLength = Math.min(buffer.length, 8000);
  for (let i = 0; i < chunkLength; i++) {
    if (buffer[i] === 0x00) {
      return true;
    }
  }
  return false;
}
