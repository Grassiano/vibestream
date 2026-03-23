import * as vscode from 'vscode';
import { EventBus } from './event-bus';

const KEYSTROKE_THROTTLE_MS = 200;
const LARGE_FILE_THRESHOLD = 500;
const MASS_DELETE_THRESHOLD = 10;

export function registerEditorEvents(
  bus: EventBus,
  context: vscode.ExtensionContext
): void {
  let lastKeystrokeEmit = 0;
  let previousErrorCount = 0;

  // Track text changes (typing)
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.scheme !== 'file') return;

      const now = Date.now();

      // Detect mass deletion
      for (const change of e.contentChanges) {
        const linesDeleted = change.range.end.line - change.range.start.line;
        if (linesDeleted >= MASS_DELETE_THRESHOLD) {
          bus.emit('mass-delete', {
            linesDeleted,
            fileName: shortName(e.document.fileName),
          });
          return;
        }
      }

      // Throttled keystroke
      if (now - lastKeystrokeEmit > KEYSTROKE_THROTTLE_MS) {
        lastKeystrokeEmit = now;
        bus.emit('keystroke', {
          language: e.document.languageId,
          fileName: shortName(e.document.fileName),
        });
      }
    })
  );

  // Save events
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.uri.scheme !== 'file') return;
      bus.emit('save', {
        fileName: shortName(doc.fileName),
        language: doc.languageId,
      });
    })
  );

  // Diagnostic changes (errors)
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics((e) => {
      let totalErrors = 0;

      for (const uri of e.uris) {
        const diags = vscode.languages.getDiagnostics(uri);
        const errors = diags.filter(
          (d) => d.severity === vscode.DiagnosticSeverity.Error
        );
        totalErrors += errors.length;

        if (errors.length > 0) {
          const firstError = errors[0];
          bus.emit('error-added', {
            errorMessage: firstError.message,
            errorLine: firstError.range.start.line + 1,
            fileName: shortName(uri.fsPath),
            errorCount: errors.length,
          });
        }
      }

      if (totalErrors === 0 && previousErrorCount > 0) {
        bus.emit('all-errors-cleared', {});
      } else if (totalErrors < previousErrorCount && totalErrors > 0) {
        bus.emit('error-cleared', { errorCount: totalErrors });
      }

      previousErrorCount = totalErrors;
    })
  );

  // Active editor change → language change + large file detection
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor || editor.document.uri.scheme !== 'file') return;

      bus.emit('language-change', {
        language: editor.document.languageId,
        fileName: shortName(editor.document.fileName),
      });

      const lineCount = editor.document.lineCount;
      if (lineCount >= LARGE_FILE_THRESHOLD) {
        bus.emit('large-file', {
          fileLineCount: lineCount,
          fileName: shortName(editor.document.fileName),
        });
      }
    })
  );
}

function shortName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] ?? filePath;
}
