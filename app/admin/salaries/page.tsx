import { recalculateSalary } from "@/app/actions";
import { auth } from "@/auth";
import { ExportButtons } from "@/components/export-buttons";
import { OtherIncomeFields } from "@/components/other-income-fields";
import { SavedToast } from "@/components/saved-toast";
import { SalaryBadge } from "@/components/status-badge";
import { getManageableProfiles, getSalaries } from "@/lib/data";
import { currentMonth, isValidYearMonth, yen } from "@/lib/format";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export default async function SalariesPage({ searchParams }: { searchParams: Promise<{ error?: string; month?: string; staff?: string; saved?: string }> }) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user) return null;
  const targetMonth = isValidYearMonth(params.month ?? "") ? (params.month as string) : currentMonth();
  const profiles = await getManageableProfiles(session.user);
  const allowedStaffIds = new Set(profiles.map((profile) => profile.id));
  const selectedParamStaff = params.staff && allowedStaffIds.has(params.staff) ? params.staff : null;
  const salaries = await getSalaries({ targetMonth });
  const visibleSalaries = session.user.role === "admin" ? salaries : salaries.filter((salary) => allowedStaffIds.has(salary.staff_id));
  const selectedStaff = selectedParamStaff ?? profiles[0]?.id;
  const selectedProfile = profiles.find((profile) => profile.id === selectedStaff);
  const currentSalary = visibleSalaries.find((row) => row.staff_id === selectedStaff);
  const staffSalaries = selectedStaff ? await getSalaries({ staffId: selectedStaff }) : [];
  const latestSalary = staffSalaries.find((row) => row.target_month !== targetMonth);
  const salary = currentSalary ?? latestSalary;
  const isUsingPreviousInput = Boolean(!currentSalary && latestSalary);

  const exportRows = visibleSalaries.map((row) => ({
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
  const salaryDetailRows = salary
    ? [
        { label: "社員", value: selectedProfile?.name ?? salary.staff_id },
        { label: "対象月", value: targetMonth },
        ...(isUsingPreviousInput ? [{ label: "入力データ元", value: `${latestSalary?.target_month} の前回入力` }] : []),
        { label: "社会保険（1分）", value: yen.format(salary.social_insurance) },
        { label: "年金料", value: yen.format(salary.pension) },
        { label: "雇用保険料", value: yen.format(salary.employment_insurance) },
        { label: "所得税", value: yen.format(salary.income_tax) },
        { label: "定期券", value: yen.format(salary.commuter_pass) },
        { label: "成約交通費", value: yen.format(salary.contract_transportation) },
        { label: "IT", value: yen.format(salary.it_cost) },
        { label: "物件管理費用", value: yen.format(salary.property_management_cost) },
        { label: "先月残り金額", value: yen.format(salary.previous_remaining_amount) },
        { label: "経費領収書", value: yen.format(salary.expense_receipts) },
        { label: "その他控除", value: yen.format(salary.other_deduction) },
        { label: "その他支給", value: yen.format(salary.other_payment) },
        { label: "実際振込金額", value: yen.format(salary.actual_transfer_amount) },
        { label: "売買売上合計", value: yen.format(salary.brokerage_sales_total) },
        { label: "賃貸売上合計", value: yen.format(salary.ad_sales_total) },
        { label: "売買歩合", value: yen.format(salary.brokerage_commission) },
        { label: "賃貸歩合", value: yen.format(salary.ad_commission) },
        { label: "その他収入合計", value: yen.format(salary.other_income_total) },
        { label: "その他収入歩合", value: yen.format(salary.other_income_commission) },
        { label: "合計", value: yen.format(salary.total_amount) },
        { label: "振り込み金額", value: yen.format(salary.transfer_amount) },
        { label: "残り金額", value: yen.format(salary.remaining_amount) },
        { label: "状態", value: currentSalary?.status ?? "未作成" }
      ]
    : undefined;

  return (
    <div className="space-y-6">
      <SavedToast show={params.saved === "1"} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">給与計算</h1>
        <ExportButtons rows={exportRows} filename={`給与_${targetMonth}`} detailTitle={`給与_${targetMonth}_${selectedProfile?.name ?? ""}`} detailRows={salaryDetailRows} />
      </div>
      {params.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {params.error}
        </div>
      ) : null}
      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-4">
        <label className="field">対象月<input type="month" name="month" defaultValue={targetMonth} /></label>
        <label className="field">社員<select name="staff" defaultValue={selectedStaff}>{profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <button className="btn" type="submit">表示</button>
        {selectedStaff ? <button className="btn btn-primary" type="submit" form="salary-edit-form">保存</button> : null}
      </form>
      {selectedStaff ? (
        <form id="salary-edit-form" action={recalculateSalary} className="grid gap-4 rounded-lg border border-line bg-white p-4 lg:grid-cols-[360px_1fr]">
          <input type="hidden" name="staff_id" value={selectedStaff} />
          <input type="hidden" name="target_month" value={targetMonth} />
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {deductionFields.map(([name, label]) => (
              <label key={name} className="field">{label}<input name={name} type="number" defaultValue={(salary?.[name] as number | undefined) ?? 0} /></label>
            ))}
            <OtherIncomeFields className="sm:col-span-2 lg:col-span-1" initialItems={salary?.other_income_items} />
            <label className="field">状態<select name="status" defaultValue={salary?.status ?? "下書き"}><option>下書き</option><option>確定</option><option>支払済み</option></select></label>
            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit">再計算・保存</button>
              <button className="btn" type="submit" name="status" value="確定">確定</button>
            </div>
          </section>
          <section className="overflow-x-auto rounded-md border border-blue-300 bg-white p-3">
            {isUsingPreviousInput ? (
              <div className="mb-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                {latestSalary?.target_month} の前回入力を表示中です。保存すると {targetMonth} の給与として登録されます。
              </div>
            ) : null}
            <div className="min-w-[760px] text-[13px] text-slate-900">
              <div className="mb-3 grid grid-cols-[1fr_220px] gap-4">
                <div className="rounded-md border-2 border-blue-300 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold">{Number(targetMonth.slice(5, 7))}月分給与</div>
                      <div className="mt-4 grid grid-cols-[56px_1fr] gap-x-3 gap-y-1 text-sm">
                        <span className="font-semibold text-blue-900">氏名</span>
                        <span>{selectedProfile?.name ?? selectedStaff} 様</span>
                        <span className="font-semibold text-blue-900">所属</span>
                        <span>{selectedProfile?.email ?? "-"}</span>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-blue-700">明細書</div>
                  </div>
                </div>
                <div className="grid content-start gap-3">
                  <div className="grid grid-cols-[70px_1fr] items-end gap-2 border-b-2 border-blue-300 pb-1">
                    <span className="font-semibold text-blue-700">支給日</span>
                    <span className="text-right">{targetMonth.slice(0, 4)} 年 {Number(targetMonth.slice(5, 7))} 月 25 日</span>
                  </div>
                  <div className="ml-auto h-16 w-16 rounded-md border-2 border-blue-300" />
                  <div className="text-right text-xs font-semibold text-blue-800">受領印</div>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_1.25fr_1.25fr_1.2fr] gap-2">
                <PayslipColumn
                  title="勤怠"
                  rows={[
                    ["出勤日数", "0.00"],
                    ["実働時間", "0.00"],
                    ["残業時間", "0.00"],
                    ["遅刻早退回数", "0"],
                    ["有給回数", "0"],
                    ["遅刻早退時間", "0.00"]
                  ]}
                  totalLabel="税額表"
                  totalValue="-"
                />
                <PayslipColumn
                  title="支給"
                  rows={[
                    ["売買売上合計", yen.format(salary?.brokerage_sales_total ?? 0)],
                    ["賃貸売上合計", yen.format(salary?.ad_sales_total ?? 0)],
                    ["売買歩合", yen.format(salary?.brokerage_commission ?? 0)],
                    ["賃貸歩合", yen.format(salary?.ad_commission ?? 0)],
                    ["その他収入歩合", yen.format(salary?.other_income_commission ?? 0)],
                    ["その他支給", yen.format(salary?.other_payment ?? 0)],
                    ["先月残り金額", yen.format(salary?.previous_remaining_amount ?? 0)]
                  ]}
                  totalLabel="合計"
                  totalValue={yen.format(salary?.total_amount ?? 0)}
                />
                <PayslipColumn
                  title="控除"
                  rows={[
                    ["社会保険", yen.format(salary?.social_insurance ?? 0)],
                    ["年金料", yen.format(salary?.pension ?? 0)],
                    ["雇用保険料", yen.format(salary?.employment_insurance ?? 0)],
                    ["所得税", yen.format(salary?.income_tax ?? 0)],
                    ["定期券", yen.format(salary?.commuter_pass ?? 0)],
                    ["成約交通費", yen.format(salary?.contract_transportation ?? 0)],
                    ["IT", yen.format(salary?.it_cost ?? 0)],
                    ["物件管理費用", yen.format(salary?.property_management_cost ?? 0)],
                    ["経費領収書", yen.format(salary?.expense_receipts ?? 0)],
                    ["その他控除", yen.format(salary?.other_deduction ?? 0)]
                  ]}
                  totalLabel="合計"
                  totalValue={yen.format(
                    (salary?.social_insurance ?? 0) +
                      (salary?.pension ?? 0) +
                      (salary?.employment_insurance ?? 0) +
                      (salary?.income_tax ?? 0) +
                      (salary?.commuter_pass ?? 0) +
                      (salary?.contract_transportation ?? 0) +
                      (salary?.it_cost ?? 0) +
                      (salary?.property_management_cost ?? 0) +
                      (salary?.expense_receipts ?? 0) +
                      (salary?.other_deduction ?? 0)
                  )}
                />
                <PayslipColumn
                  title="その他"
                  rows={[
                    ["その他収入合計", yen.format(salary?.other_income_total ?? 0)],
                    ["差引支給額", yen.format(salary?.transfer_amount ?? 0)],
                    ["振込支給額", yen.format(salary?.actual_transfer_amount ?? salary?.transfer_amount ?? 0)],
                    ["残り金額", yen.format(salary?.remaining_amount ?? 0)]
                  ]}
                  totalLabel="状態"
                  totalValue={currentSalary?.status ?? "未作成"}
                  totalValueNode={salary ? <SalaryBadge status={salary.status} /> : undefined}
                />
              </div>

              <div className="mt-2 rounded-md border-2 border-blue-300 px-3 py-3 text-sm">
                今月もお疲れさまでした。
              </div>
            </div>
          </section>
        </form>
      ) : null}
    </div>
  );
}

function PayslipColumn({
  title,
  rows,
  totalLabel,
  totalValue,
  totalValueNode
}: {
  title: string;
  rows: [string, string][];
  totalLabel: string;
  totalValue: string;
  totalValueNode?: ReactNode;
}) {
  return (
    <div className="grid min-h-[360px] grid-rows-[auto_1fr_auto] overflow-hidden rounded-md border-2 border-blue-400">
      <div className="border-b-2 border-blue-400 bg-blue-50 py-1 text-center font-bold tracking-[0.2em] text-blue-800">{title}</div>
      <div className="grid grid-cols-[1fr_96px]">
        <div className="bg-blue-50/70 p-2">
          {rows.map(([label]) => (
            <div key={label} className="leading-6">{label}</div>
          ))}
        </div>
        <div className="border-l border-blue-300 bg-white p-2 text-right">
          {rows.map(([label, value]) => (
            <div key={label} className="whitespace-nowrap leading-6">{value}</div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_96px] border-t-2 border-blue-400 font-bold">
        <div className="bg-blue-50 px-2 py-1 text-blue-800">{totalLabel}</div>
        <div className="border-l border-blue-300 px-2 py-1 text-right">{totalValueNode ?? totalValue}</div>
      </div>
    </div>
  );
}
