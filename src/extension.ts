import * as vscode from 'vscode';
import { EventBus } from './events/event-bus';
import { registerEditorEvents } from './events/editor-events';
import { registerTerminalEvents } from './events/terminal-events';
import { registerGitEvents } from './events/git-events';
import { registerTaskEvents } from './events/task-events';
import { PanelManager } from './webview/panel-manager';
import { ClaudeConversationWatcher } from './events/claude-conversation-watcher';
import { StreamChatManager } from './stream/stream-chat-manager';
import { analyzeSession } from './stream/session-analyzer';

let streamActive = false;

export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('vibeStream');

  const bus = new EventBus();
  const panelManager = new PanelManager(context.extensionUri);

  // Status bar
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'vibeStream.toggle';
  updateStatusBar(statusBarItem, false);
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Stream chat manager
  const streamChat = new StreamChatManager(bus);

  streamChat.setOnChat((messages, viewerCount) => {
    panelManager.sendStreamChat(messages, viewerCount);
  });
  streamChat.setOnViewerUpdate((count) => {
    panelManager.sendViewerCount(count);
  });
  streamChat.setOnProfiles((profiles) => {
    panelManager.sendViewerProfiles(profiles);
  });
  streamChat.setOnRankUp((viewer, rank) => {
    panelManager.sendStreamChat(
      [{ viewer: 'System', color: '#bf94ff', text: `${viewer} ranked up to ${rank.toUpperCase()}!` }],
      0,
    );
  });

  // Viewer profile click → send profile data to webview
  panelManager.onViewerProfileClick = (name: string) => {
    const profile = streamChat.getProfileForViewer(name);
    if (profile) {
      panelManager.sendViewerProfile(profile);
    }
  };

  // Streamer types in chat → LLM reacts to their message
  panelManager.onStreamerChat = (text: string) => {
    streamChat.reactToStreamerMessage(text);
  };

  // Setup callback — user completed first-time setup
  let streamChatDisposable: vscode.Disposable | undefined;

  panelManager.onStreamSetup = (setupConfig) => {
    const cfg = vscode.workspace.getConfiguration('vibeStream');
    cfg.update('streamerName', setupConfig.name, vscode.ConfigurationTarget.Global);
    cfg.update('language', setupConfig.lang, vscode.ConfigurationTarget.Global);
    cfg.update('chatStyle', setupConfig.style, vscode.ConfigurationTarget.Global);
    cfg.update('enabled', true, vscode.ConfigurationTarget.Global);

    streamChat.setConfig(setupConfig.name, setupConfig.lang, setupConfig.style);

    if (!streamChat.isActive()) {
      streamChatDisposable = streamChat.start();
      streamActive = true;
      updateStatusBar(statusBarItem, true);
    }
  };

  // Auto-start if already configured
  const isEnabled = config.get<boolean>('enabled', false);
  const savedStreamerName = config.get<string>('streamerName', '');

  if (isEnabled) {
    if (savedStreamerName) {
      const lang = config.get<string>('language', 'he');
      const style = config.get<string>('chatStyle', 'hype');
      streamChat.setConfig(savedStreamerName, lang, style);
      streamChatDisposable = streamChat.start();
      streamActive = true;
      updateStatusBar(statusBarItem, true);
      panelManager.setStreamMode(true);
    } else {
      // First time — show setup screen
      panelManager.setStreamMode(true, true);
    }
  }

  // Claude conversation watcher — feeds context into stream chat
  const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name ?? 'unknown';
  const convoWatcher = new ClaudeConversationWatcher(workspaceName);

  context.subscriptions.push(
    convoWatcher.onPrompt((evt) => {
      if (streamChat.isActive()) {
        streamChat.feedClaudeContext(
          evt.lastPrompt,
          evt.userTopic,
          evt.userIntent,
          evt.conversationDepth,
        );
      }
    })
  );

  context.subscriptions.push(
    convoWatcher.onResponse((data) => {
      if (streamChat.isActive()) {
        streamChat.feedClaudeResponse(
          data.responseSummary,
          data.responseLength,
          data.codeBlockCount,
          data.filesModified,
        );
      }
    })
  );

  convoWatcher.start();

  // Watch config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('vibeStream.enabled') ||
        e.affectsConfiguration('vibeStream.streamerName') ||
        e.affectsConfiguration('vibeStream.language') ||
        e.affectsConfiguration('vibeStream.chatStyle')
      ) {
        const updated = vscode.workspace.getConfiguration('vibeStream');
        const name = updated.get<string>('streamerName', '');
        const lang = updated.get<string>('language', 'he');
        const style = updated.get<string>('chatStyle', 'hype');
        if (name) {
          streamChat.setConfig(name, lang, style);
        }
      }
    })
  );

  // Register webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('vibeStream.panel', panelManager, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Register event listeners
  registerEditorEvents(bus, context);
  registerTerminalEvents(bus, context);
  registerGitEvents(bus, context);
  registerTaskEvents(bus, context);

  // Wire event bus → stream chat (feed coding activity as context)
  context.subscriptions.push(
    bus.on((event) => {
      if (!streamChat.isActive()) return;

      if (
        event.type === 'git-commit' ||
        event.type === 'git-push' ||
        event.type === 'build-pass' ||
        event.type === 'build-fail' ||
        event.type === 'error-added' ||
        event.type === 'all-errors-cleared'
      ) {
        streamChat.feedClaudeContext(
          event.type,
          event.context.userTopic ?? event.type,
          event.context.userIntent ?? 'coding',
          event.context.conversationDepth ?? 1,
        );
      }
    })
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('vibeStream.toggle', () => {
      vscode.commands.executeCommand('workbench.view.extension.vibe-stream');

      if (streamChat.isActive()) {
        streamChatDisposable?.dispose();
        streamChatDisposable = undefined;
        streamActive = false;
        updateStatusBar(statusBarItem, false);
        panelManager.setStreamMode(false);
        vscode.window.showInformationMessage('VibeStream — stream stopped.');
      } else {
        const cfg = vscode.workspace.getConfiguration('vibeStream');
        const name = cfg.get<string>('streamerName', '');

        if (!name) {
          panelManager.setStreamMode(true, true);
          vscode.commands.executeCommand('vibeStream.panel.focus');
          return;
        }

        const lang = cfg.get<string>('language', 'he');
        const style = cfg.get<string>('chatStyle', 'hype');
        streamChat.setConfig(name, lang, style);
        streamChatDisposable = streamChat.start();
        streamActive = true;
        updateStatusBar(statusBarItem, true);
        panelManager.setStreamMode(true);
        vscode.window.showInformationMessage('VibeStream — your viewers are watching!');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibeStream.show', () => {
      vscode.commands.executeCommand('vibeStream.panel.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibeStream.settings', () => {
      vscode.commands.executeCommand('vibeStream.panel.focus');
      panelManager.sendMessage({ type: 'openSettings' });
    })
  );

  // Cleanup
  context.subscriptions.push(
    new vscode.Disposable(() => {
      convoWatcher.dispose();
      streamChatDisposable?.dispose();

      const backendUrl = vscode.workspace
        .getConfiguration('vibeStream')
        .get<string>('backendUrl', '');
      if (backendUrl && streamChat.isActive()) {
        analyzeSession(backendUrl).catch(() => { /* silent */ });
      }
    })
  );
}

export function deactivate(): void {
  // Cleanup handled by disposables
}

function updateStatusBar(item: vscode.StatusBarItem, active: boolean): void {
  if (active) {
    item.text = '$(broadcast) VibeStream';
    item.tooltip = 'VibeStream is LIVE — click to stop';
    item.color = undefined;
  } else {
    item.text = '$(broadcast) VibeStream';
    item.tooltip = 'VibeStream is OFF — click to go live';
    item.color = new vscode.ThemeColor('disabledForeground');
  }
}
