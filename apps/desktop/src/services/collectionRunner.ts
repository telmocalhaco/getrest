import { invokeCollectionRun } from "../adapters/tauriRunnerAdapter";
import type { CollectionRunResult, RunCollectionInput } from "../domain/runner";

export async function runCollection(
  input: RunCollectionInput,
): Promise<CollectionRunResult> {
  if (input.steps.length === 0)
    throw new Error("Add at least one request to the flow.");
  if (
    !Number.isInteger(input.virtualUsers) ||
    input.virtualUsers < 1 ||
    input.virtualUsers > 50
  )
    throw new Error("Virtual users must be between 1 and 50.");
  if (
    !Number.isInteger(input.iterations) ||
    input.iterations < 1 ||
    input.iterations > 1000
  )
    throw new Error("Iterations must be between 1 and 1000.");
  if (input.steps.length * input.virtualUsers * input.iterations > 10_000)
    throw new Error("This run exceeds the 10,000 request safety limit.");
  if (
    !Number.isInteger(input.thinkTimeMs) ||
    input.thinkTimeMs < 0 ||
    input.thinkTimeMs > 60_000
  )
    throw new Error("Think time must be between 0 and 60,000 milliseconds.");
  return invokeCollectionRun(input);
}
