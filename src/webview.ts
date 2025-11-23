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
          case 'export':
            vscode.commands.executeCommand('workspaceExporter.exportWithTemplate');
            return;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Create or reveal the preview panel.
   * @param extensionUri The URI of the extension.
   */
  public static createOrShow(extensionUri: vscode.Uri) {
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
  public update(stats: { totalFiles: number; totalTokens: number; fileList: string[] }) {
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
        body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); }
        .stats { display: flex; gap: 20px; margin-bottom: 20px; }
        .stat-box { background: var(--vscode-editor-widget-background); padding: 15px; border: 1px solid var(--vscode-widget-border); border-radius: 4px; min-width: 150px; }
        .stat-value { font-size: 24px; font-weight: bold; margin-top: 5px; }
        ul { list-style: none; padding: 0; max-height: 400px; overflow-y: auto; border: 1px solid var(--vscode-widget-border); border-radius: 4px; }
        li { padding: 8px 12px; border-bottom: 1px solid var(--vscode-widget-border); }
        li:last-child { border-bottom: none; }
        button { 
            background-color: var(--vscode-button-background); 
            color: var(--vscode-button-foreground); 
            border: none; 
            padding: 10px 20px; 
            font-size: 16px; 
            cursor: pointer; 
            border-radius: 2px;
            margin-top: 20px;
        }
        button:hover { background-color: var(--vscode-button-hoverBackground); }
      </style>
    </head>
    <body>
      <h1>Export Preview</h1>
      <p>Select a template to see statistics here. (Run "Preview Export Stats" command)</p>
      
      <div class="stats">
        <div class="stat-box">
            <h3>Total Files</h3>
            <div id="file-count" class="stat-value">-</div>
        </div>
        <div class="stat-box">
            <h3>Est. Tokens</h3>
            <div id="token-count" class="stat-value">-</div>
        </div>
      </div>

      <h3>Files to be Exported</h3>
      <ul id="file-list">
        <li style="padding: 20px; text-align: center; color: var(--vscode-descriptionForeground);">No data yet.</li>
      </ul>

      <button id="export-btn">Run Export...</button>

      <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('export-btn').addEventListener('click', () => {
            vscode.postMessage({ command: 'export' });
        });

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'update') {
                document.getElementById('file-count').innerText = message.stats.totalFiles;
                document.getElementById('token-count').innerText = '~' + message.stats.totalTokens;
                const list = document.getElementById('file-list');
                if (message.stats.fileList.length > 0) {
                    list.innerHTML = message.stats.fileList.map(f => '<li>' + f + '</li>').join('');
                } else {
                    list.innerHTML = '<li style="padding: 20px; text-align: center;">No files found.</li>';
                }
            }
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
