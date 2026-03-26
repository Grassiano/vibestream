import * as vscode from 'vscode';
import { EventBus } from './events/event-bus';
import { registerEditorEvents } from './events/editor-events';
import { registerTerminalEvents } from './events/terminal-events';
import { registerGitEvents } from './events/git-events';
import { registerTaskEvents } from './events/task-events';
import { PanelManager } from './webview/panel-manager';
import { ClaudeConversationWatcher } from './events/claude-conversation-watcher';
import { StreamChatManager } from './stream/stream-chat-manager';
import { SelfImprovementLoop } from './stream/session-analyzer';
import { ViewerEngine, getSpikeAmount } from './stream/viewer-engine';
import { XPEngine, getXPForEvent } from './progression/xp-engine';
import { AchievementTracker } from './progression/achievements';
import { generateRecap } from './progression/session-recap';
import { detectRole, LiveSyncMaster, LiveSyncSlave } from './stream/live-sync';
import { DailyChallengeTracker } from './progression/daily-challenges';


export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('vibeStream');

  const bus = new EventBus();
  const panelManager = new PanelManager(context.extensionUri);

  // Status bar (shared by master + slave)
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'vibeStream.toggle';
  updateStatusBar(statusBarItem, false);
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // ═══ Live Sync — detect master/slave role ═══
  const syncRole = detectRole();
  const syncMaster = syncRole === 'master' ? new LiveSyncMaster() : null;
  let syncSlaveDisposable: vscode.Disposable | undefined;

  // Track current state for master sync writes
  let currentViewerCount = 0;
  let currentHypeLevel = 0;
  let currentXPState = { level: 1, title: 'Prompt Beginner', percent: 0, streak: 0 };
  let currentCombo = { combo: 0, multiplier: 1, active: false };
  let pendingAlert: { alertType: string; data: Record<string, unknown> } | null = null;
  let pendingXPPopup: { amount: number } | null = null;

  function syncWrite(messages: { viewer: string; color: string; text: string }[] = []): void {
    if (!syncMaster) return;
    syncMaster.writeState({
      messages,
      viewerCount: currentViewerCount,
      hypeLevel: currentHypeLevel,
      xp: currentXPState,
      xpPopup: pendingXPPopup,
      combo: currentCombo,
      alert: pendingAlert,
      streamActive: true,
    });
    pendingAlert = null;
    pendingXPPopup = null;
  }

  // If slave — just mirror the master's state and skip all engine setup
  if (syncRole === 'slave') {
    const slave = new LiveSyncSlave({
      onMessages: (msgs) => panelManager.sendStreamChat(msgs, currentViewerCount),
      onViewerCount: (count) => {
        currentViewerCount = count;
        panelManager.sendViewerCount(count);
      },
      onHype: (level) => {
        panelManager.sendHype(level);
      },
      onXPState: (level, title, percent, streak) => {
        panelManager.sendXPState(level, title, percent, streak);
      },
      onXPPopup: (amount) => {
        panelManager.sendXPGain(amount, 0, '', 0);
      },
      onCombo: (combo, multiplier, active) => {
        if (active) panelManager.sendComboUpdate(combo, multiplier);
        else panelManager.sendComboDrop();
      },
      onAlert: (alertType, data) => {
        panelManager.sendAlert(alertType, data);
      },
      onStreamEnd: () => {
        panelManager.setStreamMode(false);
        updateStatusBar(statusBarItem, false);
      },
    });

    // Register webview + status bar for slave
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider('vibeStream.panel', panelManager, {
        webviewOptions: { retainContextWhenHidden: true },
      })
    );

    syncSlaveDisposable = slave.start();
    panelManager.setStreamMode(true);
    updateStatusBar(statusBarItem, true);
    statusBarItem.text = '$(broadcast) VibeStream (synced)';
    statusBarItem.tooltip = 'VibeStream — synced with another window';
    vscode.window.showInformationMessage('VibeStream — joined existing session.');

    context.subscriptions.push(new vscode.Disposable(() => {
      syncSlaveDisposable?.dispose();
    }));

    // Slave can still type in chat — message shows locally + syncs via state file
    panelManager.onStreamerChat = (text: string) => {
      const streamerName = config.get<string>('streamerName', 'Streamer');
      // Show locally (slave renders it)
      panelManager.sendStreamChat(
        [{ viewer: streamerName, color: '#ffd700', text }],
        currentViewerCount,
      );
    };

    // Slave registers minimal commands
    context.subscriptions.push(
      vscode.commands.registerCommand('vibeStream.toggle', () => {
        vscode.commands.executeCommand('workbench.view.extension.vibestream');
      }),
      vscode.commands.registerCommand('vibeStream.show', () => {
        vscode.commands.executeCommand('vibeStream.panel.focus');
      }),
      vscode.commands.registerCommand('vibeStream.settings', () => {
        vscode.window.showInformationMessage('Settings are controlled from the master window.');
      }),
    );

    return; // Slave is done — no engines, no chat manager, just mirroring
  }

  // ═══ From here on: MASTER mode only ═══

  // Achievement tracker
  const achievementTracker = new AchievementTracker();
  let sessionMessagesTyped = 0;
  const sessionStartTime = Date.now();

  // Daily challenges tracker
  const challengeTracker = new DailyChallengeTracker();
  challengeTracker.setOnUpdate((data) => {
    panelManager.sendDailyChallenges(data);
  });
  challengeTracker.setOnComplete((challenge) => {
    xpEngine.earnXP('daily-challenge');
    panelManager.sendStreamChat(
      [{ viewer: 'System', color: '#fbbf24', text: `🏆 Challenge complete: ${challenge.title}! +${challenge.xp_reward} XP` }],
      viewerEngine.getCount(),
    );
  });
  challengeTracker.setOnAllComplete(() => {
    xpEngine.earnXP('all-dailies');
    panelManager.sendStreamChat(
      [{ viewer: 'System', color: '#ffd700', text: '🎉 ALL DAILY CHALLENGES COMPLETE! +150 bonus XP!' }],
      viewerEngine.getCount(),
    );
    panelManager.sendAlert('achievement', { name: 'Daily Sweep', icon: '🧹' });
  });
  challengeTracker.fetchAndLoad(backendUrl);

  // Periodic achievement check — every 60 seconds
  const achievementTimer = setInterval(() => {
    const profile = xpEngine.getProfile();
    const newAchievements = achievementTracker.check({
      totalXP: profile.xp,
      level: profile.level,
      sessionMinutes: Math.floor((Date.now() - sessionStartTime) / 60_000),
      sessionXP: 0,
      totalSessions: profile.totalSessions,
      totalCommits: profile.totalCommits,
      totalPushes: profile.totalPushes,
      totalErrorsFixed: profile.totalErrorsFixed,
      peakViewers: profile.peakViewers,
      streakDays: profile.streakDays,
      totalWatchMinutes: profile.totalWatchMinutes,
      currentCombo: xpEngine.getCombo(),
      peakCombo: 0,
      messagesTyped: sessionMessagesTyped,
    });

    for (const achievement of newAchievements) {
      panelManager.sendAchievement(achievement.name, achievement.icon, achievement.description);
      panelManager.sendStreamChat(
        [{ viewer: 'System', color: '#ffd700', text: `🏆 ${achievement.name} unlocked!` }],
        viewerEngine.getCount(),
      );
    }
  }, 60_000);

  context.subscriptions.push(new vscode.Disposable(() => clearInterval(achievementTimer)));

  // XP progression engine (must be created before viewerEngine since milestone callback uses it)
  const xpEngine = new XPEngine({
    onXPGain: (amount, total, source) => {
      const progress = xpEngine.getXPProgress();
      panelManager.sendXPGain(amount, xpEngine.getLevel(), xpEngine.getTitle(), progress.percent);
      currentXPState = { level: xpEngine.getLevel(), title: xpEngine.getTitle(), percent: progress.percent, streak: xpEngine.getProfile().streakDays };
      pendingXPPopup = { amount };
      syncWrite();
    },
    onLevelUp: (level, title) => {
      pendingAlert = { alertType: 'level-up', data: { level, title } };
      panelManager.sendAlert('level-up', { level, title });
      const msgs = [{ viewer: 'System', color: '#ffd700', text: `LEVEL UP! Level ${level} — ${title} 🎉` }];
      panelManager.sendStreamChat(msgs, viewerEngine.getCount());
      syncWrite(msgs);
    },
    onComboUpdate: (combo, multiplier) => {
      panelManager.sendComboUpdate(combo, multiplier);
      currentCombo = { combo, multiplier, active: true };
      if (combo >= 5) {
        panelManager.sendAlert('combo', { multiplier });
      }
    },
    onComboDrop: () => {
      panelManager.sendComboDrop();
    },
  });

  // Viewer count engine — physics-based viewer count
  const viewerEngine = new ViewerEngine({
    onCountUpdate: (count) => {
      currentViewerCount = count;
      panelManager.sendViewerCount(count);
      xpEngine.updatePeakViewers(count);
      syncWrite(); // Sync viewer count to slave on every tick
    },
    onMilestone: (milestone) => {
      xpEngine.earnXP('milestone');
      pendingAlert = { alertType: 'milestone', data: { viewers: milestone } };
      panelManager.sendAlert('milestone', { viewers: milestone });
      const msgs = [{ viewer: 'System', color: '#ffd700', text: `${milestone} VIEWERS! 🎉` }];
      panelManager.sendStreamChat(msgs, viewerEngine.getCount());
      syncWrite(msgs);
    },
  });

  // Stream chat manager
  const streamChat = new StreamChatManager(bus);
  const backendUrl = config.get<string>('backendUrl', 'https://backend-production-6558.up.railway.app');
  const licenseKey = config.get<string>('licenseKey', '');
  streamChat.setBackend(backendUrl, licenseKey);

  streamChat.setOnChat((messages, viewerCount) => {
    panelManager.sendStreamChat(messages, viewerCount);
    syncWrite(messages);
  });
  streamChat.setOnViewerUpdate((count) => {
    // Use viewer engine instead of direct count
    viewerEngine.spike(5);
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
    viewerEngine.spike(getSpikeAmount('streamer-chat'));
    viewerEngine.activity();
    sessionMessagesTyped++;
    // Sync streamer message to slave windows
    const streamerName = config.get<string>('streamerName', 'Streamer');
    syncWrite([{ viewer: streamerName, color: '#ffd700', text }]);
  };

  // Self-improvement loop — analyzes chat quality every 30 min
  const improvementLoop = new SelfImprovementLoop(backendUrl, licenseKey, config.get<string>('language', 'he'));
  improvementLoop.setOnImproved(() => {
    // Stream chat manager will reload improvements on next LLM call automatically
    // (it calls loadImprovements() in buildPrompt)
  });

  // Setup callback — user completed first-time setup
  let streamChatDisposable: vscode.Disposable | undefined;
  let viewerEngineDisposable: vscode.Disposable | undefined;
  let improvementDisposable: vscode.Disposable | undefined;

  function startEngines(): void {
    viewerEngineDisposable?.dispose();
    improvementDisposable?.dispose();
    viewerEngineDisposable = viewerEngine.start();
    improvementDisposable = improvementLoop.start();
    // Send initial XP state to webview
    const progress = xpEngine.getXPProgress();
    const profile = xpEngine.getProfile();
    panelManager.sendXPState(xpEngine.getLevel(), xpEngine.getTitle(), progress.percent, profile.streakDays);
  }

  panelManager.onStreamSetup = (setupConfig) => {
    const cfg = vscode.workspace.getConfiguration('vibeStream');
    const previousLang = cfg.get<string>('language', 'he');
    const langChanged = previousLang !== setupConfig.lang;

    cfg.update('streamerName', setupConfig.name, vscode.ConfigurationTarget.Global);
    cfg.update('language', setupConfig.lang, vscode.ConfigurationTarget.Global);
    cfg.update('chatStyle', setupConfig.style, vscode.ConfigurationTarget.Global);
    cfg.update('enabled', true, vscode.ConfigurationTarget.Global);

    streamChat.setConfig(setupConfig.name, setupConfig.lang, setupConfig.style);

    if (langChanged && streamChat.isActive()) {
      // Language changed — full restart with new viewer roster
      vscode.window.showInformationMessage(
        'Language changed — stream restarting with new viewers.'
      );
      streamChatDisposable?.dispose();
      streamChatDisposable = streamChat.start();
      improvementLoop.updateConfig(setupConfig.lang);
      startEngines();
      panelManager.setStreamMode(true);
    } else if (!streamChat.isActive()) {
      streamChatDisposable = streamChat.start();
      startEngines();
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
      startEngines();
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
      // Earn XP for prompting Claude
      xpEngine.earnXP('convo-user-prompted');
      viewerEngine.activity();
      viewerEngine.spike(getSpikeAmount('convo-user-prompted'));

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
      // Earn XP for Claude responses (vibe coding IS coding)
      if (data.responseLength > 0) {
        xpEngine.earnXP('claude-response');
        viewerEngine.activity();
        viewerEngine.spike(getSpikeAmount('ai-end'));
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

  // Wire event bus → viewer engine + XP engine + stream chat
  context.subscriptions.push(
    bus.on((event) => {
      // Viewer engine — spike viewer count on events
      const spikeAmount = getSpikeAmount(event.type);
      if (spikeAmount > 0) {
        viewerEngine.activity();
        viewerEngine.spike(spikeAmount);
      }

      // XP engine — award XP on events
      if (getXPForEvent(event.type)) {
        xpEngine.earnXP(event.type);
      }

      // Daily challenges — track coding events
      challengeTracker.processEvent(event.type);

      // Stream chat — feed coding context
      if (!streamChat.isActive()) return;
      if (
        event.type === 'git-commit' ||
        event.type === 'git-push' ||
        event.type === 'build-pass' ||
        event.type === 'build-fail' ||
        event.type === 'error-added' ||
        event.type === 'all-errors-cleared' ||
        event.type === 'save' ||
        event.type === 'error-cleared'
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
      vscode.commands.executeCommand('workbench.view.extension.vibestream');

      if (streamChat.isActive()) {
        streamChatDisposable?.dispose();
        streamChatDisposable = undefined;
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
        startEngines();
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
      // Trigger open-settings via the panel's existing handler
      setTimeout(() => {
        panelManager.setStreamMode(true, true);
      }, 200);
    })
  );

  // Cleanup — generate session recap on exit
  context.subscriptions.push(
    new vscode.Disposable(() => {
      // Session recap
      if (streamChat.isActive()) {
        const score = xpEngine.endSession();
        const profile = xpEngine.getProfile();
        const unlockedNames = achievementTracker.getUnlocked().map(a => a.name);
        const recap = generateRecap(score, profile, unlockedNames, []);
        panelManager.sendSessionRecap(recap as unknown as Record<string, unknown>);
      }

      convoWatcher.dispose();
      improvementDisposable?.dispose();
      streamChatDisposable?.dispose();
      viewerEngineDisposable?.dispose();
      xpEngine.dispose();
      syncMaster?.dispose();
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
