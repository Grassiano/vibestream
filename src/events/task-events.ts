import * as vscode from 'vscode';
import { EventBus } from './event-bus';

export function registerTaskEvents(
  bus: EventBus,
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.tasks.onDidEndTaskProcess((e) => {
      const exitCode = e.exitCode ?? -1;
      if (exitCode === 0) {
        bus.emit('build-pass', {});
      } else {
        bus.emit('build-fail', {});
      }
    })
  );
}
