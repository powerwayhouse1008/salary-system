"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { numberValue, textValue } from "@/lib/format";
import { calculateSalary, defaultFormula } from "@/lib/payroll";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { PaymentStatus } from "@/lib/types";

async function requireUser(role?: "admin") {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (role && session.user.role !== role) redirect("/staff/contracts");
  return session.user;
}

export async function saveEmployee(formData: FormData) {
  await requireUser("admin");
  const supabase = getSupabaseAdmin();
  const id = textValue(formData.get("id"));
  const payload = {
    name: textValue(formData.get("name")) ?? "",
    email: (textValue(formData.get("email")) ?? "").toLowerCase(),
    phone: textValue(formData.get("phone")),
    role: textValue(formData.get("role")) ?? "staff",
    brokerage_commission_rate: numberValue(formData.get("brokerage_commission_rate")),
    ad_commission_rate: numberValue(formData.get("ad_commission_rate")),
    is_active: formData.get("is_active") === "on",
    updated_at: new Date().toISOString()
  };
  const payloadWithPassword = payload;

  if (id) {
    await supabase.from("profiles").update(payloadWithPassword).eq("id", id);
  } else {
    const { data: authUser, error } = await supabase.auth.admin.createUser({
      email: payload.email,
      email_confirm: true,
      user_metadata: { name: payload.name }
    });
    if (error || !authUser.user) throw error ?? new Error("社員アカウントを作成できません。");
    await supabase.from("profiles").insert({ id: authUser.user.id, ...payloadWithPassword });
  }

  revalidatePath("/admin/employees");
}

export async function saveContract(formData: FormData) {
  const user = await requireUser();
  const supabase = getSupabaseAdmin();
  const isAdmin = user.role === "admin";
  const staffId = isAdmin ? textValue(formData.get("staff_id")) ?? user.id : user.id;
  const id = textValue(formData.get("id"));
  const payload = {
    staff_id: staffId,
    contract_date: textValue(formData.get("contract_date")),
    contract_number: textValue(formData.get("contract_number")),
    customer_name: textValue(formData.get("customer_name")),
    residence_status: textValue(formData.get("residence_status")),
    phone: textValue(formData.get("phone")),
    property_name: textValue(formData.get("property_name")),
    address: textValue(formData.get("address")),
    rent: numberValue(formData.get("rent")),
    bank_deposit: numberValue(formData.get("bank_deposit")),
    withdrawal: numberValue(formData.get("withdrawal")),
    transfer_fee: numberValue(formData.get("transfer_fee")),
    brokerage_sales: numberValue(formData.get("brokerage_sales")),
    ad_sales: numberValue(formData.get("ad_sales")),
    ad_payment: numberValue(formData.get("ad_payment")),
    refund_or_adjustment: numberValue(formData.get("refund_or_adjustment")),
    contract_type: textValue(formData.get("contract_type")),
    management_company: textValue(formData.get("management_company")),
    previous_ad_payment: numberValue(formData.get("previous_ad_payment")),
    salary_item: textValue(formData.get("salary_item")),
    salary_settlement: numberValue(formData.get("salary_settlement")),
    expected_payment_amount: numberValue(formData.get("expected_payment_amount")),
    actual_received_amount: numberValue(formData.get("actual_received_amount")),
    payment_status: isAdmin ? (textValue(formData.get("payment_status")) as PaymentStatus) ?? "未確認" : "未確認",
    updated_at: new Date().toISOString()
  };

  if (id && isAdmin) {
    await supabase.from("contracts").update(payload).eq("id", id);
  } else {
    await supabase.from("contracts").insert(payload);
  }

  revalidatePath(isAdmin ? "/admin/contracts" : "/staff/contracts");
}

