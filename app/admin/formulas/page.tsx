import { saveFormula } from "@/app/actions";
import { FormulaTester } from "@/components/formula-tester";
import { getFormulas } from "@/lib/data";
import { defaultFormula } from "@/lib/payroll";

export default async function FormulasPage() {
  const formulas = await getFormulas();
  const active = formulas[0] ?? { id: "", name: "標準給与計算", is_default: true, ...defaultFormula };
  const expressions: string[] = [
    active.formula_total ?? defaultFormula.formula_total,
    active.formula_deduction ?? defaultFormula.formula_deduction,
    active.formula_transfer ?? defaultFormula.formula_transfer,
    active.formula_remaining ?? defaultFormula.formula_remaining
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">給与計算式</h1>
      <form action={saveFormula} className="grid gap-4 rounded-lg border border-line bg-white p-4 lg:grid-cols-[1fr_320px]">
        <input type="hidden" name="id" value={active.id} />
        <div className="space-y-3">
          <label className="field">名称<input name="name" defaultValue={active.name} /></label>
          <label className="field">合計<textarea name="formula_total" rows={2} defaultValue={expressions[0]} /></label>
          <label className="field">控除合計<textarea name="formula_deduction" rows={2} defaultValue={expressions[1]} /></label>
          <label className="field">振込金額<textarea name="formula_transfer" rows={2} defaultValue={expressions[2]} /></label>
          <label className="field">残り金額<textarea name="formula_remaining" rows={2} defaultValue={expressions[3]} /></label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input name="is_default" type="checkbox" defaultChecked={active.is_default} className="h-4 w-4" />標準にする</label>
          <button className="btn btn-primary" type="submit">保存</button>
        </div>
        <FormulaTester expressions={expressions} />
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>名称</th><th>標準</th><th>合計</th></tr></thead>
          <tbody>{formulas.map((formula) => <tr key={formula.id}><td>{formula.name}</td><td>{formula.is_default ? "はい" : ""}</td><td>{formula.formula_total}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
