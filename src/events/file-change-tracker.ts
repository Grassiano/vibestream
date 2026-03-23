import * as vscode from 'vscode';
import * as path from 'path';

export interface FileChangeSummary {
  filesChanged: string[];
  fileCount: number;
  linesChanged: number;
  isNewFiles: boolean;
}

export class FileChangeTracker implements vscode.Disposable {
  private tracking = false;
  private changedFiles = new Set<string>();
  private createdFiles = new Set<string>();
  private totalLinesChanged = 0;
  private disposables: vscode.Disposable[] = [];

  startTracking(): void {
    if (this.tracking) return;
    this.reset();
    this.tracking = true;

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.scheme !== 'file') return;
        if (!this.tracking) return;

        const basename = path.basename(e.document.fileName);
        this.changedFiles.add(basename);

        for (const change of e.contentChanges) {
          const deletedLines = change.range.end.line - change.range.start.line;
          const insertedLines = change.text.split('\n').length - 1;
          this.totalLinesChanged += Math.max(deletedLines, insertedLines, 1);
        }
      })
    );

    this.disposables.push(
      vscode.workspace.onDidCreateFiles((e) => {
        if (!this.tracking) return;
        for (const file of e.files) {
          const basename = path.basename(file.fsPath);
          this.createdFiles.add(basename);
          this.changedFiles.add(basename);
        }
      })
    );
  }

  stopTracking(): FileChangeSummary {
    this.tracking = false;
    const summary = this.getSummary();
    this.disposeListeners();
    return summary;
  }

  getSummary(): FileChangeSummary {
    const filesChanged = [...this.changedFiles];
    return {
      filesChanged,
      fileCount: filesChanged.length,
      linesChanged: this.totalLinesChanged,
      isNewFiles: this.createdFiles.size > 0,
    };
  }

  reset(): void {
    this.changedFiles.clear();
    this.createdFiles.clear();
    this.totalLinesChanged = 0;
  }

  private disposeListeners(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }

  dispose(): void {
    this.tracking = false;
    this.disposeListeners();
    this.reset();
  }
}
