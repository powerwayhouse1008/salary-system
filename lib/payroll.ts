import { evaluateFormula, defaultFormulaContext } from "@/lib/formula";
import type { Contract, Profile, SalaryFormula, SalaryMonthly } from "@/lib/types";

export const defaultFormula: Record<"formula_total" | "formula_deduction" | "formula_transfer" | "formula_remaining", string> = {
  formula_total: "仲介売上合計 * 仲介歩合率 + AD売上合計 * AD歩合率 + 前月残り金額",
  formula_deduction: "社会保険 + 年金料 + 雇用保険料 + 所得税 + 定期券 + 成約交通費 + IT + 物件管理費用 + 経費領収書 + その他控除",
  formula_transfer: "合計 - 控除合計 + その他支給",
  formula_remaining: "合計 - 控除合計 + その他支給 - 実際振込金額"
};

type DraftSalary = Partial<SalaryMonthly> & {
  staff_id: string;
  target_month: string;
};

export function calculateSalary(
  staff: Profile,
  contracts: Contract[],
  draft: DraftSalary,
  formula: Pick<SalaryFormula, "formula_total" | "formula_deduction" | "formula_transfer" | "formula_remaining"> = defaultFormula
) {
  const brokerageSalesTotal = sum(contracts.map((contract) => contract.brokerage_sales));
  const adSalesTotal = sum(contracts.map((contract) => contract.ad_sales));
  const brokerageRate = Number(staff.brokerage_commission_rate ?? 0) / 100;
  const adRate = Number(staff.ad_commission_rate ?? 0) / 100;
  const brokerageCommission = Math.round(brokerageSalesTotal * brokerageRate);
  const adCommission = Math.round(adSalesTotal * adRate);

  const context = {
    ...defaultFormulaContext(),
    仲介売上合計: brokerageSalesTotal,
    AD売上合計: adSalesTotal,
    仲介歩合率: brokerageRate,
    AD歩合率: adRate,
    前月残り金額: Number(draft.previous_remaining_amount ?? 0),
    社会保険: Number(draft.social_insurance ?? 0),
    年金料: Number(draft.pension ?? 0),
    雇用保険料: Number(draft.employment_insurance ?? 0),
    所得税: Number(draft.income_tax ?? 0),
    定期券: Number(draft.commuter_pass ?? 0),
    成約交通費: Number(draft.contract_transportation ?? 0),
    IT: Number(draft.it_cost ?? 0),
    物件管理費用: Number(draft.property_management_cost ?? 0),
    経費領収書: Number(draft.expense_receipts ?? 0),
    その他控除: Number(draft.other_deduction ?? 0),
    その他支給: Number(draft.other_payment ?? 0),
    実際振込金額: Number(draft.actual_transfer_amount ?? draft.transfer_amount ?? 0)
  };

  const totalAmount = evaluateFormula(formula.formula_total ?? defaultFormula.formula_total, context);
  const deductionTotal = evaluateFormula(formula.formula_deduction ?? defaultFormula.formula_deduction, {
    ...context,
    合計: totalAmount
  });
  const transferAmount = evaluateFormula(formula.formula_transfer ?? defaultFormula.formula_transfer, {
    ...context,
    合計: totalAmount,
    控除合計: deductionTotal
  });
  const actualTransferAmount = Number(draft.actual_transfer_amount ?? transferAmount);
  const remainingAmount = evaluateFormula(formula.formula_remaining ?? defaultFormula.formula_remaining, {
    ...context,
    合計: totalAmount,
    控除合計: deductionTotal,
    実際振込金額: actualTransferAmount
  });

  return {
    brokerage_sales_total: brokerageSalesTotal,
    ad_sales_total: adSalesTotal,
    brokerage_commission: brokerageCommission,
    ad_commission: adCommission,
    total_amount: totalAmount,
    transfer_amount: transferAmount,
    actual_transfer_amount: actualTransferAmount,
    remaining_amount: remainingAmount
  };
}

function sum(values: number[]) {
  return Math.round(values.reduce((total, value) => total + Number(value ?? 0), 0));
}
