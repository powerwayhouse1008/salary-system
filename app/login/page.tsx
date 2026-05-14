import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { signIn, auth } from "@/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (session?.user) redirect(session.user.role === "admin" ? "/admin" : "/staff/contracts");
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4">
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-8 shadow-sm">
        <div className="mb-8">
          <div className="mb-3 h-10 w-10 rounded-md bg-brand" />
          <h1 className="text-2xl font-bold text-ink">給与・歩合管理</h1>
          <p className="mt-2 text-sm text-slate-600">Microsoft または社内IDでログインしてください。</p>
        </div>

        {params.error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            ログインできません。IDまたは権限を確認してください。
          </div>
        ) : null}

        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="btn btn-primary w-full">
            Microsoftでログイン
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs font-semibold text-slate-400">
          <div className="h-px flex-1 bg-line" />
           <span>IDログイン</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <form className="space-y-3" action={credentialsLogin}>
          <label className="field">
            ログインID / Email
            <input name="login" autoComplete="username" placeholder="admin または staff@example.com" required />
          </label>
          
          <button type="submit" className="btn w-full">
            IDでログイン
          </button>
        </form>

       <p className="mt-4 text-xs text-slate-500">管理者ID: admin（パスワード不要）</p>
      </section>
    </main>
  );
}

async function credentialsLogin(formData: FormData) {
  "use server";

  try {
    await signIn("credentials", {
      login: String(formData.get("login") ?? ""),
      redirectTo: "/"
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      redirect(`/login?error=${error.type}`);
    }
    redirect("/login?error=CredentialsSignin");
  }
}
