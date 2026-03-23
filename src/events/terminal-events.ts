import * as vscode from 'vscode';
import { EventBus } from './event-bus';

const AI_COMMANDS = ['claude', 'aider', 'copilot', 'cursor'];

export function registerTerminalEvents(
  bus: EventBus,
  context: vscode.ExtensionContext
): void {
  // Detect AI tool execution start
  context.subscriptions.push(
    vscode.window.onDidStartTerminalShellExecution?.((e) => {
      const command = e.execution.commandLine?.value?.toLowerCase() ?? '';
      if (AI_COMMANDS.some((cmd) => command.includes(cmd))) {
        bus.emit('ai-start', {});
      }
    }) ?? new vscode.Disposable(() => {})
  );

  // Detect AI tool execution end
  context.subscriptions.push(
    vscode.window.onDidEndTerminalShellExecution?.((e) => {
      const command = e.execution.commandLine?.value?.toLowerCase() ?? '';
      if (AI_COMMANDS.some((cmd) => command.includes(cmd))) {
        bus.emit('ai-end', {});
      }
    }) ?? new vscode.Disposable(() => {})
  );
}
