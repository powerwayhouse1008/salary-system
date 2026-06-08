"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { numberValue, textValue } from "@/lib/format";
import { calculateSalary, defaultFormula } from "@/lib/payroll";
import { hashPassword } from "@/lib/password";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { PaymentItem, PaymentStatus } from "@/lib/types";

async function requireUser(role?: "admin" | "manager") {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (role === "admin" && session.user.role !== "admin") redirect("/staff/contracts");
  if (role === "manager" && session.user.role !== "admin" && session.user.role !== "manager") redirect("/staff/contracts");
  return session.user;
}

function throwIfSupabaseError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(`${fallback}: ${error.message}`);
}

function isMissingPaymentItemsColumn(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("payment_items") && (message.includes("column") || message.includes("schema cache"));
}

function isMissingManagerPermissionsTable(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "42P01" || error?.code === "PGRST205" || (message.includes("manager_staff_permissions") && message.includes("table"));
}

function isProfilesRoleConstraintError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return message.includes("employee_profiles_role_check") || (message.includes("violates check constraint") && message.includes("profiles"));
}

function salaryErrorRedirect(error: unknown, targetMonth: string | null, staffId: string | null): never {
  console.error("recalculateSalary failed", error);
  const message = error instanceof Error ? error.message : "給与を保存できませんでした。";
  const params = new URLSearchParams();
  if (targetMonth) params.set("month", targetMonth);
  if (staffId) params.set("staff", staffId);
  params.set("error", message);
  redirect(`/admin/salaries?${params.toString()}`);
}

function otherIncomeItems(formData: FormData) {
  const names = formData.getAll("other_income_name");
  const amounts = formData.getAll("other_income_amount");
  const rates = formData.getAll("other_income_rate");

  return names
    .map((name, index) => ({
      name: textValue(name) ?? "",
      amount: numberValue(amounts[index] ?? null),
      rate: numberValue(rates[index] ?? null)
    }))
    .filter((item) => item.name || item.amount > 0 || item.rate > 0);
}

const paymentStatuses: PaymentStatus[] = ["未確認", "入金待ち", "一部入金", "入金済み", "返金あり", "キャンセル"];

function paymentStatusValue(value: FormDataEntryValue | null): PaymentStatus {
  const status = textValue(value);
  return paymentStatuses.includes(status as PaymentStatus) ? (status as PaymentStatus) : "未確認";
}

function aggregatePaymentStatus(items: PaymentItem[]): PaymentStatus {
  const activeItems = items.filter((item) => item.expected_amount > 0 || (item.actual_received_amount ?? 0) > 0);
  if (activeItems.length === 0) return "未確認";
  if (activeItems.every((item) => item.payment_status === "キャンセル")) return "キャンセル";
  if (activeItems.some((item) => item.payment_status === "返金あり")) return "返金あり";
  if (activeItems.every((item) => item.payment_status === "入金済み")) return "入金済み";
  if (activeItems.some((item) => item.payment_status === "一部入金" || (item.actual_received_amount ?? 0) > 0 || item.payment_status === "入金済み")) {
    return "一部入金";
  }
  if (activeItems.some((item) => item.payment_status === "入金待ち")) return "入金待ち";
  return "未確認";
}

function paymentItemsConfirmedAt(items: PaymentItem[]) {
  return items.some((item) => item.payment_status === "入金済み") ? new Date().toISOString() : null;
}

function nullableNumberValue(value: FormDataEntryValue | null) {
  return textValue(value) === null ? null : numberValue(value);
}

function revalidateSalaryPages() {
  revalidatePath("/admin/salaries");
  revalidatePath("/staff/salary");
}

function revalidateManagementPages() {
  revalidatePath("/admin/employees");
  revalidatePath("/admin/contracts");
  revalidatePath("/admin/salaries");
}

function employeeErrorRedirect(error: unknown): never {
  console.error("saveEmployee failed", error);
  const message = isProfilesRoleConstraintError(error)
    ? "社員を更新できませんでした。Supabaseでemployee_profiles_role_checkを更新し、roleにmanagerを許可してください。"
    : error instanceof Error
      ? error.message
      : "社員を保存できませんでした。";
  redirect(`/admin/employees?error=${encodeURIComponent(message)}`);
}

