export type Role = "admin" | "staff";
export type PaymentStatus = "未確認" | "入金待ち" | "一部入金" | "入金済み" | "返金あり" | "キャンセル";
export type SalaryStatus = "下書き" | "確定" | "支払済み";
export type OtherIncomeItem = {
  name: string;
  amount: number;
  rate: number;
};

export type Profile = {
  id: string;
  microsoft_id?: string | null;
  avatar_url?: string | null;
  name: string;
  email: string;
  password_hash?: string | null;
  role: Role;
  brokerage_commission_rate: number;
  ad_commission_rate: number;
  is_active: boolean;
  last_login_at?: string | null;
};

export type Contract = {
  id: string;
  staff_id: string;
  contract_date: string | null;
  contract_number: string | null;
  customer_name: string | null;
  residence_status: string | null;
  phone: string | null;
  property_name: string | null;
  address: string | null;
  rent: number;
  bank_deposit: number;
  withdrawal: number;
  transfer_fee: number;
  brokerage_sales: number;
  ad_sales: number;
  other_income_items: OtherIncomeItem[] | null;
  ad_payment: number;
  refund_or_adjustment: number;
  contract_type: string | null;
  management_company: string | null;
  previous_ad_payment: number;
  salary_item: string | null;
  salary_settlement: number;
  expected_payment_amount: number;
  actual_received_amount: number;
  payment_status: PaymentStatus;
  payment_confirmed_at: string | null;
  payment_confirmed_by: string | null;
  payment_note: string | null;
  profiles?: Pick<Profile, "name" | "email"> | null;
};

export type SalaryFormula = {
  id: string;
  name: string;
  formula_total: string | null;
  formula_deduction: string | null;
  formula_transfer: string | null;
  formula_remaining: string | null;
  is_default: boolean;
};

export type SalaryMonthly = {
  id: string;
  staff_id: string;
  target_month: string;
  brokerage_sales_total: number;
  ad_sales_total: number;
  brokerage_commission: number;
  ad_commission: number;
  other_income_items: OtherIncomeItem[] | null;
  other_income_total: number;
  other_income_commission: number;
  social_insurance: number;
  pension: number;
  employment_insurance: number;
  income_tax: number;
  commuter_pass: number;
  contract_transportation: number;
  it_cost: number;
  property_management_cost: number;
  previous_remaining_amount: number;
  expense_receipts: number;
  other_deduction: number;
  other_payment: number;
  total_amount: number;
  transfer_amount: number;
  actual_transfer_amount: number;
  remaining_amount: number;
  status: SalaryStatus;
  profiles?: Pick<Profile, "name" | "email"> | null;
};
