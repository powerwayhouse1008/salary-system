import { getSupabaseAdmin } from "@/lib/supabase";
import type { Contract, Profile, SalaryFormula, SalaryMonthly } from "@/lib/types";

export async function getProfiles() {
  const { data, error } = await getSupabaseAdmin().from("profiles").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function getContracts(options: { staffId?: string; limit?: number } = {}) {
 let query = getSupabaseAdmin().from("contracts").select("*").order("contract_date", { ascending: false }).order("created_at", { ascending: false });
  if (options.staffId) query = query.eq("staff_id", options.staffId);
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throw error;
   const rows = (data ?? []) as Contract[];
  return await withProfiles(rows, (row) => row.staff_id);
}

export async function getFormulas() {
  const { data, error } = await getSupabaseAdmin().from("salary_formulas").select("*").order("is_default", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SalaryFormula[];
}

export async function getSalaries(options: { staffId?: string; targetMonth?: string } = {}) {
  let query = getSupabaseAdmin().from("salary_monthly").select("*").order("target_month", { ascending: false });
  if (options.staffId) query = query.eq("staff_id", options.staffId);
  if (options.targetMonth) query = query.eq("target_month", options.targetMonth);
  const { data, error } = await query;
  if (error) throw error;
   const rows = (data ?? []) as SalaryMonthly[];
  return await withProfiles(rows, (row) => row.staff_id);
}

export async function getDashboardStats(targetMonth: string) {
  const start = `${targetMonth}-01`;
  const end = nextMonth(targetMonth);
  const [{ data: contracts }, { data: salaries }, { data: profiles }] = await Promise.all([
    getSupabaseAdmin().from("contracts").select("*").gte("contract_date", start).lt("contract_date", end),
    getSupabaseAdmin().from("salary_monthly").select("*").eq("target_month", targetMonth),
    getSupabaseAdmin().from("profiles").select("*").order("name")
  ]);

  const allContracts = (contracts ?? []) as Contract[];
  const paid = allContracts.filter((contract) => contract.payment_status === "入金済み");
  const unpaid = allContracts.filter((contract) => contract.payment_status !== "入金済み" && contract.payment_status !== "キャンセル");
  const salaryRows = (salaries ?? []) as SalaryMonthly[];

  return {
    profiles: (profiles ?? []) as Profile[],
    contracts: allContracts,
    salaries: salaryRows,
    brokerageSales: sum(paid.map((row) => row.brokerage_sales)),
    adSales: sum(paid.map((row) => row.ad_sales)),
    received: sum(paid.map((row) => row.actual_received_amount)),
    pending: sum(unpaid.map((row) => row.expected_payment_amount)),
    payroll: sum(salaryRows.map((row) => row.transfer_amount)),
    costs: sum(
      salaryRows.map(
        (row) =>
          row.social_insurance +
          row.pension +
          row.employment_insurance +
          row.income_tax +
          row.commuter_pass +
          row.contract_transportation +
          row.it_cost +
          row.property_management_cost +
          row.expense_receipts +
          row.other_deduction
      )
    )
  };
}
async function withProfiles<T extends { profiles?: Pick<Profile, "name" | "email"> | null }>(rows: T[], getStaffId: (row: T) => string) {
  const ids = Array.from(new Set(rows.map(getStaffId).filter(Boolean)));
  if (ids.length === 0) return rows;
  const { data: profiles, error } = await getSupabaseAdmin().from("profiles").select("id,name,email").in("id", ids);
  if (error) throw error;
  const map = new Map((profiles ?? []).map((profile) => [profile.id as string, { name: profile.name as string, email: profile.email as string }]));
  return rows.map((row) => ({ ...row, profiles: map.get(getStaffId(row)) ?? null }));
}
function sum(values: number[]) {
  return Math.round(values.reduce((total, value) => total + Number(value ?? 0), 0));
}

function nextMonth(targetMonth: string) {
  const [year, month] = targetMonth.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return next.toISOString().slice(0, 10);
}
