import * as vscode from 'vscode';

export class PanelManager implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | null = null;
  private streamMode = false;
  private lastViewerCount = 5;
  private lastXPState: { level: number; title: string; percent: number; streak: number } | null = null;
  onStreamerChat: ((text: string) => void) | undefined;
  onStreamSetup: ((config: { name: string; lang: string; style: string }) => void) | undefined;
  onViewerProfileClick: ((name: string) => void) | undefined;

  constructor(private extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.type === 'ready') {
        this.sendAlertUris(webviewView.webview);
        const cfg = vscode.workspace.getConfiguration('vibeStream');
        const hasName = !!cfg.get<string>('streamerName', '');
        if (this.streamMode) {
          this.view?.webview.postMessage({
            type: 'stream-mode',
            payload: { enabled: true, needsSetup: !hasName },
          });
          this.view?.webview.postMessage({
            type: 'viewer-count',
            payload: { count: this.lastViewerCount },
          });
        } else {
          // Not yet enabled — show setup screen so user can configure
          this.view?.webview.postMessage({
            type: 'stream-mode',
            payload: { enabled: true, needsSetup: true },
          });
        }
        // Always send cached XP state on ready
        if (this.lastXPState) {
          this.view?.webview.postMessage({ type: 'xp-state', payload: this.lastXPState });
        }
      }
      if (message.type === 'streamer-chat' && message.text) {
        this.onStreamerChat?.(message.text as string);
      }
      if (message.type === 'stream-setup' && message.payload) {
        const config = message.payload as { name: string; lang: string; style: string };
        this.onStreamSetup?.(config);
        // After setup, show the chat
        this.view?.webview.postMessage({
          type: 'stream-mode',
          payload: { enabled: true },
        });
      }
      if (message.type === 'viewer-profile-click' && message.name) {
        this.onViewerProfileClick?.(message.name as string);
      }
      if (message.type === 'open-settings') {
        // Send current saved config to webview for pre-fill
        const cfg = vscode.workspace.getConfiguration('vibeStream');
        this.view?.webview.postMessage({
          type: 'stream-config',
          payload: {
            name: cfg.get<string>('streamerName', ''),
            lang: cfg.get<string>('language', 'he'),
            style: cfg.get<string>('chatStyle', 'hype'),
          },
        });
        // Show setup screen in edit mode
        this.view?.webview.postMessage({
          type: 'stream-mode',
          payload: { enabled: true, needsSetup: true, editMode: true },
        });
      }
    });

  }

  sendStreamChat(messages: { viewer: string; color: string; text: string }[], viewerCount: number, isHype?: boolean): void {
    this.view?.webview.postMessage({
      type: 'stream-chat',
      payload: { messages, viewerCount, isHype: isHype ?? false },
    });
  }

  sendViewerCount(count: number): void {
    this.lastViewerCount = count;
    this.view?.webview.postMessage({
      type: 'viewer-count',
      payload: { count },
    });
  }

  sendViewerProfiles(profiles: unknown[]): void {
    this.view?.webview.postMessage({
      type: 'viewer-profiles',
      payload: profiles,
    });
  }

  sendViewerProfile(profile: unknown): void {
    this.view?.webview.postMessage({
      type: 'viewer-profile',
      payload: profile,
    });
  }

  sendXpUpdate(data: { xp: number; level: number; title: string; percent: number; combo: number; comboMultiplier: number; totalXp: number }): void {
    this.view?.webview.postMessage({ type: 'xp-update', payload: data });
  }

  sendXpPopup(xp: number, combo: number): void {
    this.view?.webview.postMessage({ type: 'xp-popup', payload: { xp, combo } });
  }

  sendLevelUp(level: number, title: string): void {
    this.view?.webview.postMessage({ type: 'level-up', payload: { level, title } });
  }

  sendComboUpdate(combo: number, multiplier: number): void {
    this.view?.webview.postMessage({ type: 'combo-update', payload: { combo, multiplier } });
  }

  sendComboDrop(): void {
    this.view?.webview.postMessage({ type: 'combo-drop' });
  }

  sendHype(level: number): void {
    this.view?.webview.postMessage({ type: 'hype-level', payload: { level } });
  }

  sendAchievement(name: string, icon: string, description: string): void {
    this.view?.webview.postMessage({
      type: 'achievement',
      payload: { name, icon, description },
    });
  }

  sendSessionRecap(recap: Record<string, unknown>): void {
    this.view?.webview.postMessage({
      type: 'session-recap',
      payload: recap,
    });
  }

  sendXPGain(amount: number, level: number, title: string, percent: number): void {
    this.view?.webview.postMessage({
      type: 'xp-gain',
      payload: { amount, level, title, percent },
    });
  }

  sendXPState(level: number, title: string, percent: number, streak: number): void {
    this.lastXPState = { level, title, percent, streak };
    this.view?.webview.postMessage({
      type: 'xp-state',
      payload: { level, title, percent, streak },
    });
  }

  sendAlert(alertType: string, data: Record<string, unknown>): void {
    this.view?.webview.postMessage({
      type: 'alert',
      payload: { alertType, ...data },
    });
  }

  private sendAlertUris(webview: vscode.Webview): void {
    const alerts: Record<string, string> = {};
    for (const name of ['level-up', 'milestone', 'combo']) {
      const uri = webview.asWebviewUri(
        vscode.Uri.joinPath(this.extensionUri, 'media', 'alerts', `${name}.png`)
      );
      alerts[name] = uri.toString();
    }
    this.view?.webview.postMessage({ type: 'alert-uris', payload: alerts });
  }

  setStreamMode(enabled: boolean, needsSetup = false): void {
    this.streamMode = enabled;
    this.view?.webview.postMessage({
      type: 'stream-mode',
      payload: { enabled, needsSetup },
    });
  }

  isStreamMode(): boolean {
    return this.streamMode;
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'webview.js')
    );
    const nonce = getNonce();
    const alertLevelUp = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'alerts', 'level-up.png'));
    const alertMilestone = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'alerts', 'milestone.png'));
    const alertCombo = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'alerts', 'combo.png'));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
  <title>VibeStream</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #stage {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
    }
    /* ═══════════════ Stream Chat ═══════════════ */
    #stream-chat-container {
      display: none;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      flex-direction: column;
      overflow: hidden;
      z-index: 20;
      background: #0e0e10;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #stream-chat-container.active {
      display: flex;
    }
    /* ── Top bar ── */
    #viewer-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: linear-gradient(135deg, #18181b 0%, #1f1f23 100%);
      border-bottom: 2px solid #2f2f35;
      font-size: 12px;
    }
    #stream-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #fff;
    }
    #stream-label .live-badge {
      background: #ef4444;
      color: #fff;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 1px;
      animation: live-pulse 2s ease infinite;
    }
    @keyframes live-pulse {
      0%, 100% { background: #ef4444; box-shadow: 0 0 6px rgba(239,68,68,0.5); }
      50% { background: #dc2626; box-shadow: 0 0 12px rgba(239,68,68,0.8); }
    }
    #viewer-count {
      display: flex;
      align-items: center;
      gap: 5px;
      color: #efeff1;
      font-weight: 600;
      font-size: 12px;
    }
    #viewer-count .eye-icon {
      font-size: 14px;
      opacity: 0.7;
    }
    /* ── Hype bar ── */
    #hype-bar {
      height: 3px;
      background: #2f2f35;
      overflow: hidden;
      flex-shrink: 0;
    }
    #hype-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #9146ff, #ff75e6, #ffb800);
      background-size: 200% 100%;
      animation: hype-shift 2s linear infinite;
      transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes hype-shift {
      0% { background-position: 0% 0%; }
      100% { background-position: 200% 0%; }
    }
    /* ── Chat area ── */
    #chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      scrollbar-width: thin;
    }
    #chat-messages::before {
      content: '';
      flex: 1;
    }
    #chat-messages::-webkit-scrollbar {
      width: 4px;
    }
    #chat-messages::-webkit-scrollbar-track {
      background: transparent;
    }
    #chat-messages::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
    }
    #chat-messages::-webkit-scrollbar-thumb:hover {
      background: rgba(255,255,255,0.2);
    }
    /* ── Single message ── */
    .chat-msg {
      font-size: 13px;
      line-height: 1.6;
      padding: 2px 0;
      animation: msg-in 0.25s ease-out;
      word-break: break-word;
      direction: ltr;
      text-align: left;
    }
    .chat-msg:hover {
      background: rgba(255,255,255,0.03);
    }
    .chat-msg .badge {
      display: inline-block;
      font-size: 8px;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 2px;
      margin-right: 4px;
      vertical-align: middle;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .chat-msg .badge-mod {
      background: #00ad03;
      color: #fff;
    }
    .chat-msg .badge-vip {
      background: #e005b9;
      color: #fff;
    }
    .chat-msg .badge-sub {
      background: #9146ff;
      color: #fff;
    }
    .chat-msg .badge-og {
      background: #ff6b00;
      color: #fff;
    }
    .chat-msg .viewer-name {
      font-weight: 700;
      margin-right: 3px;
      cursor: pointer;
    }
    .chat-msg .viewer-name::after {
      content: ':';
      color: #adadb8;
    }
    .chat-msg .msg-text {
      color: #efeff1;
      unicode-bidi: plaintext;
      direction: ltr;
    }
    /* ── Emote-style text ── */
    .chat-msg .emote {
      font-weight: 800;
      font-style: italic;
    }
    /* ── Hype message highlight ── */
    .chat-msg.hype-msg {
      background: linear-gradient(90deg, rgba(145,70,255,0.1), rgba(255,184,0,0.05));
      border-left: 2px solid #9146ff;
      padding-left: 8px;
      margin-left: -12px;
      padding-right: 12px;
    }
    /* ── System messages ── */
    .chat-msg.system-msg {
      color: #bf94ff;
      font-style: italic;
      font-size: 11px;
      text-align: center;
      padding: 4px 0;
    }
    @keyframes msg-in {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    /* ── Streamer message ── */
    .chat-msg.streamer-msg {
      background: linear-gradient(90deg, rgba(255,215,0,0.12), rgba(255,215,0,0.03));
      border-left: 3px solid #ffd700;
      padding: 4px 8px;
      margin: 4px -12px 4px -12px;
      padding-left: 12px;
      padding-right: 12px;
    }
    .chat-msg .badge-streamer {
      background: linear-gradient(135deg, #ffd700, #ff8c00);
      color: #000;
      font-weight: 900;
      padding: 1px 5px;
      border-radius: 2px;
      font-size: 8px;
      margin-right: 5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      vertical-align: middle;
      display: inline-block;
    }
    .chat-msg.streamer-msg .viewer-name {
      color: #ffd700 !important;
    }
    /* ── Bottom input bar ── */
    #chat-input-bar {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background: #18181b;
      border-top: 1px solid #2f2f35;
      gap: 8px;
    }
    #chat-input {
      flex: 1;
      height: 32px;
      background: #3a3a3d;
      border: 1px solid #464649;
      border-radius: 4px;
      padding: 0 10px;
      color: #efeff1;
      font-size: 12px;
      outline: none;
      font-family: inherit;
    }
    #chat-input::placeholder {
      color: #adadb8;
    }
    #chat-input:focus {
      border-color: #9146ff;
      box-shadow: 0 0 0 1px rgba(145,70,255,0.3);
    }
    #chat-send-btn {
      background: #9146ff;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s;
    }
    #chat-send-btn:hover {
      background: #772ce8;
    }
    #chat-send-btn:active {
      background: #5c16c5;
    }
    /* ── XP Bar ── */
    #xp-bar-container {
      display: flex;
      align-items: center;
      padding: 6px 12px;
      background: #18181b;
      border-top: 1px solid #2f2f35;
      gap: 8px;
      font-size: 11px;
      color: #adadb8;
      flex-shrink: 0;
    }
    #xp-level-badge {
      background: linear-gradient(135deg, #9146ff, #6366f1);
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    #xp-bar-track {
      flex: 1;
      height: 6px;
      background: #2f2f35;
      border-radius: 3px;
      overflow: hidden;
      position: relative;
    }
    #xp-bar-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #9146ff, #a855f7, #c084fc);
      border-radius: 3px;
      transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    #xp-bar-fill.level-up {
      background: linear-gradient(90deg, #ffd700, #ffaa00, #ffd700);
      animation: xp-flash 0.6s ease 2;
    }
    @keyframes xp-flash {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    #xp-label {
      font-size: 10px;
      color: #71717a;
      white-space: nowrap;
      flex-shrink: 0;
    }
    #combo-badge {
      display: none;
      font-size: 10px;
      font-weight: 800;
      color: #fbbf24;
      white-space: nowrap;
      flex-shrink: 0;
      animation: combo-pulse 0.5s ease;
    }
    #combo-badge.active { display: inline; }
    @keyframes combo-pulse {
      0% { transform: scale(1.5); }
      100% { transform: scale(1); }
    }
    /* ── Floating XP popup ── */
    .xp-popup {
      position: absolute;
      right: 12px;
      font-size: 13px;
      font-weight: 800;
      color: #a855f7;
      pointer-events: none;
      animation: xp-float 1.5s ease-out forwards;
      z-index: 35;
      text-shadow: 0 1px 4px rgba(0,0,0,0.5);
    }
    .xp-popup.big {
      font-size: 16px;
      color: #fbbf24;
    }
    .xp-popup.huge {
      font-size: 20px;
      color: #ffd700;
      text-shadow: 0 0 10px rgba(255,215,0,0.5);
    }
    @keyframes xp-float {
      0% { opacity: 1; transform: translateY(0) scale(1.2); }
      30% { opacity: 1; transform: translateY(-20px) scale(1); }
      100% { opacity: 0; transform: translateY(-60px) scale(0.8); }
    }
    /* ── Alert Overlay ── */
    #alert-overlay {
      display: none;
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 55;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      background: rgba(0,0,0,0.4);
    }
    #alert-overlay.active {
      display: flex;
      animation: alert-bg-in 0.3s ease;
    }
    @keyframes alert-bg-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    #alert-container {
      position: relative;
      width: 90%;
      max-width: 320px;
    }
    #alert-image {
      width: 100%;
      height: auto;
      border-radius: 8px;
      animation: alert-slam 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes alert-slam {
      0% { opacity: 0; transform: scale(0.2) rotate(-5deg); }
      50% { opacity: 1; transform: scale(1.08) rotate(1deg); }
      75% { transform: scale(0.97) rotate(-0.5deg); }
      100% { transform: scale(1) rotate(0deg); }
    }
    #alert-subtitle {
      position: absolute;
      bottom: 22%;
      left: 50%;
      transform: translateX(-50%);
      text-align: center;
      font-size: 22px;
      font-weight: 900;
      color: #fff;
      text-shadow: 0 0 12px rgba(145,70,255,0.8), 0 0 24px rgba(145,70,255,0.4), 0 2px 4px rgba(0,0,0,0.9);
      letter-spacing: 1px;
      white-space: nowrap;
      animation: alert-subtitle-in 0.5s ease 0.3s both;
    }
    @keyframes alert-subtitle-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    #alert-overlay.fade-out {
      animation: alert-fade-out 0.5s ease forwards;
    }
    @keyframes alert-fade-out {
      to { opacity: 0; }
    }
    /* ── Profile card overlay ── */
    #profile-overlay {
      display: none;
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 40;
      background: rgba(0,0,0,0.5);
      align-items: center;
      justify-content: center;
    }
    #profile-overlay.active { display: flex; }
    #profile-card {
      background: #1f1f23;
      border: 1px solid #2f2f35;
      border-radius: 12px;
      padding: 20px;
      width: 220px;
      position: relative;
      animation: card-in 0.2s ease-out;
    }
    @keyframes card-in {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    #profile-close {
      position: absolute;
      top: 6px;
      right: 8px;
      background: none;
      border: none;
      color: #adadb8;
      font-size: 16px;
      cursor: pointer;
      padding: 2px 6px;
      line-height: 1;
    }
    #profile-close:hover { color: #fff; }
    .profile-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .profile-avatar {
      font-size: 28px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(145,70,255,0.15);
      border-radius: 50%;
      flex-shrink: 0;
    }
    .profile-name {
      font-size: 14px;
      font-weight: 800;
      color: #efeff1;
      line-height: 1.2;
    }
    .profile-rank {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .profile-rank-badge {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 8px;
      font-weight: 800;
      margin-left: 4px;
    }
    .profile-meta {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: #adadb8;
      margin-bottom: 8px;
    }
    .profile-languages {
      font-size: 11px;
      color: #adadb8;
      margin-bottom: 6px;
    }
    .profile-bio {
      font-size: 12px;
      color: #d4d4d8;
      font-style: italic;
      margin-bottom: 10px;
      line-height: 1.4;
    }
    .profile-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      font-size: 10px;
      color: #adadb8;
    }
    .profile-stat-val {
      font-size: 14px;
      font-weight: 700;
      color: #efeff1;
    }
    /* ── XP info/track/fill (new layout elements) ── */
    #xp-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
      font-size: 10px;
    }
    #xp-level {
      color: #efeff1;
      font-weight: 700;
      font-size: 11px;
    }
    #xp-combo {
      color: #fbbf24;
      font-weight: 800;
      font-size: 11px;
      opacity: 0;
      transition: opacity 0.3s;
    }
    #xp-combo.active {
      opacity: 1;
      animation: combo-pulse 0.5s ease;
    }
    #xp-track {
      height: 4px;
      background: #2f2f35;
      border-radius: 2px;
      overflow: hidden;
    }
    #xp-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #9146ff, #ff75e6);
      border-radius: 2px;
      transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    #xp-fill.level-up {
      background: linear-gradient(90deg, #ffd700, #ff8c00);
      animation: xp-flash 0.6s ease 3;
    }
    /* ── XP Floating Popups container ── */
    #xp-popups {
      position: absolute;
      right: 12px;
      bottom: 60px;
      pointer-events: none;
      z-index: 35;
    }
    /* ── Settings button ── */
    #settings-btn {
      background: none;
      border: none;
      color: #71717a;
      font-size: 16px;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 4px;
      line-height: 1;
      transition: color 0.15s, background 0.15s;
      flex-shrink: 0;
    }
    #settings-btn:hover {
      color: #efeff1;
      background: rgba(255,255,255,0.1);
    }
    /* ═══ Setup Screen ═══ */
    #setup-screen {
      display: none;
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 30;
      background: #0e0e10;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      gap: 16px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #setup-screen.active { display: flex; }
    #setup-screen h2 {
      color: #efeff1;
      font-size: 16px;
      font-weight: 800;
      margin: 0;
      text-align: center;
    }
    #setup-screen .setup-label {
      color: #adadb8;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: -8px;
      align-self: flex-start;
      width: 100%;
      max-width: 240px;
    }
    #setup-screen input[type="text"] {
      width: 100%;
      max-width: 240px;
      height: 36px;
      background: #3a3a3d;
      border: 1px solid #464649;
      border-radius: 6px;
      padding: 0 12px;
      color: #efeff1;
      font-size: 14px;
      outline: none;
      text-align: center;
      font-family: inherit;
    }
    #setup-screen input[type="text"]:focus {
      border-color: #9146ff;
    }
    .style-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
      max-width: 240px;
    }
    .style-option {
      background: #18181b;
      border: 2px solid #2f2f35;
      border-radius: 8px;
      padding: 10px 12px;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
    }
    .style-option:hover {
      border-color: #464649;
      background: #1f1f23;
    }
    .style-option.selected {
      border-color: #9146ff;
      background: rgba(145,70,255,0.1);
    }
    .style-option .style-name {
      color: #efeff1;
      font-size: 13px;
      font-weight: 700;
    }
    .style-option .style-desc {
      color: #adadb8;
      font-size: 11px;
      margin-top: 2px;
    }
    .lang-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      width: 100%;
      max-width: 240px;
    }
    .lang-btn {
      padding: 7px 4px;
      border: 2px solid #2f2f35;
      border-radius: 6px;
      background: #18181b;
      color: #efeff1;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      transition: border-color 0.2s;
      line-height: 1.3;
    }
    .lang-btn .lang-flag { font-size: 16px; display: block; margin-bottom: 2px; }
    .lang-btn:hover { border-color: #464649; }
    .lang-btn.selected { border-color: #9146ff; background: rgba(145,70,255,0.1); }
    #setup-go-btn {
      width: 100%;
      max-width: 240px;
      padding: 10px;
      background: #9146ff;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 4px;
      transition: background 0.15s;
    }
    #setup-go-btn:hover { background: #772ce8; }
  </style>
</head>
<body>
  <div id="stage">
    <div id="setup-screen">
      <h2>Stream Setup</h2>
      <span class="setup-label">YOUR NAME</span>
      <input id="setup-name" type="text" placeholder="streamer name" maxlength="20" autocomplete="off" />
      <span class="setup-label">LANGUAGE</span>
      <div class="lang-grid">
        <div class="lang-btn selected" data-lang="he"><span class="lang-flag">&#127470;&#127473;</span>עברית</div>
        <div class="lang-btn" data-lang="en"><span class="lang-flag">&#127482;&#127480;</span>English</div>
        <div class="lang-btn" data-lang="es"><span class="lang-flag">&#127466;&#127480;</span>Español</div>
        <div class="lang-btn" data-lang="pt"><span class="lang-flag">&#127463;&#127479;</span>Português</div>
        <div class="lang-btn" data-lang="fr"><span class="lang-flag">&#127467;&#127479;</span>Français</div>
        <div class="lang-btn" data-lang="de"><span class="lang-flag">&#127465;&#127466;</span>Deutsch</div>
        <div class="lang-btn" data-lang="ja"><span class="lang-flag">&#127471;&#127477;</span>日本語</div>
        <div class="lang-btn" data-lang="ru"><span class="lang-flag">&#127479;&#127482;</span>Русский</div>
        <div class="lang-btn" data-lang="ar"><span class="lang-flag">&#127480;&#127462;</span>العربية</div>
      </div>
      <span class="setup-label">CHAT STYLE</span>
      <div class="style-grid">
        <div class="style-option selected" data-style="hype">
          <div class="style-name">Hype</div>
          <div class="style-desc">Fast chat, lots of energy, everything is amazing</div>
        </div>
        <div class="style-option" data-style="chill">
          <div class="style-name">Chill</div>
          <div class="style-desc">Relaxed vibes, real conversations, supportive</div>
        </div>
        <div class="style-option" data-style="savage">
          <div class="style-name">Savage</div>
          <div class="style-desc">Roasts, trolls, backseat coding, brutal honesty</div>
        </div>
      </div>
      <button id="setup-go-btn">GO LIVE</button>
    </div>
    <div id="profile-overlay">
      <div id="profile-card">
        <button id="profile-close">&times;</button>
        <div class="profile-header">
          <div class="profile-avatar" id="profile-avatar"></div>
          <div>
            <div class="profile-name" id="profile-name-text"></div>
            <div class="profile-rank" id="profile-rank-text"></div>
          </div>
        </div>
        <div class="profile-meta">
          <span id="profile-age"></span>
          <span id="profile-location"></span>
        </div>
        <div class="profile-languages" id="profile-languages"></div>
        <div class="profile-bio" id="profile-bio"></div>
        <div class="profile-stats">
          <div><div class="profile-stat-val" id="profile-watch"></div>min watched</div>
          <div><div class="profile-stat-val" id="profile-sessions"></div>sessions</div>
          <div><div class="profile-stat-val" id="profile-messages"></div>messages</div>
          <div><div class="profile-stat-val" id="profile-since"></div>member since</div>
        </div>
      </div>
    </div>
    <div id="stream-chat-container">
      <div id="viewer-bar">
        <span id="stream-label"><span class="live-badge">LIVE</span> STREAM CHAT</span>
        <span style="display:flex;align-items:center;gap:8px">
          <span id="viewer-count"><span class="eye-icon">&#128065;</span><span id="viewer-num">0</span></span>
          <button id="settings-btn" title="Edit stream settings">&#9881;</button>
        </span>
      </div>
      <div id="hype-bar"><div id="hype-fill"></div></div>
      <div id="chat-messages"></div>
      <div id="chat-input-bar">
        <input id="chat-input" type="text" placeholder="Send a message" maxlength="120" autocomplete="off" />
        <button id="chat-send-btn">Chat</button>
      </div>
      <div id="xp-bar-container">
        <span id="xp-level-badge">Lv.1</span>
        <div id="xp-bar-track"><div id="xp-bar-fill"></div></div>
        <span id="combo-badge"></span>
        <span id="xp-label">0 XP</span>
      </div>
    </div>
    <div id="alert-overlay" data-level-up="${alertLevelUp}" data-milestone="${alertMilestone}" data-combo="${alertCombo}">
      <div id="alert-container">
        <img id="alert-image" src="" alt="" />
        <div id="alert-subtitle"></div>
      </div>
    </div>
    <div id="xp-popups"></div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
