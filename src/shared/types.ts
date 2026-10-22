export type SocketProtocol = 'TCP' | 'UDP';

export type SocketState = 'LISTENING' | 'ESTABLISHED' | 'CLOSE_WAIT' | 'TIME_WAIT' | 'UNKNOWN';

export interface PortInfo {
  port: number;
  pid: number;
  protocol: SocketProtocol;
  state: SocketState;
  processName?: string;
  commandLine?: string;
  cwd?: string;
  projectPath?: string;
  uptimeSeconds?: number;
}

export interface ProcessDetails {
  pid: number;
  name: string;
  commandLine?: string;
  cwd?: string;
  uptimeSeconds?: number;
  parentPid?: number;
}

export interface UnjamResult {
  success: boolean;
  port: number;
  pid: number;
  processName?: string;
  message: string;
  graceful: boolean;
}

export type EnvIssueType = 'missing_in_env' | 'missing_in_code' | 'drift_from_template' | 'empty_value';

export interface EnvVariableIssue {
  key: string;
  type: EnvIssueType;
  sourceFiles: string[];
  suggestedValue?: string;
  lineInTemplate?: number;
}

export interface EnvAuditReport {
  envFileExists: boolean;
  envPath?: string;
  /** Env files that were read as sources of defined keys (relative names, e.g. ".env.local"). */
  envFilesFound: string[];
  /** Where "Auto-Fill" appends missing keys. */
  healTargetPath: string;
  totalKeysDefined: number;
  missingInEnv: EnvVariableIssue[];
  templateDrift: EnvVariableIssue[];
  /** Keys the code uses that are defined but blank (e.g. placeholders added by a previous heal). */
  emptyInEnv: EnvVariableIssue[];
  unusedInCode: EnvVariableIssue[];
  /** Secret env files in a git repo that .gitignore does not cover. */
  notGitignored: string[];
  /** Secret env files git already tracks: .gitignore alone won't stop them being committed. */
  trackedByGit: string[];
}

export type LicenseTier = 'free' | 'pro_lifetime';

export interface LicenseStatus {
  tier: LicenseTier;
  isPro: boolean;
  licenseKey?: string;
  activatedAt?: string;
  machineId?: string;
}