async function canManageSalaryStaff(supabase: ReturnType<typeof getSupabaseAdmin>, user: { id: string; role: string }, staffId: string) {
  if (user.role === "admin") return true;
  if (user.role !== "manager") return false;
  if (staffId === user.id) return true;
  if ((await getManagedStaffIds(supabase, user.id)).includes(staffId)) return true;
  const { data, error } = await supabase
    .from("manager_staff_permissions")
    .select("staff_id")
    .eq("manager_id", user.id)
    .eq("staff_id", staffId)
    .maybeSingle();
  if (isMissingManagerPermissionsTable(error)) return false;
  throwIfSupabaseError(error, "給与計算の権限を確認できませんでした");
  return Boolean(data);
}

async function getManagedStaffIds(supabase: ReturnType<typeof getSupabaseAdmin>, managerId: string) {
  const { data, error } = await supabase.from("manager_staff_permissions").select("staff_id").eq("manager_id", managerId);
  if (isMissingManagerPermissionsTable(error)) {
    return [];
  }
  throwIfSupabaseError(error, "管理対象社員を確認できませんでした");
  return (data ?? []).map((row) => row.staff_id as string);
}

async function assertCanManageContracts(supabase: ReturnType<typeof getSupabaseAdmin>, user: { id: string; role: string }, contractIds: string[]) {
  if (user.role === "admin") return;
  if (user.role !== "manager") throw new Error("この契約を操作する権限がありません。");
  const managedStaffIds = new Set(await getManagedStaffIds(supabase, user.id));
  managedStaffIds.add(user.id);
  const uniqueIds = Array.from(new Set(contractIds));
  if (uniqueIds.length === 0) return;

  const { data, error } = await supabase.from("contracts").select("id,staff_id").in("id", uniqueIds);
  throwIfSupabaseError(error, "契約の権限を確認できませんでした");
  if ((data ?? []).length !== uniqueIds.length || (data ?? []).some((contract) => !managedStaffIds.has(contract.staff_id as string))) {
    throw new Error("管理対象外の契約は操作できません。");
  }
}

async function saveManagerStaffPermissions(supabase: ReturnType<typeof getSupabaseAdmin>, managerId: string, role: string, formData: FormData) {
  const staffIds = Array.from(
    new Set(formData.getAll("managed_staff_id").map((id) => textValue(id)).filter((id): id is string => Boolean(id) && id !== managerId))
  );
  const { error: deleteError } = await supabase.from("manager_staff_permissions").delete().eq("manager_id", managerId);
  if (isMissingManagerPermissionsTable(deleteError)) {
    throw new Error("管理対象社員を保存できませんでした。Supabaseでmanager_staff_permissionsテーブルを作成してください。");
  }
  throwIfSupabaseError(deleteError, "管理対象社員を更新できませんでした");
  if (role !== "manager") return;

  if (staffIds.length === 0) return;

  const { error } = await supabase.from("manager_staff_permissions").insert(
    staffIds.map((staffId) => ({
      manager_id: managerId,
      staff_id: staffId
    }))
  );
  if (isMissingManagerPermissionsTable(error)) {
    throw new Error("管理対象社員を保存できませんでした。Supabaseでmanager_staff_permissionsテーブルを作成してください。");
  }
  throwIfSupabaseError(error, "管理対象社員を保存できませんでした");
}

export async function saveEmployee(formData: FormData) {
  await requireUser("admin");
  try {
    const supabase = getSupabaseAdmin();
    const id = textValue(formData.get("id"));
    const rawPassword = textValue(formData.get("password"));
    const password = rawPassword?.trim() || null;
    const role = textValue(formData.get("role")) ?? "staff";
    if (!["admin", "manager", "staff"].includes(role)) throw new Error("権限の値が正しくありません。");
    const payload = {
      name: textValue(formData.get("name")) ?? "",
      email: (textValue(formData.get("email")) ?? "").toLowerCase(),
      role,
      brokerage_commission_rate: numberValue(formData.get("brokerage_commission_rate")),
      ad_commission_rate: numberValue(formData.get("ad_commission_rate")),
      is_active: formData.get("is_active") === "on"
    };
    if (!payload.email) throw new Error("Emailを入力してください。");

    const payloadWithPassword = {
      ...payload,
      ...(password ? { password_hash: await hashPassword(password) } : {})
    };

    if (id) {
      const { error } = await supabase.from("employee_profiles").update(payloadWithPassword).eq("id", id);
      throwIfSupabaseError(error, "社員を更新できませんでした");
      await saveManagerStaffPermissions(supabase, id, payload.role, formData);
    } else {
      const { data: existingProfile, error: existingProfileError } = await supabase
        .from("employee_profiles")
        .select("id")
        .ilike("email", payload.email)
        .maybeSingle();
      throwIfSupabaseError(existingProfileError, "社員情報を確認できませんでした");

      if (existingProfile?.id) {
        const { error } = await supabase.from("employee_profiles").update(payloadWithPassword).eq("id", existingProfile.id);
        throwIfSupabaseError(error, "社員を更新できませんでした");
        await saveManagerStaffPermissions(supabase, existingProfile.id, payload.role, formData);
      } else {
        const employeeId = crypto.randomUUID();
        const { error: insertError } = await supabase.from("employee_profiles").insert({ id: employeeId, ...payloadWithPassword });
        throwIfSupabaseError(insertError, "社員を追加できませんでした");
        await saveManagerStaffPermissions(supabase, employeeId, payload.role, formData);
      }
    }

  } catch (error) {
    employeeErrorRedirect(error);
  }

  revalidateManagementPages();
  redirect("/admin/employees?saved=1");
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
    other_income_items: otherIncomeItems(formData),
    ad_payment: numberValue(formData.get("ad_payment")),
    refund_or_adjustment: numberValue(formData.get("refund_or_adjustment")),
    contract_type: textValue(formData.get("contract_type")) ?? "売買",
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
    const { error } = await supabase.from("contracts").update(payload).eq("id", id);
    throwIfSupabaseError(error, "契約を更新できませんでした");
  } else {
    const { error } = await supabase.from("contracts").insert(payload);
    throwIfSupabaseError(error, "契約を追加できませんでした");
  }

  revalidatePath(isAdmin ? "/admin/contracts" : "/staff/contracts");
  revalidateSalaryPages();
  redirect(`${isAdmin ? "/admin/contracts" : "/staff/contracts"}?saved=1`);
}

