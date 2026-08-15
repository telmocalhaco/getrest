import type { RestVariable } from "./rest";

export interface ResponseExtractor {
  variableName: string;
  jsonPath: string;
  required: boolean;
}

export interface CollectionRunnerStep {
  requestId: string;
  name: string;
  method: string;
  url: string;
  body: string;
  extractors: ResponseExtractor[];
}

export interface RunCollectionInput {
  steps: CollectionRunnerStep[];
  variables: RestVariable[];
  virtualUsers: number;
  iterations: number;
  thinkTimeMs: number;
}

export interface RunnerStepResult {
  requestId: string;
  name: string;
  executions: number;
  passed: number;
  failed: number;
  averageDurationMs: number;
  p95DurationMs: number;
}

export interface RunnerErrorSample {
  virtualUser: number;
  iteration: number;
  stepName: string;
  message: string;
}

export interface CollectionRunResult {
  totalRequests: number;
  passedRequests: number;
  failedRequests: number;
  durationMs: number;
  requestsPerSecond: number;
  averageDurationMs: number;
  p95DurationMs: number;
  steps: RunnerStepResult[];
  errors: RunnerErrorSample[];
}
