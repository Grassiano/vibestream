import * as vscode from 'vscode';
import { EventBus } from './event-bus';

interface GitExtension {
  getAPI(version: number): GitAPI;
}

interface GitAPI {
  repositories: GitRepository[];
  onDidOpenRepository: vscode.Event<GitRepository>;
}

interface GitRepository {
  onDidCommit: vscode.Event<void>;
  state: {
    HEAD?: { ahead?: number };
    onDidChange: vscode.Event<void>;
  };
}

export function registerGitEvents(
  bus: EventBus,
  context: vscode.ExtensionContext
): void {
  const gitExtension =
    vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!gitExtension) return;

  const activate = async () => {
    const git = gitExtension.exports.getAPI(1);

    const watchRepo = (repo: GitRepository) => {
      let previousAhead = repo.state.HEAD?.ahead ?? 0;

      context.subscriptions.push(
        repo.onDidCommit(() => {
          bus.emit('git-commit', {});
        })
      );

      context.subscriptions.push(
        repo.state.onDidChange(() => {
          const currentAhead = repo.state.HEAD?.ahead ?? 0;
          if (currentAhead < previousAhead) {
            bus.emit('git-push', {});
          }
          previousAhead = currentAhead;
        })
      );
    };

    for (const repo of git.repositories) {
      watchRepo(repo);
    }

    context.subscriptions.push(
      git.onDidOpenRepository((repo) => watchRepo(repo))
    );
  };

  if (gitExtension.isActive) {
    activate();
  } else {
    gitExtension.activate().then(activate);
  }
}
