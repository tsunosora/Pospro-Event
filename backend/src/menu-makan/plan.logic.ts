export interface VarianceInput {
  estimatedCost: number | string | null | undefined;
  realCost: number | string | null | undefined;
  budget?: number | string | null;
}

export interface VarianceResult {
  estimatedCost: number;
  realCost: number;
  selisih: number; // real - estimasi (positif = lebih mahal dari perkiraan)
  over: boolean; // real > estimasi
  sisaBudget: number | null; // budget - real (null jika budget tak diset)
  overBudget: boolean; // real > budget
}

export function hitungVariance(input: VarianceInput): VarianceResult {
  const estimatedCost = Number(input.estimatedCost) || 0;
  const realCost = Number(input.realCost) || 0;
  const hasBudget = input.budget !== null && input.budget !== undefined && Number(input.budget) > 0;
  const budget = hasBudget ? Number(input.budget) : null;
  return {
    estimatedCost,
    realCost,
    selisih: realCost - estimatedCost,
    over: realCost > estimatedCost,
    sisaBudget: budget === null ? null : budget - realCost,
    overBudget: budget === null ? false : realCost > budget,
  };
}
