import { recalculateSalary } from "@/app/actions";
import { ExportButtons } from "@/components/export-buttons";
import { SalaryBadge } from "@/components/status-badge";
import { getProfiles, getSalaries } from "@/lib/data";
import { currentMonth, isValidYearMonth, yen } from "@/lib/format";

const deductionFields = [
  ["social_insurance", "社会保険（1分）"],
  ["pension", "年金料"],
  ["employment_insurance", "雇用保険料"],
  ["income_tax", "所得税"],
  ["commuter_pass", "定期券"],
  ["contract_transportation", "成約交通費"],
  ["it_cost", "IT"],
  ["property_management_cost", "物件管理費用"],
  ["previous_remaining_amount", "先月残り金額"],
  ["expense_receipts", "経費領収書"],
  ["other_deduction", "その他控除"],
  ["other_payment", "その他支給"],
  ["actual_transfer_amount", "実際振込金額"]
] as const;

export default async function SalariesPage({ searchParams }: { searchParams: Promise<{ month?: string; staff?: string }> }) {
  const params = await searchParams;
  const targetMonth = isValidYearMonth(params.month ?? "") ? (params.month as string) : currentMonth();
  const [profiles, salaries] = await Promise.all([getProfiles(), getSalaries({ targetMonth })]);
  const selectedStaff = params.staff ?? profiles[0]?.id;
  const salary = salaries.find((row) => row.staff_id === selectedStaff);

  const exportRows = salaries.map((row) => ({
    社員: row.profiles?.name ?? row.staff_id,
    対象月: row.target_month,
    売買売上合計: row.brokerage_sales_total,
    賃貸売上合計: row.ad_sales_total,
    その他収入歩合: row.other_income_commission,
    合計: row.total_amount,
    振り込み金額: row.transfer_amount,
    残り金額: row.remaining_amount,
    状態: row.status
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">給与計算</h1>
        <ExportButtons rows={exportRows} filename={`給与_${targetMonth}`} />
      </div>
      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-4">
        <label className="field">対象月<input type="month" name="month" defaultValue={targetMonth} /></label>
        <label className="field">社員<select name="staff" defaultValue={selectedStaff}>{profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <button className="btn" type="submit">表示</button>
      </form>
      {selectedStaff ? (
        <form action={recalculateSalary} className="grid gap-4 rounded-lg border border-line bg-white p-4 lg:grid-cols-[360px_1fr]">
          <input type="hidden" name="staff_id" value={selectedStaff} />
          <input type="hidden" name="target_month" value={targetMonth} />
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {deductionFields.map(([name, label]) => (
              <label key={name} className="field">{label}<input name={name} type="number" defaultValue={(salary?.[name] as number | undefined) ?? 0} /></label>
            ))}
            <label className="field">状態<select name="status" defaultValue={salary?.status ?? "下書き"}><option>下書き</option><option>確定</option><option>支払済み</option></select></label>
            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit">再計算・保存</button>
              <button className="btn" type="submit" name="status" value="確定">確定</button>
            </div>
          </section>
          <section className="table-wrap">
            <table className="data-table">
              <tbody>
                <tr><th>売買売上合計</th><td>{yen.format(salary?.brokerage_sales_total ?? 0)}</td></tr>
                <tr><th>賃貸売上合計</th><td>{yen.format(salary?.ad_sales_total ?? 0)}</td></tr>
                <tr><th>売買歩合</th><td>{yen.format(salary?.brokerage_commission ?? 0)}</td></tr>
                <tr><th>賃貸歩合</th><td>{yen.format(salary?.ad_commission ?? 0)}</td></tr>
                <tr><th>その他収入歩合</th><td>{yen.format(salary?.other_income_commission ?? 0)}</td></tr>
                <tr><th>合計</th><td>{yen.format(salary?.total_amount ?? 0)}</td></tr>
                <tr><th>振り込み金額</th><td className="font-bold">{yen.format(salary?.transfer_amount ?? 0)}</td></tr>
                <tr><th>残り金額</th><td>{yen.format(salary?.remaining_amount ?? 0)}</td></tr>
                <tr><th>状態</th><td>{salary ? <SalaryBadge status={salary.status} /> : "未作成"}</td></tr>
              </tbody>
            </table>
          </section>
        </form>
      ) : null}
    </div>
  );
}
