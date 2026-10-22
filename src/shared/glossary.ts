export interface ErrorTranslation {
  headline: string;
  icon: string;
  plainEnglish: string;
  solutionText: string;
  actionButtonText: string;
}

export const ERROR_GLOSSARY: Record<string, ErrorTranslation> = {
  EADDRINUSE: {
    headline: 'Port Traffic Jam',
    icon: '🚦',
    plainEnglish: 'Another background program or forgotten server is already using this port.',
    solutionText: 'EnvWizard can safely evict the background process and free the door.',
    actionButtonText: 'Free Port',
  },
  GHOST_PROCESS: {
    headline: 'Ghost Server Running',
    icon: '👻',
    plainEnglish: 'A background process started earlier is still silently running and consuming memory.',
    solutionText: 'EnvWizard can send a polite shutdown signal to release it.',
    actionButtonText: 'Put to Rest',
  },
  ENV_VAR_MISSING: {
    headline: 'Missing Secret Key',
    icon: '🧩',
    plainEnglish: 'Your application code is looking for an environment variable that is not in your .env file.',
    solutionText: 'EnvWizard can add a starter placeholder for this variable to your .env file.',
    actionButtonText: 'Add to .env',
  },
  TEMPLATE_DRIFT: {
    headline: 'Recipe Mismatch',
    icon: '📋',
    plainEnglish: 'Your .env.example has new settings that your personal .env file has not adopted yet.',
    solutionText: 'EnvWizard can synchronize missing keys from the template without overwriting your existing values.',
    actionButtonText: 'Sync Recipe',
  },
  STUCK_CONTAINER: {
    headline: 'Stuck Container Box',
    icon: '📦',
    plainEnglish: 'A local container (like PostgreSQL or Redis) is locked or holding a network port.',
    solutionText: 'EnvWizard can inspect the container or release the port safely.',
    actionButtonText: 'Soft Restart',
  },
};

export function translateError(errorCode: string): ErrorTranslation {
  return ERROR_GLOSSARY[errorCode] || {
    headline: 'Dev Environment Notice',
    icon: '🔌',
    plainEnglish: `An unexpected environment event occurred: ${errorCode}`,
    solutionText: 'EnvWizard can inspect your running dev services.',
    actionButtonText: 'Inspect',
  };
}
