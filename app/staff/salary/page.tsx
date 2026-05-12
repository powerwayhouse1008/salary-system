import { auth } from "@/auth";
import { SalaryBadge } from "@/components/status-badge";
import { getSalaries } from "@/lib/data";
import { yen } from "@/lib/format";

export default async function StaffSalaryPage() {
  const session = await auth();
  const salaries = await getSalaries({ staffId: session?.user.id });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">給与確認</h1>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>対象月</th><th>仲介売上</th><th>AD売上</th><th>合計</th><th>振り込み金額</th><th>残り金額</th><th>状態</th></tr></thead>
          <tbody>
            {salaries.map((salary) => (
              <tr key={salary.id}>
                <td>{salary.target_month}</td>
                <td>{yen.format(salary.brokerage_sales_total)}</td>
                <td>{yen.format(salary.ad_sales_total)}</td>
                <td>{yen.format(salary.total_amount)}</td>
                <td className="font-bold">{yen.format(salary.transfer_amount)}</td>
                <td>{yen.format(salary.remaining_amount)}</td>
                <td><SalaryBadge status={salary.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
