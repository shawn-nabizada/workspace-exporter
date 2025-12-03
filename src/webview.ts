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

        .file-list {
          list-style: none;
          padding: 0;
          max-height: 50vh;
          overflow-y: auto;
          border: 1px solid var(--vscode-widget-border);
          border-radius: 4px;
        }
        .file-item {
          display: flex;
          align-items: center;
          padding: 6px 10px;
          border-bottom: 1px solid var(--vscode-widget-border);
        }
        .file-item:last-child { border-bottom: none; }
        .file-item:hover { background-color: var(--vscode-list-hoverBackground); }
        .file-item label { 
          margin-left: 10px; 
          flex: 1; 
          cursor: pointer; 
          display: flex; 
          justify-content: space-between;
        }
        .token-badge {
          font-size: 12px;
          opacity: 0.7;
          background: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          padding: 2px 6px;
          border-radius: 10px;
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
        <button class="secondary" id="toggle-all-btn">Toggle All</button>
      </div>

      <ul id="file-list-ul" class="file-list">
        <li style="padding: 20px; text-align: center;">Loading...</li>
      </ul>

      <div class="main-action">
        <button id="export-btn" class="primary">Export Selected</button>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        let allFiles = []; // { path, tokens }
        
        // --- Elements ---
        const fileListUl = document.getElementById('file-list-ul');
        const fileCountEl = document.getElementById('file-count');
        const tokenCountEl = document.getElementById('token-count');
        const searchBox = document.getElementById('search-box');
        const toggleAllBtn = document.getElementById('toggle-all-btn');
        const exportBtn = document.getElementById('export-btn');

        // --- State ---
        // We render list items with data-idx to reference 'allFiles'.
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'update') {
                allFiles = message.stats.fileList.map(f => ({ ...f, checked: true }));
                renderList();
                updateStats();
            }
        });

        function renderList() {
            const filter = searchBox.value.toLowerCase();
            fileListUl.innerHTML = '';

            allFiles.forEach((file, index) => {
                if (!file.path.toLowerCase().includes(filter)) return;

                const li = document.createElement('li');
                li.className = 'file-item';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = file.checked;
                checkbox.id = 'chk-' + index;
                checkbox.onchange = (e) => {
                    file.checked = e.target.checked;
                    updateStats();
                };

                const label = document.createElement('label');
                label.htmlFor = 'chk-' + index;
                
                const pathSpan = document.createElement('span');
                pathSpan.innerText = file.path;
                
                const tokenSpan = document.createElement('span');
                tokenSpan.className = 'token-badge';
                tokenSpan.innerText = file.tokens + ' toks';

                label.appendChild(pathSpan);
                label.appendChild(tokenSpan);

                li.appendChild(checkbox);
                li.appendChild(label);
                fileListUl.appendChild(li);
            });
        }

        function updateStats() {
            const selected = allFiles.filter(f => f.checked);
            const totalTokens = selected.reduce((sum, f) => sum + f.tokens, 0);
            
            fileCountEl.innerText = selected.length;
            tokenCountEl.innerText = '~' + totalTokens;
            
            exportBtn.disabled = selected.length === 0;
            exportBtn.style.opacity = selected.length === 0 ? '0.5' : '1';
        }

        // --- Listeners ---

        searchBox.addEventListener('input', renderList);

        toggleAllBtn.addEventListener('click', () => {
            // Determine state based on visible items
            const filter = searchBox.value.toLowerCase();
            const visibleFiles = allFiles.filter(f => f.path.toLowerCase().includes(filter));
            const allVisibleChecked = visibleFiles.every(f => f.checked);
            
            const newState = !allVisibleChecked;
            visibleFiles.forEach(f => f.checked = newState);
            
            renderList();
            updateStats();
        });

        exportBtn.addEventListener('click', () => {
            const selectedPaths = allFiles.filter(f => f.checked).map(f => f.path);
            vscode.postMessage({ 
                command: 'exportSubset', 
                files: selectedPaths 
            });
        });

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
