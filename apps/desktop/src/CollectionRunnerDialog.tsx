import { useMemo, useState } from "react";
import type { EnvironmentVariable } from "./domain/environment";
import type {
  CollectionRunResult,
  CollectionRunnerStep,
  ResponseExtractor,
} from "./domain/runner";
import type { HttpMethod } from "./domain/rest";
import { runCollection } from "./services/collectionRunner";

export interface RunnerRequestSource {
  id: string;
  name: string;
  method: HttpMethod;
  path: string;
  collection: string;
  body: string;
}

interface Props {
  collections: string[];
  initialCollection: string;
  requests: RunnerRequestSource[];
  variables: EnvironmentVariable[];
  onClose: () => void;
}

function stepsForCollection(
  requests: RunnerRequestSource[],
  collection: string,
): CollectionRunnerStep[] {
  return requests
    .filter((request) => request.collection === collection)
    .map((request) => ({
      requestId: request.id,
      name: request.name,
      method: request.method,
      url: request.path,
      body: request.body,
      extractors: [],
    }));
}

export function CollectionRunnerDialog({
  collections,
  initialCollection,
  requests,
  variables,
  onClose,
}: Props) {
  const [collection, setCollection] = useState(initialCollection);
  const [steps, setSteps] = useState(() =>
    stepsForCollection(requests, initialCollection),
  );
  const [mode, setMode] = useState<"functional" | "load">("functional");
  const [virtualUsers, setVirtualUsers] = useState(1);
  const [iterations, setIterations] = useState(1);
  const [thinkTimeMs, setThinkTimeMs] = useState(0);
  const [authorized, setAuthorized] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CollectionRunResult | null>(null);
  const plannedRequests = steps.length * virtualUsers * iterations;
  const isLoadRun = mode === "load";
  const canRun =
    steps.length > 0 && plannedRequests <= 10_000 && (!isLoadRun || authorized);

  const availableVariables = useMemo(() => {
    const extracted = steps
      .flatMap((step) =>
        step.extractors.map((extractor) => extractor.variableName),
      )
      .filter(Boolean);
    return [
      ...new Set([...variables.map((variable) => variable.name), ...extracted]),
    ];
  }, [steps, variables]);

  const chooseCollection = (name: string) => {
    setCollection(name);
    setSteps(stepsForCollection(requests, name));
    setResult(null);
    setError(null);
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    setSteps((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addExtractor = (stepIndex: number) =>
    setSteps((current) =>
      current.map((step, index) =>
        index === stepIndex
          ? {
              ...step,
              extractors: [
                ...step.extractors,
                { variableName: "", jsonPath: "", required: true },
              ],
            }
          : step,
      ),
    );

  const updateExtractor = (
    stepIndex: number,
    extractorIndex: number,
    patch: Partial<ResponseExtractor>,
  ) =>
    setSteps((current) =>
      current.map((step, index) =>
        index === stepIndex
          ? {
              ...step,
              extractors: step.extractors.map((extractor, itemIndex) =>
                itemIndex === extractorIndex
                  ? { ...extractor, ...patch }
                  : extractor,
              ),
            }
          : step,
      ),
    );

  const removeExtractor = (stepIndex: number, extractorIndex: number) =>
    setSteps((current) =>
      current.map((step, index) =>
        index === stepIndex
          ? {
              ...step,
              extractors: step.extractors.filter(
                (_, itemIndex) => itemIndex !== extractorIndex,
              ),
            }
          : step,
      ),
    );

  const execute = async () => {
    if (!canRun || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const runResult = await runCollection({
        steps,
        variables,
        virtualUsers,
        iterations,
        thinkTimeMs,
      });
      setResult(runResult);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The collection run failed.",
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby="runner-dialog-title"
        aria-modal="true"
        className="workspace-dialog runner-dialog"
        role="dialog"
      >
        <header className="workspace-dialog-header">
          <div>
            <span className="eyebrow">Collection automation</span>
            <h2 id="runner-dialog-title">Test flow &amp; traffic</h2>
          </div>
          <button
            aria-label="Close collection runner"
            className="icon-button workspace-close-button"
            disabled={running}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        <div className="workspace-dialog-content runner-content">
          <div className="runner-toolbar">
            <label className="workspace-field">
              <span>Collection</span>
              <select
                aria-label="Runner collection"
                onChange={(event) => chooseCollection(event.target.value)}
                value={collection}
              >
                {collections.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <div className="runner-mode" role="group" aria-label="Run mode">
              <button
                aria-pressed={mode === "functional"}
                onClick={() => {
                  setMode("functional");
                  setVirtualUsers(1);
                  setIterations(1);
                }}
                type="button"
              >
                Functional
              </button>
              <button
                aria-pressed={mode === "load"}
                onClick={() => {
                  setMode("load");
                  setVirtualUsers(Math.max(virtualUsers, 2));
                }}
                type="button"
              >
                Load / stress
              </button>
            </div>
          </div>

          <div className="runner-flow-heading">
            <div>
              <strong>Flow order</strong>
              <small>
                Each virtual user follows these steps from top to bottom.
              </small>
            </div>
            <span>{steps.length} steps</span>
          </div>
          <div className="runner-steps">
            {steps.map((step, stepIndex) => (
              <article className="runner-step" key={step.requestId}>
                <div className="runner-step-main">
                  <span className="runner-step-number">{stepIndex + 1}</span>
                  <span
                    className={`method method-${step.method.toLowerCase()}`}
                  >
                    {step.method}
                  </span>
                  <div>
                    <strong>{step.name}</strong>
                    <small>{step.url}</small>
                  </div>
                  <div className="runner-order-actions">
                    <button
                      aria-label={`Move ${step.name} up`}
                      disabled={stepIndex === 0}
                      onClick={() => moveStep(stepIndex, -1)}
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Move ${step.name} down`}
                      disabled={stepIndex === steps.length - 1}
                      onClick={() => moveStep(stepIndex, 1)}
                      type="button"
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <div className="runner-extractors">
                  {step.extractors.map((extractor, extractorIndex) => (
                    <div className="runner-extractor" key={extractorIndex}>
                      <input
                        aria-label={`${step.name} extracted variable ${extractorIndex + 1}`}
                        onChange={(event) =>
                          updateExtractor(stepIndex, extractorIndex, {
                            variableName: event.target.value,
                          })
                        }
                        placeholder="variableName"
                        value={extractor.variableName}
                      />
                      <span>from</span>
                      <input
                        aria-label={`${step.name} JSON path ${extractorIndex + 1}`}
                        onChange={(event) =>
                          updateExtractor(stepIndex, extractorIndex, {
                            jsonPath: event.target.value,
                          })
                        }
                        placeholder="data.id or items.0.id"
                        value={extractor.jsonPath}
                      />
                      <label>
                        <input
                          checked={extractor.required}
                          onChange={(event) =>
                            updateExtractor(stepIndex, extractorIndex, {
                              required: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />{" "}
                        required
                      </label>
                      <button
                        aria-label={`Remove extractor ${extractorIndex + 1}`}
                        onClick={() =>
                          removeExtractor(stepIndex, extractorIndex)
                        }
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    className="plain-button runner-add-extractor"
                    onClick={() => addExtractor(stepIndex)}
                    type="button"
                  >
                    + Extract response value
                  </button>
                </div>
              </article>
            ))}
            {steps.length === 0 && (
              <p className="runner-empty">This collection has no requests.</p>
            )}
          </div>

          <div className="runner-settings">
            <label className="workspace-field">
              <span>Virtual users</span>
              <input
                aria-label="Virtual users"
                disabled={!isLoadRun}
                max={50}
                min={1}
                onChange={(event) =>
                  setVirtualUsers(Number(event.target.value))
                }
                type="number"
                value={virtualUsers}
              />
            </label>
            <label className="workspace-field">
              <span>Iterations per user</span>
              <input
                aria-label="Iterations per user"
                disabled={!isLoadRun}
                max={1000}
                min={1}
                onChange={(event) => setIterations(Number(event.target.value))}
                type="number"
                value={iterations}
              />
            </label>
            <label className="workspace-field">
              <span>Think time (ms)</span>
              <input
                aria-label="Think time"
                disabled={!isLoadRun}
                max={60000}
                min={0}
                onChange={(event) => setThinkTimeMs(Number(event.target.value))}
                type="number"
                value={thinkTimeMs}
              />
            </label>
          </div>
          <div
            className={`runner-budget ${plannedRequests > 10_000 ? "invalid" : ""}`}
          >
            <strong>{plannedRequests.toLocaleString()} planned requests</strong>
            <span>Hard limit: 10,000 per run · 50 virtual users</span>
          </div>
          {availableVariables.length > 0 && (
            <div className="runner-variable-note">
              Available variables:{" "}
              {availableVariables.map((name) => (
                <code key={name}>{`{{${name}}}`}</code>
              ))}
            </div>
          )}
          {isLoadRun && (
            <label className="runner-authorization">
              <input
                checked={authorized}
                onChange={(event) => setAuthorized(event.target.checked)}
                type="checkbox"
              />
              <span>
                I confirm that I own or have permission to load-test the target
                API.
              </span>
            </label>
          )}
          {error && <div className="workspace-error">{error}</div>}
          {result && <RunnerResults result={result} />}
        </div>
        <footer className="workspace-dialog-actions">
          <button
            className="plain-button"
            disabled={running}
            onClick={onClose}
            type="button"
          >
            Close
          </button>
          <button
            className="send-button workspace-create-button"
            disabled={!canRun || running}
            onClick={execute}
            type="button"
          >
            {running ? "Running…" : isLoadRun ? "Start load test" : "Run flow"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function RunnerResults({ result }: { result: CollectionRunResult }) {
  return (
    <section className="runner-results" aria-label="Collection run results">
      <div className="runner-metrics">
        <div>
          <strong>
            {result.passedRequests}/{result.totalRequests}
          </strong>
          <span>passed</span>
        </div>
        <div>
          <strong>{result.requestsPerSecond.toFixed(1)}</strong>
          <span>req/s</span>
        </div>
        <div>
          <strong>{result.averageDurationMs} ms</strong>
          <span>average</span>
        </div>
        <div>
          <strong>{result.p95DurationMs} ms</strong>
          <span>p95</span>
        </div>
      </div>
      <div className="runner-result-steps">
        {result.steps.map((step) => (
          <div key={step.requestId}>
            <span className={step.failed ? "runner-failed" : "runner-passed"}>
              {step.failed ? "Failed" : "Passed"}
            </span>
            <strong>{step.name}</strong>
            <small>
              {step.executions} runs · avg {step.averageDurationMs} ms · p95{" "}
              {step.p95DurationMs} ms
            </small>
          </div>
        ))}
      </div>
      {result.errors.length > 0 && (
        <details className="runner-errors">
          <summary>{result.errors.length} error samples</summary>
          {result.errors.map((error, index) => (
            <p key={index}>
              VU {error.virtualUser}, iteration {error.iteration},{" "}
              {error.stepName}: {error.message}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
