import * as vscode from 'vscode';

/**
 * Manages the Webview Panel for the Export Preview.
 */
export class PreviewPanel {
  public static currentPanel: PreviewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getWebviewContent();

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'exportSubset':
            // Trigger the command we registered in extension.ts, passing the selected files
            vscode.commands.executeCommand('workspaceExporter.exportSubset', message.files);
            this.dispose(); // Close panel after starting export
            return;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Create or reveal the preview panel.
   */
  public static createOrShow() {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (PreviewPanel.currentPanel) {
      PreviewPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'workspaceExporterPreview',
      'Export Preview',
      column || vscode.ViewColumn.One,
      { enableScripts: true }
    );

    PreviewPanel.currentPanel = new PreviewPanel(panel);
  }

  /**
   * Update the webview with new statistics.
   * @param stats The statistics to display.
   */
  public update(stats: {
    totalFiles: number;
    totalTokens: number;
    fileList: { path: string; tokens: number }[];
  }) {
    this._panel.webview.postMessage({ command: 'update', stats });
  }

  /**
   * Generate the HTML content for the webview.
   */
  private _getWebviewContent() {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Export Preview</title>
      <style>
        body { 
          font-family: var(--vscode-font-family); 
          padding: 20px; 
          color: var(--vscode-editor-foreground); 
          background-color: var(--vscode-editor-background); 
        }
        .stats-container {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
          background: var(--vscode-editor-widget-background);
          padding: 15px;
          border: 1px solid var(--vscode-widget-border);
          border-radius: 4px;
        }
        .stat-item h3 { margin: 0 0 5px 0; font-size: 14px; opacity: 0.8; }
        .stat-value { font-size: 24px; font-weight: bold; }
        
        .controls {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
          align-items: center;
        }
        input[type="text"] {
          flex: 1;
          padding: 6px;
          background: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
        }
        button.secondary {
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
          border: none;
          padding: 6px 12px;
          cursor: pointer;
        }
        button.secondary:hover {
          background: var(--vscode-button-secondaryHoverBackground);
        }

        /* Tree Styles */
        .tree-container {
          border: 1px solid var(--vscode-widget-border);
          border-radius: 4px;
          max-height: 60vh;
          overflow-y: auto;
          padding: 10px;
          background-color: var(--vscode-list-activeSelectionBackground); 
          background: rgba(0,0,0,0.1); /* Subtle contrast */
        }
        ul.tree {
          list-style: none;
          padding-left: 0;
          margin: 0;
        }
        ul.tree ul {
          padding-left: 20px; /* Indentation */
          margin: 0;
          border-left: 1px solid var(--vscode-tree-indentGuidesStroke);
        }
        li.tree-node {
          margin: 2px 0;
        }
        .node-content {
          display: flex;
          align-items: center;
          padding: 2px 4px;
          border-radius: 3px;
        }
        .node-content:hover {
          background-color: var(--vscode-list-hoverBackground);
        }
        .toggle-btn {
          background: none;
          border: none;
          color: var(--vscode-foreground);
          cursor: pointer;
          width: 20px;
          text-align: center;
          font-size: 12px;
          padding: 0;
          margin-right: 4px;
        }
        .toggle-btn.hidden {
          visibility: hidden;
        }
        
        input[type="checkbox"] {
          margin-right: 6px;
          cursor: pointer;
        }
        
        .icon {
          margin-right: 6px;
          opacity: 0.8;
          font-size: 14px;
        }
        
        .label-text {
          flex: 1;
          cursor: default;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .token-badge {
          font-size: 11px;
          opacity: 0.7;
          background: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          padding: 1px 5px;
          border-radius: 8px;
          margin-left: 8px;
        }

        .main-action { 
          margin-top: 20px;
          text-align: right;
        }
        button.primary { 
            background-color: var(--vscode-button-background); 
            color: var(--vscode-button-foreground); 
            border: none; 
            padding: 10px 20px; 
            font-size: 16px; 
            cursor: pointer; 
            border-radius: 2px;
        }
        button.primary:hover { background-color: var(--vscode-button-hoverBackground); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
      </style>
    </head>
    <body>
      <h2>Export Preview</h2>
      
      <div class="stats-container">
        <div class="stat-item">
            <h3>Selected Files</h3>
            <div id="file-count" class="stat-value">-</div>
        </div>
        <div class="stat-item">
            <h3>Est. Tokens</h3>
            <div id="token-count" class="stat-value">-</div>
        </div>
      </div>

      <div class="controls">
        <input type="text" id="search-box" placeholder="Filter files..." />
        <button class="secondary" id="expand-all-btn">Expand All</button>
        <button class="secondary" id="collapse-all-btn">Collapse All</button>
      </div>

      <div id="tree-root" class="tree-container">
        <div style="text-align:center; padding: 20px;">Waiting for data...</div>
      </div>

      <div class="main-action">
        <button id="export-btn" class="primary" disabled>Export Selected</button>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        
        // State
        let allFiles = []; // Array of { path, tokens, checked }
        let expandedPaths = new Set(); // Store paths of expanded folders

        // DOM Elements
        const treeRoot = document.getElementById('tree-root');
        const fileCountEl = document.getElementById('file-count');
        const tokenCountEl = document.getElementById('token-count');
        const searchBox = document.getElementById('search-box');
        const exportBtn = document.getElementById('export-btn');
        const expandAllBtn = document.getElementById('expand-all-btn');
        const collapseAllBtn = document.getElementById('collapse-all-btn');

        // --- Event Handling ---
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'update') {
                // Initialize files with checked = true
                allFiles = message.stats.fileList.map(f => ({ ...f, checked: true }));
                render();
            }
        });

