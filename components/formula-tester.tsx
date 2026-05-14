"use client";

import { useMemo, useState } from "react";
import { evaluateFormula, defaultFormulaContext } from "@/lib/formula";

export function FormulaTester({ expressions }: { expressions: string[] }) {
  const [sample, setSample] = useState("売買売上合計=200000\n賃貸売上合計=100000\n売買歩合率=0.3\n賃貸歩合率=0.5\n前月残り金額=0");
  const result = useMemo(() => {
    try {
      const context = { ...defaultFormulaContext() };
      for (const line of sample.split("\n")) {
        const [key, value] = line.split("=");
        if (key && value) context[key.trim() as keyof typeof context] = Number(value);
      }
      const values: string[] = [];
      let total = 0;
      let deduction = 0;
      expressions.forEach((expression, index) => {
        const value = evaluateFormula(expression, { ...context, 合計: total, 控除合計: deduction });
        if (index === 0) total = value;
        if (index === 1) deduction = value;
        values.push(value.toLocaleString("ja-JP"));
      });
      return values.join(" / ");
    } catch (error) {
      return error instanceof Error ? error.message : "計算できません。";
    }
  }, [expressions, sample]);

  return (
    <div className="rounded-lg border border-line bg-slate-50 p-3">
      <label className="field">
        テストデータ
        <textarea value={sample} onChange={(event) => setSample(event.target.value)} rows={5} />
      </label>
      <div className="mt-3 text-sm font-bold">テスト計算: {result}</div>
    </div>
  );
}