export async function deleteContract(formData: FormData) {
  const user = await requireUser();
  const supabase = getSupabaseAdmin();
  const id = textValue(formData.get("id"));
  if (!id) throw new Error("契約IDがありません。");

  let query = supabase.from("contracts").delete().eq("id", id);
  if (user.role !== "admin") query = query.eq("staff_id", user.id);

  const { error } = await query;
  throwIfSupabaseError(error, "契約を削除できませんでした");

  revalidatePath(user.role === "admin" ? "/admin/contracts" : "/staff/contracts");
  revalidateSalaryPages();
}

export async function deleteSelectedContracts(formData: FormData) {
  await requireUser("admin");
  const supabase = getSupabaseAdmin();
  const ids = formData.getAll("selected_contract_id").map((id) => textValue(id)).filter((id): id is string => Boolean(id));
  if (ids.length === 0) {
    revalidatePath("/admin/contracts");
    revalidateSalaryPages();
    return;
  }

  const { error } = await supabase.from("contracts").delete().in("id", ids);
  throwIfSupabaseError(error, "選択した契約を削除できませんでした");

  revalidatePath("/admin/contracts");
  revalidateSalaryPages();
}

export async function confirmPayment(formData: FormData) {
  const user = await requireUser("manager");
  const supabase = getSupabaseAdmin();
  const id = textValue(formData.get("id"));
  if (!id) throw new Error("契約IDがありません。");
  await assertCanManageContracts(supabase, user, [id]);

  const { error } = await supabase
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
  throwIfSupabaseError(error, "入金確認を保存できませんでした");

  revalidatePath("/admin/contracts");
  revalidateSalaryPages();
}