        searchBox.addEventListener('input', () => render());

        expandAllBtn.addEventListener('click', () => {
             document.querySelectorAll('.tree-node > ul').forEach(el => el.style.display = 'block');
             document.querySelectorAll('.toggle-btn').forEach(btn => btn.innerText = '▼'); 
        });
        
        collapseAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.tree-node > ul').forEach(el => el.style.display = 'none');
             document.querySelectorAll('.toggle-btn').forEach(btn => btn.innerText = '▶'); 
        });

        exportBtn.addEventListener('click', () => {
            const selectedPaths = allFiles.filter(f => f.checked).map(f => f.path);
            vscode.postMessage({ 
                command: 'exportSubset', 
                files: selectedPaths 
            });
        });

        // --- Logic ---

        function buildTree(files) {
            const root = {};

            files.forEach(file => {
                const parts = file.path.split('/');
                let current = root;
                
                parts.forEach((part, index) => {
                    if (!current[part]) {
                        current[part] = {
                            name: part,
                            path: parts.slice(0, index + 1).join('/'),
                            children: {},
                            files: [] // Leaf files under this node (direct or indirect)
                        };
                    }
                    // Add this file to the 'files' array of every node in its path
                    // This helps us quickly calculate state
                    current[part].files.push(file);
                    
                    if (index === parts.length - 1) {
                        current[part].isFile = true;
                        current[part].data = file;
                    } else {
                         current[part].isFile = false;
                    }
                    current = current[part].children;
                });
            });
            return root;
        }

        function render() {
            const filter = searchBox.value.toLowerCase();
            
            // 1. Filter files
            const filteredFiles = allFiles.filter(f => f.path.toLowerCase().includes(filter));
            
            // 2. Build Tree
            const tree = buildTree(filteredFiles);
            
            // 3. Render HTML
            treeRoot.innerHTML = '';
            const ul = document.createElement('ul');
            ul.className = 'tree';
            
            // Sort keys: Folders first, then files, then alphabetical
            const topLevelKeys = Object.keys(tree).sort((a, b) => {
                const nodeA = tree[a];
                const nodeB = tree[b];
                if (nodeA.isFile === nodeB.isFile) return a.localeCompare(b);
                return nodeA.isFile ? 1 : -1;
            });

            topLevelKeys.forEach(key => {
                ul.appendChild(createNodeElement(tree[key], filter.length > 0));
            });

            if (topLevelKeys.length === 0) {
                treeRoot.innerHTML = '<div style="padding:10px; text-align:center; opacity:0.7">No matching files found.</div>';
            } else {
                treeRoot.appendChild(ul);
            }

            updateStats();
        }

        function createNodeElement(node, forceExpand) {
            const li = document.createElement('li');
            li.className = 'tree-node';

            const content = document.createElement('div');
            content.className = 'node-content';

            // -- Toggle Button --
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'toggle-btn';
            const hasChildren = Object.keys(node.children).length > 0;
            
            if (!hasChildren) {
                toggleBtn.classList.add('hidden');
                toggleBtn.innerText = '•'; 
            } else {
                toggleBtn.innerText = (forceExpand || expandedPaths.has(node.path)) ? '▼' : '▶';
                toggleBtn.onclick = (e) => {
                    e.stopPropagation();
                    const ul = li.querySelector('ul');
                    if (ul) {
                        const isHidden = ul.style.display === 'none';
                        ul.style.display = isHidden ? 'block' : 'none';
                        toggleBtn.innerText = isHidden ? '▼' : '▶';
                        if (isHidden) expandedPaths.add(node.path);
                        else expandedPaths.delete(node.path);
                    }
                };
            }

            // -- Checkbox --
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            
            // Determine state based on children files
            // node.files contains all leaf file objects under this node
            const totalCount = node.files.length;
            const checkedCount = node.files.filter(f => f.checked).length;
            
            checkbox.checked = checkedCount === totalCount && totalCount > 0;
            checkbox.indeterminate = checkedCount > 0 && checkedCount < totalCount;

            checkbox.onchange = (e) => {
                const isChecked = e.target.checked;
                // Update all descendants
                node.files.forEach(f => f.checked = isChecked);
                // Re-render to update UI states (bubbling up visual state)
                render(); 
            };

            // -- Icon & Label --
            const icon = document.createElement('span');
            icon.className = 'icon';
            icon.innerText = node.isFile ? '📄' : '📁';
            
            const label = document.createElement('span');
            label.className = 'label-text';
            label.innerText = node.name;
            
            // -- Token Badge (only for files) --
            const badge = document.createElement('span');
            if (node.isFile) {
                badge.className = 'token-badge';
                badge.innerText = node.data.tokens + ' t';
            }

            content.appendChild(toggleBtn);
            content.appendChild(checkbox);
            content.appendChild(icon);
            content.appendChild(label);
            if(node.isFile) content.appendChild(badge);

            li.appendChild(content);

            // -- Children --
            if (hasChildren) {
                const ul = document.createElement('ul');
                ul.style.display = (forceExpand || expandedPaths.has(node.path)) ? 'block' : 'none';
                
                // Sort children
                const childKeys = Object.keys(node.children).sort((a, b) => {
                    const cA = node.children[a];
                    const cB = node.children[b];
                    if (cA.isFile === cB.isFile) return a.localeCompare(b);
                    return cA.isFile ? 1 : -1;
                });

                childKeys.forEach(key => {
                    ul.appendChild(createNodeElement(node.children[key], forceExpand));
                });
                li.appendChild(ul);
            }

            return li;
        }

        function updateStats() {
            // Recalculate based on global allFiles state
            const selected = allFiles.filter(f => f.checked);
            const totalTokens = selected.reduce((sum, f) => sum + f.tokens, 0);
            
            fileCountEl.innerText = selected.length;
            tokenCountEl.innerText = '~' + totalTokens;
            
            exportBtn.disabled = selected.length === 0;
            exportBtn.style.opacity = selected.length === 0 ? '0.5' : '1';
        }

      </script>
    </body>
    </html>`;
  }

  public dispose() {
    PreviewPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}