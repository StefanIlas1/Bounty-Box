import type { CandidateStack } from '../contracts';
import { createHardwareCatalog, type HardwareRequirements, type HardwareQuote, type HardwareRecommendation } from './hardware';
import { createHardwarePackage, type HardwarePackage, type BoardPinMapping } from './packages';

export interface HardwareSoftwarePlan {
  task: 'led-bringup';
  hardware: HardwareRecommendation;
  software: CandidateStack | null;
  setupPackage: HardwarePackage;
  costs: { upfront: number | null; upfrontCurrency: string; monthlyUsd: number; monthlyBudgetUsd: number };
  blockers: string[];
  status: 'needs-quote-or-compatibility' | 'ready-for-validation';
  /** Advice only. This API neither orders equipment nor provisions services. */
  purchaseExecuted: false;
}

/** Combines a compatible device and optional software stack without conflating capex and subscription costs. */
export async function createHardwarePlans(input: {
  requirements: HardwareRequirements;
  quotes?: HardwareQuote[];
  monthlyBudgetUsd: number;
  software?: CandidateStack;
  task: 'led-bringup';
  blinkPeriodMs?: number;
  pins?: BoardPinMapping;
}): Promise<HardwareSoftwarePlan[]> {
  if (input.task !== 'led-bringup') throw new Error('Only the LED bring-up reference task is implemented. Supply target-specific generation for other projects.');
  if (!Number.isFinite(input.monthlyBudgetUsd) || input.monthlyBudgetUsd < 0) throw new Error('Invalid recurring budget.');
  const monthly = input.software?.estimatedMonthlyCostUsd ?? 0;
  if (!Number.isFinite(monthly) || monthly < 0) throw new Error('Unknown software price cannot be treated as zero.');
  const candidates = createHardwareCatalog().recommend(input.requirements, input.quotes);
  return Promise.all(candidates.map(async hardware => {
    const setupPackage = await createHardwarePackage(hardware.target.id, { blinkPeriodMs: input.blinkPeriodMs, pins: input.pins });
    const blockers = [...hardware.blockers, ...setupPackage.blockers];
    if (monthly > input.monthlyBudgetUsd) blockers.push('Software cost exceeds recurring monthly budget.');
    if (input.software?.mode === 'fixture') blockers.push('Fixture software stack cannot qualify a live proposal.');
    return { task: 'led-bringup' as const, hardware, software: input.software ? structuredClone(input.software) : null, setupPackage,
      costs: { upfront: hardware.landedCost, upfrontCurrency: hardware.currency, monthlyUsd: monthly, monthlyBudgetUsd: input.monthlyBudgetUsd },
      blockers, status: blockers.length ? 'needs-quote-or-compatibility' as const : 'ready-for-validation' as const,
      purchaseExecuted: false as const };
  }));
}
