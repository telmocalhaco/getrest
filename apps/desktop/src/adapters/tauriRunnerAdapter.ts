import { invoke } from "@tauri-apps/api/core";
import type { CollectionRunResult, RunCollectionInput } from "../domain/runner";

interface RunnerCommandError {
  message?: string;
}

export async function invokeCollectionRun(
  input: RunCollectionInput,
): Promise<CollectionRunResult> {
  try {
    return await invoke<CollectionRunResult>("run_collection", { input });
  } catch (error) {
    if (isRunnerCommandError(error) && error.message) {
      throw new Error(error.message);
    }
    throw new Error("The native collection runner could not complete the run.");
  }
}

function isRunnerCommandError(value: unknown): value is RunnerCommandError {
  return typeof value === "object" && value !== null;
}
