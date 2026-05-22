import { Parser } from "expr-eval";

const allowedVariables = [
  "売買AD売上合計",
  "売買仲介売上",
  "賃貸AD売上合計",
  "賃貸仲介売上",
  "売買歩合率",
  "賃貸歩合率",
  "その他収入合計",
  "その他収入歩合",
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

const variableTokenEntries = allowedVariables
  .map((variable, index) => [variable, `v${index}`] as const)
  .sort(([left], [right]) => right.length - left.length);
const variableTokenMap = new Map<string, string>(variableTokenEntries);

function normalizeFormulaExpression(expression: string) {
  return expression
    .replaceAll("売買AD売上合計", "__SALE_AD__")
    .replaceAll("売買仲介売上", "__SALE_BROKERAGE__")
    .replaceAll("賃貸AD売上合計", "__RENTAL_AD__")
    .replaceAll("賃貸仲介売上", "__RENTAL_BROKERAGE__")
    .replaceAll("AD売上合計 * 売買歩合率 + 仲介売上合計 * 賃貸歩合率", "(__SALE_AD__ + __SALE_BROKERAGE__) * 売買歩合率 + (__RENTAL_AD__ + __RENTAL_BROKERAGE__) * 賃貸歩合率")
    .replaceAll("売買売上合計", "(売買AD売上合計 + 売買仲介売上)")
    .replaceAll("賃貸売上合計", "(賃貸AD売上合計 + 賃貸仲介売上)")
    .replaceAll("AD売上合計", "(売買AD売上合計 + 賃貸AD売上合計)")
    .replaceAll("仲介売上合計", "(売買仲介売上 + 賃貸仲介売上)")
    .replaceAll("__SALE_AD__", "売買AD売上合計")
    .replaceAll("__SALE_BROKERAGE__", "売買仲介売上")
    .replaceAll("__RENTAL_AD__", "賃貸AD売上合計")
    .replaceAll("__RENTAL_BROKERAGE__", "賃貸仲介売上");
}

function tokenizeFormulaExpression(expression: string) {
  return variableTokenEntries.reduce((current, [variable, token]) => current.replaceAll(variable, token), expression);
}

function tokenizeFormulaContext(context: Partial<FormulaContext>) {
  return Object.fromEntries(
    Object.entries(context).map(([variable, value]) => [variableTokenMap.get(variable) ?? variable, value])
  );
}

export function evaluateFormula(expression: string, context: Partial<FormulaContext>) {
  const normalizedExpression = tokenizeFormulaExpression(normalizeFormulaExpression(expression));
  if (!normalizedExpression.trim()) return 0;
  const parsed = parser.parse(normalizedExpression);
  const variables = parsed.variables();
  const supportedTokens = new Set(variableTokenMap.values());
  const unsupported = variables.filter((variable) => !supportedTokens.has(variable));

  if (unsupported.length) {
    throw new Error(`使用できない変数: ${unsupported.join(", ")}`);
  }

  return Math.round(parsed.evaluate(tokenizeFormulaContext(context)));
}

export function defaultFormulaContext(): FormulaContext {
  return Object.fromEntries(allowedVariables.map((key) => [key, 0])) as FormulaContext;
}
