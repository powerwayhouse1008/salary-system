import { saveEmployee } from "@/app/actions";
import { auth } from "@/auth";
import { getManageableProfiles, getProfilesWithManagedStaff } from "@/lib/data";
import type { Profile } from "@/lib/types";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const params = await searchParams;
  const session = await auth();
  const isAdmin = session?.user.role === "admin";
  let employees: Profile[] = [];
  let loadError: string | null = null;

  try {
    employees = isAdmin ? await getProfilesWithManagedStaff() : session?.user ? await getManageableProfiles(session.user) : [];
  } catch (error) {
    console.error("EmployeesPage load failed", error);
    loadError = "社員情報を読み込めませんでした。Supabaseのschema.sqlが適用済みか確認してください。";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">社員管理</h1>
        {params.saved ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-[10px] leading-none text-white">✓</span>
            保存済み
          </span>
        ) : null}
      </div>

      {params.error ? <ErrorMessage message={params.error} /> : null}
      {loadError ? <ErrorMessage message={loadError} /> : null}

      {isAdmin ? <EmployeeCreateForm /> : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>氏名</th>
              <th>Email</th>
              <th>新パスワード</th>
              <th>権限</th>
              <th>売買歩合</th>
              <th>賃貸歩合</th>
              <th>状態</th>
              <th>管理対象社員</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <EmployeeRow key={employee.id} employee={employee} employees={employees} isAdmin={isAdmin} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div>;
}

function EmployeeCreateForm() {
  return (
    <form action={saveEmployee} className="grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-4">
      <label className="field">
        氏名
        <input name="name" required />
      </label>
      <label className="field">
        Email
        <input name="email" type="email" required />
      </label>
      <label className="field">
        初期パスワード
        <input name="password" type="password" placeholder="未入力なら自動生成" />
      </label>
      <label className="field">
        権限
        <select name="role" defaultValue="staff">
          <option value="staff">staff</option>
          <option value="manager">manager</option>
          <option value="admin">admin</option>
        </select>
      </label>
      <label className="field">
        売買歩合率 %
        <input name="brokerage_commission_rate" type="number" step="0.01" defaultValue="30" />
      </label>
      <label className="field">
        賃貸歩合率 %
        <input name="ad_commission_rate" type="number" step="0.01" defaultValue="50" />
      </label>
      <label className="flex items-center gap-2 pt-6 text-sm font-semibold">
        <input name="is_active" type="checkbox" defaultChecked className="h-4 w-4" />
        有効
      </label>
      <div className="pt-6">
        <button className="btn btn-primary" type="submit">
          社員を追加
        </button>
      </div>
    </form>
  );
}

function EmployeeRow({ employee, employees, isAdmin }: { employee: Profile; employees: Profile[]; isAdmin: boolean }) {
  const formId = `employee-${employee.id}`;
  const manageableEmployees = employees.filter((staff) => staff.id !== employee.id && staff.role !== "admin");

  return (
    <tr>
      <td>{isAdmin ? <input form={formId} name="name" defaultValue={employee.name} className="w-40" /> : employee.name}</td>
      <td>{isAdmin ? <input form={formId} name="email" defaultValue={employee.email} className="w-56" /> : employee.email}</td>
      <td>{isAdmin ? <input form={formId} name="password" type="password" placeholder="変更時のみ入力" className="w-40" /> : null}</td>
      <td>
        {isAdmin ? (
          <select form={formId} name="role" defaultValue={employee.role}>
            <option value="staff">staff</option>
            <option value="manager">manager</option>
            <option value="admin">admin</option>
          </select>
        ) : (
          employee.role
        )}
      </td>
      <td>
        {isAdmin ? (
          <input form={formId} name="brokerage_commission_rate" type="number" step="0.01" defaultValue={employee.brokerage_commission_rate} className="w-24" />
        ) : (
          employee.brokerage_commission_rate
        )}
      </td>
      <td>{isAdmin ? <input form={formId} name="ad_commission_rate" type="number" step="0.01" defaultValue={employee.ad_commission_rate} className="w-24" /> : employee.ad_commission_rate}</td>
      <td>{isAdmin ? <input form={formId} name="is_active" type="checkbox" defaultChecked={employee.is_active} className="h-4 w-4" /> : employee.is_active ? "有効" : "無効"}</td>
      <td>{isAdmin && employee.role === "manager" ? <ManagedStaffPicker formId={formId} employee={employee} employees={manageableEmployees} /> : null}</td>
      <td>
        {isAdmin ? (
          <form id={formId} action={saveEmployee}>
            <input type="hidden" name="id" value={employee.id} />
            <button className="btn" type="submit">
              保存
            </button>
          </form>
        ) : null}
      </td>
    </tr>
  );
}

function ManagedStaffPicker({ formId, employee, employees }: { formId: string; employee: Profile; employees: Profile[] }) {
  return (
    <div className="grid max-h-32 min-w-48 gap-1 overflow-auto rounded-md border border-line bg-slate-50 p-2 text-left">
      {employees.map((staff) => (
        <label key={staff.id} className="flex items-center gap-2 text-xs font-medium text-slate-700">
          <input form={formId} name="managed_staff_id" type="checkbox" value={staff.id} defaultChecked={employee.managed_staff_ids?.includes(staff.id)} className="h-3.5 w-3.5" />
          {staff.name}
        </label>
      ))}
    </div>
  );
}
