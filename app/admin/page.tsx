import { StatCard } from "@/components/card";
import { SalaryBadge } from "@/components/status-badge";
import { currentMonth, yen } from "@/lib/format";
import { getDashboardStats } from "@/lib/data";

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const params = await searchParams;
  const month = params.month ?? currentMonth();
  const stats = await getDashboardStats(month);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <form className="flex items-center gap-2">
          <input type="month" name="month" defaultValue={month} />
          <button className="btn" type="submit">表示</button>
        </form>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="売買売上" value={yen.format(stats.brokerageSales)} />
        <StatCard label="賃貸売上" value={yen.format(stats.adSales)} />
        <StatCard label="入金済み" value={yen.format(stats.received)} tone="ok" />
        <StatCard label="未入金" value={yen.format(stats.pending)} tone="warn" />
        <StatCard label="給与支払予定" value={yen.format(stats.payroll)} />
        <StatCard label="控除・経費" value={yen.format(stats.costs)} />
      </div>
      <section>
        <h2 className="mb-3 text-lg font-bold">社員別給与ステータス</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>社員</th><th>Email</th><th>対象月</th><th>振込金額</th><th>状態</th></tr>
            </thead>
            <tbody>
              {stats.profiles.map((profile) => {
                const salary = stats.salaries.find((row) => row.staff_id === profile.id);
                return (
                  <tr key={profile.id}>
                    <td className="font-semibold">{profile.name}</td>
                    <td>{profile.email}</td>
                    <td>{salary?.target_month ?? month}</td>
                    <td>{yen.format(salary?.transfer_amount ?? 0)}</td>
                    <td>{salary ? <SalaryBadge status={salary.status} /> : <span className="text-slate-500">未作成</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