export async function confirmPayment(formData: FormData) {
  const user = await requireUser("admin");
  const supabase = getSupabaseAdmin();
  const id = textValue(formData.get("id"));
  if (!id) throw new Error("契約IDがありません。");

  await supabase
    .from("contracts")
    .update({
      payment_status: "入金済み",
      actual_received_amount: numberValue(formData.get("actual_received_amount")),
      payment_note: textValue(formData.get("payment_note")),
      payment_confirmed_at: new Date().toISOString(),
      payment_confirmed_by: user.id,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  revalidatePath("/admin/contracts");
}

export async function updateContractStatus(formData: FormData) {
  await requireUser("admin");
  const supabase = getSupabaseAdmin();
  const id = textValue(formData.get("id"));
  const paymentStatus = textValue(formData.get("payment_status"));
  if (!id || !paymentStatus) throw new Error("契約IDまたは状態がありません。");

  await supabase
    .from("contracts")
    .update({
      payment_status: paymentStatus,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  revalidatePath("/admin/contracts");
}

export async function saveFormula(formData: FormData) {
  await requireUser("admin");
  const supabase = getSupabaseAdmin();
  const id = textValue(formData.get("id"));
  const payload = {
    name: textValue(formData.get("name")) ?? "計算式",
    formula_total: textValue(formData.get("formula_total")) ?? defaultFormula.formula_total,
    formula_deduction: textValue(formData.get("formula_deduction")) ?? defaultFormula.formula_deduction,
    formula_transfer: textValue(formData.get("formula_transfer")) ?? defaultFormula.formula_transfer,
    formula_remaining: textValue(formData.get("formula_remaining")) ?? defaultFormula.formula_remaining,
    is_default: formData.get("is_default") === "on",
    updated_at: new Date().toISOString()
  };

  if (payload.is_default) await supabase.from("salary_formulas").update({ is_default: false }).neq("id", id ?? "");
  if (id) await supabase.from("salary_formulas").update(payload).eq("id", id);
  else await supabase.from("salary_formulas").insert(payload);

  revalidatePath("/admin/formulas");
}

export async function recalculateSalary(formData: FormData) {
  const user = await requireUser("admin");
  const supabase = getSupabaseAdmin();
  const staffId = textValue(formData.get("staff_id"));
  const targetMonth = textValue(formData.get("target_month"));
  if (!staffId || !targetMonth) throw new Error("社員と対象月を選択してください。");

  const [{ data: staff }, { data: formula }, { data: contracts }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", staffId).single(),
    supabase.from("salary_formulas").select("*").eq("is_default", true).maybeSingle(),
    supabase
      .from("contracts")
      .select("*")
      .eq("staff_id", staffId)
      .eq("payment_status", "入金済み")
      .gte("payment_confirmed_at", `${targetMonth}-01`)
      .lt("payment_confirmed_at", nextMonth(targetMonth))
  ]);

  if (!staff) throw new Error("社員が見つかりません。");

  const draft = {
    staff_id: staffId,
    target_month: targetMonth,
    social_insurance: numberValue(formData.get("social_insurance")),
    pension: numberValue(formData.get("pension")),
    employment_insurance: numberValue(formData.get("employment_insurance")),
    income_tax: numberValue(formData.get("income_tax")),
    commuter_pass: numberValue(formData.get("commuter_pass")),
    contract_transportation: numberValue(formData.get("contract_transportation")),
    it_cost: numberValue(formData.get("it_cost")),
    property_management_cost: numberValue(formData.get("property_management_cost")),
    previous_remaining_amount: numberValue(formData.get("previous_remaining_amount")),
    expense_receipts: numberValue(formData.get("expense_receipts")),
    other_deduction: numberValue(formData.get("other_deduction")),
    other_payment: numberValue(formData.get("other_payment")),
    actual_transfer_amount: numberValue(formData.get("actual_transfer_amount"))
  };

  const totals = calculateSalary(staff, contracts ?? [], draft, formula ?? defaultFormula);
  await supabase.from("salary_monthly").upsert(
    {
      ...draft,
      ...totals,
      status: textValue(formData.get("status")) ?? "下書き",
      confirmed_at: formData.get("status") === "確定" ? new Date().toISOString() : null,
      confirmed_by: formData.get("status") === "確定" ? user.id : null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "staff_id,target_month" }
  );

  revalidatePath("/admin/salaries");
  revalidatePath("/staff/salary");
}

function nextMonth(targetMonth: string) {
  const [year, month] = targetMonth.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return next.toISOString().slice(0, 10);
}