export async function updateContractStatus(formData: FormData) {
  const user = await requireUser("manager");
  const supabase = getSupabaseAdmin();
  const id = textValue(formData.get("id"));
  const paymentStatus = textValue(formData.get("payment_status"));
  if (!id || !paymentStatus) throw new Error("契約IDまたは状態がありません。");
  await assertCanManageContracts(supabase, user, [id]);

  const { error } = await supabase
    .from("contracts")
    .update({
      payment_status: paymentStatus,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);
  throwIfSupabaseError(error, "契約状態を保存できませんでした");

  revalidatePath("/admin/contracts");
  revalidateSalaryPages();
}

export async function updateContractPaymentItem(formData: FormData) {
  const user = await requireUser("manager");
  const supabase = getSupabaseAdmin();
  const id = textValue(formData.get("id"));
  const key = textValue(formData.get("payment_item_key"));
  const label = textValue(formData.get("payment_item_label"));
  if (!id || !key || !label) throw new Error("契約IDまたは入金項目がありません。");
  await assertCanManageContracts(supabase, user, [id]);

  const { data, error: fetchError } = await supabase.from("contracts").select("payment_items").eq("id", id).single();
  if (isMissingPaymentItemsColumn(fetchError)) {
    const paymentStatus = paymentStatusValue(formData.get("payment_status"));
    const { error } = await supabase
      .from("contracts")
      .update({
        actual_received_amount: numberValue(formData.get("actual_received_amount")),
        payment_status: paymentStatus,
        payment_note: textValue(formData.get("payment_note")),
        payment_confirmed_at: paymentStatus === "入金済み" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);
    throwIfSupabaseError(error, "入金状態を保存できませんでした");
    revalidatePath("/admin/contracts");
    revalidateSalaryPages();
    return;
  }
  throwIfSupabaseError(fetchError, "入金項目を取得できませんでした");

  const existingItems = Array.isArray(data?.payment_items) ? (data.payment_items as PaymentItem[]) : [];
  const nextItem: PaymentItem = {
    key,
    label,
    expected_amount: numberValue(formData.get("expected_amount")),
    actual_received_amount: nullableNumberValue(formData.get("actual_received_amount")),
    payment_status: paymentStatusValue(formData.get("payment_status")),
    payment_note: textValue(formData.get("payment_note"))
  };
  const itemsByKey = new Map(existingItems.map((item) => [item.key, item]));
  itemsByKey.set(key, nextItem);
  const paymentItems = Array.from(itemsByKey.values());
  const actualReceivedAmount = paymentItems.reduce((total, item) => total + Number(item.actual_received_amount ?? item.expected_amount ?? 0), 0);
  const paymentStatus = aggregatePaymentStatus(paymentItems);

  const { error } = await supabase
    .from("contracts")
    .update({
      payment_items: paymentItems,
      actual_received_amount: actualReceivedAmount,
      payment_status: paymentStatus,
      payment_confirmed_at: paymentItemsConfirmedAt(paymentItems),
      updated_at: new Date().toISOString()
    })
    .eq("id", id);
  throwIfSupabaseError(error, "入金項目を保存できませんでした");

  revalidatePath("/admin/contracts");
  revalidateSalaryPages();
}

export async function updateContractPaymentItems(formData: FormData) {
  const user = await requireUser("manager");
  const supabase = getSupabaseAdmin();
  const contractIds = formData.getAll("contract_id");
  const keys = formData.getAll("payment_item_key");
  const labels = formData.getAll("payment_item_label");
  const expectedAmounts = formData.getAll("expected_amount");
  const actualAmounts = formData.getAll("actual_received_amount");
  const statuses = formData.getAll("payment_status");
  const notes = formData.getAll("payment_note");

  const itemsByContractId = new Map<string, PaymentItem[]>();
  keys.forEach((rawKey, index) => {
    const contractId = textValue(contractIds[index] ?? null);
    const key = textValue(rawKey);
    const label = textValue(labels[index] ?? null);
    if (!contractId || !key || !label) return;

    const item: PaymentItem = {
      key,
      label,
      expected_amount: numberValue(expectedAmounts[index] ?? null),
      actual_received_amount: nullableNumberValue(actualAmounts[index] ?? null),
      payment_status: paymentStatusValue(statuses[index] ?? null),
      payment_note: textValue(notes[index] ?? null)
    };
    itemsByContractId.set(contractId, [...(itemsByContractId.get(contractId) ?? []), item]);
  });

  const ids = Array.from(itemsByContractId.keys());
  if (ids.length === 0) {
    revalidatePath("/admin/contracts");
    revalidateSalaryPages();
    return;
  }
  await assertCanManageContracts(supabase, user, ids);

  const { data, error: fetchError } = await supabase.from("contracts").select("id,payment_items").in("id", ids);
  if (isMissingPaymentItemsColumn(fetchError)) {
    await Promise.all(
      ids.map((id) => {
        const submittedItems = itemsByContractId.get(id) ?? [];
        const actualReceivedAmount = submittedItems.reduce((total, item) => total + Number(item.actual_received_amount ?? item.expected_amount ?? 0), 0);
        const paymentStatus = aggregatePaymentStatus(submittedItems);
        return supabase
          .from("contracts")
          .update({
            actual_received_amount: actualReceivedAmount,
            payment_status: paymentStatus,
            payment_note: submittedItems.find((item) => item.payment_note)?.payment_note ?? null,
            payment_confirmed_at: paymentItemsConfirmedAt(submittedItems),
            updated_at: new Date().toISOString()
          })
          .eq("id", id);
      })
    );
    revalidatePath("/admin/contracts");
    revalidateSalaryPages();
    redirect("/admin/contracts?saved=1");
  }
  throwIfSupabaseError(fetchError, "入金項目を取得できませんでした");

  const existingItemsByContractId = new Map(
    (data ?? []).map((contract) => [
      contract.id,
      Array.isArray(contract.payment_items) ? (contract.payment_items as PaymentItem[]) : []
    ])
  );

  const updateResults = await Promise.all(
    ids.map((id) => {
      const itemsByKey = new Map((existingItemsByContractId.get(id) ?? []).map((item) => [item.key, item]));
      (itemsByContractId.get(id) ?? []).forEach((item) => itemsByKey.set(item.key, item));
      const paymentItems = Array.from(itemsByKey.values());
      const actualReceivedAmount = paymentItems.reduce((total, item) => total + Number(item.actual_received_amount ?? item.expected_amount ?? 0), 0);
      const paymentStatus = aggregatePaymentStatus(paymentItems);

      return supabase
        .from("contracts")
        .update({
          payment_items: paymentItems,
          actual_received_amount: actualReceivedAmount,
          payment_status: paymentStatus,
          payment_confirmed_at: paymentItemsConfirmedAt(paymentItems),
          updated_at: new Date().toISOString()
        })
        .eq("id", id);
    })
  );

  updateResults.forEach((result) => throwIfSupabaseError(result.error, "入金項目を保存できませんでした"));
  revalidatePath("/admin/contracts");
  revalidateSalaryPages();
  redirect("/admin/contracts?saved=1");
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

  if (payload.is_default) {
    const { error } = await supabase.from("salary_formulas").update({ is_default: false }).neq("id", id ?? "");
    throwIfSupabaseError(error, "既定の計算式を更新できませんでした");
  }
  if (id) {
    const { error } = await supabase.from("salary_formulas").update(payload).eq("id", id);
    throwIfSupabaseError(error, "計算式を更新できませんでした");
  } else {
    const { error } = await supabase.from("salary_formulas").insert(payload);
    throwIfSupabaseError(error, "計算式を追加できませんでした");
  }

  revalidatePath("/admin/formulas");
  redirect("/admin/formulas?saved=1");
}

export async function recalculateSalary(formData: FormData) {
  const user = await requireUser("manager");
  const supabase = getSupabaseAdmin();
  const staffId = textValue(formData.get("staff_id"));
  const targetMonth = textValue(formData.get("target_month"));
  try {
    if (!staffId || !targetMonth) throw new Error("社員と対象月を選択してください。");
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) throw new Error("対象月の形式が正しくありません。");
    if (!(await canManageSalaryStaff(supabase, user, staffId))) throw new Error("この社員の給与計算を操作する権限がありません。");
    const [staffResult, formulaResult, contractsResult] = await Promise.all([
      supabase.from("employee_profiles").select("*").eq("id", staffId).single(),
      supabase.from("salary_formulas").select("*").eq("is_default", true).order("updated_at", { ascending: false }).limit(1),
      supabase
        .from("contracts")
        .select("*")
        .eq("staff_id", staffId)
        .in("payment_status", ["入金済み", "一部入金"])
        .gte("payment_confirmed_at", `${targetMonth}-01`)
        .lt("payment_confirmed_at", nextMonth(targetMonth))
    ]);
    throwIfSupabaseError(staffResult.error, "社員を取得できませんでした");
    throwIfSupabaseError(formulaResult.error, "計算式を取得できませんでした");
    throwIfSupabaseError(contractsResult.error, "契約を取得できませんでした");

    if (!staffResult.data) throw new Error("社員が見つかりません。");

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
      other_income_items: otherIncomeItems(formData),
      actual_transfer_amount: numberValue(formData.get("actual_transfer_amount"))
    };

    const formula = Array.isArray(formulaResult.data) ? formulaResult.data[0] : null;
    const totals = calculateSalary(staffResult.data, contractsResult.data ?? [], draft, formula ?? defaultFormula);
    const payload = {
      ...draft,
      ...totals,
      status: textValue(formData.get("status")) ?? "下書き",
      confirmed_at: formData.get("status") === "確定" ? new Date().toISOString() : null,
      confirmed_by: formData.get("status") === "確定" ? user.id : null,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from("salary_monthly").upsert(payload, { onConflict: "staff_id,target_month" });
    throwIfSupabaseError(error, "給与を保存できませんでした");

    revalidatePath("/admin/salaries");
    revalidatePath("/staff/salary");
    redirect(`/admin/salaries?month=${encodeURIComponent(targetMonth)}&staff=${encodeURIComponent(staffId)}&saved=1`);
  } catch (error) {
    salaryErrorRedirect(error, targetMonth, staffId);
  }
}

function nextMonth(targetMonth: string) {
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    throw new Error("対象月の形式が正しくありません。");
  }
  const [year, month] = targetMonth.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return next.toISOString().slice(0, 10);
}
