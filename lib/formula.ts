import { Parser } from "expr-eval";

const allowedVariables = [
  "仲介売上合計",
  "AD売上合計",
  "仲介歩合率",
  "AD歩合率",
  "前月残り金額",
  "社会保険",
  "年金料",
  "雇用保険料",
  "所得税",
  "定期券",
  "成約交通費",
  "IT",
  "物件管理費用",
  "経費領収書",
  "その他控除",
  "その他支給",
  "合計",
  "控除合計",
  "実際振込金額"
] as const;

export type FormulaVariable = (typeof allowedVariables)[number];
export type FormulaContext = Record<FormulaVariable, number>;

const parser = new Parser({
  operators: {
    add: true,
    subtract: true,
    multiply: true,
    divide: true,
    power: false,
    factorial: false,
    concatenate: false,
    conditional: false,
    logical: false,
    comparison: false,
    in: false,
    assignment: false
  }
});

export function evaluateFormula(expression: string, context: Partial<FormulaContext>) {
  if (!expression.trim()) return 0;
  const parsed = parser.parse(expression);
  const variables = parsed.variables();
  const unsupported = variables.filter((variable) => !allowedVariables.includes(variable as FormulaVariable));

  if (unsupported.length) {
    throw new Error(`使用できない変数: ${unsupported.join(", ")}`);
  }

  return Math.round(parsed.evaluate(context));
}

export function defaultFormulaContext(): FormulaContext {
  return Object.fromEntries(allowedVariables.map((key) => [key, 0])) as FormulaContext;
}
