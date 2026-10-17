import { randomUUID } from "node:crypto";
import type { CandidateStack, Catalog, GeneratedApp, Generator, RunSnapshot, RunStatus, SandboxRunner, TestResult } from "../contracts";

export interface OrchestrationInput {
  run: RunSnapshot;
  catalog: Catalog;
  generator: Generator;
  sandbox: SandboxRunner;
  signal?: AbortSignal;
  maxAttempts?: number;
  /** Awaited immutable snapshots; rejection stops work rather than losing evidence. */
  onUpdate: (run: RunSnapshot) => void | Promise<void>;
}
export interface OrchestrationResult { run: RunSnapshot; app?: GeneratedApp }

/** Sequential per run. The caller owns persistence, global serialization and approval. */
export async function orchestrateRun(input: OrchestrationInput): Promise<OrchestrationResult> {
  const { catalog, generator, sandbox, signal, onUpdate } = input;
  const run = structuredClone(input.run);
  if (run.status !== "queued" || run.attempts.length) throw new Error("Orchestration requires a fresh queued run; retries must create a new run.");
  const cap = input.maxAttempts ?? 3;
  if (!Number.isInteger(cap) || cap < 1 || cap > 10) throw new Error("maxAttempts must be an integer from 1 to 10.");
  delete run.proposal;
  delete run.error;
  delete run.deployedUrl;
  let persistenceFailed = false;
  const check = () => { if (signal?.aborted) throw new Error("Run cancelled"); };
  const publish = async (status: RunStatus, message: string) => {
    run.status = status;
    run.updatedAt = new Date().toISOString();
    run.events.push({ id: (run.events.at(-1)?.id ?? 0) + 1, at: run.updatedAt, stage: status, message });
    try { await onUpdate(structuredClone(run)); } catch (error) { persistenceFailed = true; throw error; }
  };
  const reasons = (result: TestResult): string[] => {
    const failures: string[] = [];
    if (result.mode !== run.mode) failures.push("Evidence mode does not match run mode");
    if (!result.passed) failures.push(result.failureReason || "Sandbox reported a failed test");
    if (!Number.isInteger(result.requests) || result.requests <= 0) failures.push("No valid request count");
    if (!Number.isFinite(result.throughputRps) || result.throughputRps <= 0) failures.push("No valid measured throughput");
    if (!Number.isFinite(result.p95Ms) || result.p95Ms < 0 || result.p95Ms > run.brief.load.maxP95Ms) failures.push(`p95 must be at most ${run.brief.load.maxP95Ms} ms`);
    if (!Number.isFinite(result.errorRate) || result.errorRate < 0 || result.errorRate > 1 || result.errorRate > run.brief.load.maxErrorRate) failures.push(`Error rate must be at most ${run.brief.load.maxErrorRate}`);
    if (!Number.isFinite(result.durationSeconds) || result.durationSeconds < run.brief.load.durationSeconds) failures.push(`Test must run for at least ${run.brief.load.durationSeconds} seconds`);
    return failures;
  };
  let stage = "planning";
  try {
    check();
    const { monthlyBudgetUsd, load, targetUsers } = run.brief;
    if (!run.brief.description.trim() || !Number.isFinite(monthlyBudgetUsd) || monthlyBudgetUsd < 0 || !Number.isInteger(targetUsers) || targetUsers < 1 || !Number.isInteger(load.concurrency) || load.concurrency < 1 || !Number.isFinite(load.durationSeconds) || load.durationSeconds <= 0 || !Number.isFinite(load.maxP95Ms) || load.maxP95Ms <= 0 || !Number.isFinite(load.maxErrorRate) || load.maxErrorRate < 0 || load.maxErrorRate > 1) throw new Error("Invalid brief");
    await publish("planning", `Comparing candidate stacks against the $${monthlyBudgetUsd}/month estimated budget. ${run.mode === "fixture" ? "Fixture run: evidence is simulated." : "Live evidence required."}`);
    check();
    run.candidates = await catalog.listCandidates(run.brief);
    check();
    const eligible = run.candidates.filter((s) => s.mode === run.mode && Number.isFinite(s.estimatedMonthlyCostUsd) && s.estimatedMonthlyCostUsd >= 0 && s.estimatedMonthlyCostUsd <= monthlyBudgetUsd);
    const ordinary = eligible.filter((s) => !s.partner).sort((a, b) => a.estimatedMonthlyCostUsd - b.estimatedMonthlyCostUsd);
    const partners = eligible.filter((s) => s.partner).sort((a, b) => a.estimatedMonthlyCostUsd - b.estimatedMonthlyCostUsd);
    await publish("planning", `${eligible.length} candidates match the run mode and estimated budget; ${run.candidates.length - eligible.length} excluded. Partner offers require a passing non-partner comparison.`);
    let best: { stack: CandidateStack; result: TestResult; app: GeneratedApp } | undefined;
    let count = 0;
    for (const stack of [...ordinary, ...partners]) {
      check();
      if (count >= cap) break;
      if (stack.partner && (!best || stack.estimatedMonthlyCostUsd >= best.stack.estimatedMonthlyCostUsd)) continue;
      // Sorted non-partner candidates: a passing cheaper stack needs no costlier comparison.
      if (!stack.partner && best) continue;
      let previous: GeneratedApp | undefined;
      let feedback: TestResult | undefined;
      for (let repair = 0; repair < 2 && count < cap; repair++) {
        check();
        count++;
        stage = "generation";
        await publish(repair ? "repairing" : "generating", `${repair ? "Repairing" : "Generating"} ${stack.name}${stack.partner ? " (partner offer)" : ""}; attempt ${count}/${cap}.`);
        check();
        const app = await generator.generate({ brief: run.brief, stack, previous, feedback, signal });
        check();
        if (!Number.isInteger(app.revision) || app.revision < 1 || (previous && app.revision <= previous.revision)) throw new Error("Generator must return an increasing revision");
        const attempt = { number: count, stack, revision: app.revision } as RunSnapshot["attempts"][number];
        run.attempts.push(attempt);
        stage = "sandbox testing";
        await publish("testing", `Testing ${stack.name}, generated revision ${app.revision}.`);
        check();
        const result = await sandbox.run({ app, stack, brief: run.brief, signal });
        attempt.result = structuredClone(result);
        check();
        const failures = reasons(result);
        if (!failures.length) {
          attempt.decision = stack.partner ? "Passed the same criteria and costs less than the qualifying non-partner alternative; partner offer selected." : "Passed measured performance criteria within estimated monthly budget.";
          best = { stack, result, app };
          await publish("testing", attempt.decision);
          break;
        }
        const action = count >= cap ? "Attempt limit reached" : repair === 0 ? "Repair code and retest" : "Try the next eligible stack";
        attempt.decision = `${failures.join("; ")}. ${action}.`;
        await publish("repairing", attempt.decision);
        // Never feed mismatched evidence into a live repair or accept it as a comparison.
        if (result.mode !== run.mode) throw new Error("Evidence mode mismatch");
        previous = app;
        feedback = { ...result, passed: false, failureReason: failures.join("; ") };
      }
    }
    check();
    if (!best) {
      run.error = `No stack qualified after ${count}/${cap} attempts. Review test decisions, budget, load targets and available non-partner candidates.`;
      await publish("failed", run.error);
      return { run: structuredClone(run) };
    }
    run.proposal = { id: randomUUID(), stack: best.stack, result: best.result, estimatedMonthlyCostUsd: best.stack.estimatedMonthlyCostUsd };
    await publish("awaiting_approval", `${best.stack.name}${best.stack.partner ? " (partner offer)" : ""} passed within the estimated budget. Approval of proposal ${run.proposal.id} is required before provisioning.`);
    check();
    return { run: structuredClone(run), app: structuredClone(best.app) };
  } catch (error) {
    if (persistenceFailed) throw error;
    delete run.proposal;
    run.error = signal?.aborted ? undefined : `Orchestration stopped during ${stage}. Check provider/generator configuration and recorded test evidence before retrying.`;
    await publish(signal?.aborted ? "cancelled" : "failed", signal?.aborted ? "Run cancelled; no proposal approved or provisioned." : run.error!);
    return { run: structuredClone(run) };
  }
}
