import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getSupabaseAdmin, hasSupabaseAdminEnv } from "@/lib/supabase";
import type { Role } from "@/lib/types";

const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
  .split(",")
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);

const autoCreateProfile = process.env.AUTO_CREATE_PROFILE !== "false";
const defaultAdminEmail = process.env.DEFAULT_ADMIN_EMAIL?.toLowerCase();
const localAdminEmail = process.env.LOCAL_ADMIN_EMAIL?.toLowerCase() ?? "admin@local.internal";
const localAdminPassword = process.env.LOCAL_ADMIN_PASSWORD ?? "admin123";
const hasMicrosoftEntraConfig = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
);
const authSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "local-dev-auth-secret";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: authSecret,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30
  },
  pages: {
    signIn: "/login",
    error: "/login"
  },
  providers: [
    Credentials({
      name: "ID・パスワード",
      credentials: {
        login: { label: "ログインID", type: "text" },
        password: { label: "パスワード", type: "password" }
      },
      async authorize(credentials) {
        try {
          const login = String(credentials?.login ?? "").trim().toLowerCase();
          const password = String(credentials?.password ?? "");
           if (!login || !password || !hasSupabaseAdminEnv()) return null;

          const supabase = getSupabaseAdmin();
          const adminAliases = [localAdminEmail, "admin", "admin@admin.com"];
          const email = login === "admin" ? localAdminEmail : login;
          let profile = null;

          if (login === "admin") {
            const { data: adminProfiles } = await supabase
              .from("profiles")
              .select("*")
              .eq("role", "admin")
              .order("created_at", { ascending: true });
            profile =
              adminProfiles?.find((candidate) => candidate.email === localAdminEmail) ??
              adminProfiles?.find((candidate) => adminAliases.includes((candidate.email ?? "").toLowerCase())) ??
              adminProfiles?.find((candidate) => candidate.is_active !== false) ??
              adminProfiles?.[0] ??
              null;
          } else {
            const result = await supabase.from("profiles").select("*").eq("email", email).maybeSingle();
            profile = result.data;
          }

          if (login === "admin" && !profile) {
            const { data: authUser, error } = await supabase.auth.admin.createUser({
              email,
              email_confirm: true,
              user_metadata: { name: "Admin" }
            });
            if (error || !authUser.user) return null;

            const { data: created } = await supabase
              .from("profiles")
              .insert({
                id: authUser.user.id,
                name: "Admin",
                email,
                password_hash: await hashPassword(localAdminPassword),
                role: "admin",
                is_active: true,
                last_login_at: new Date().toISOString()
              })
              .select("*")
              .single();
            profile = created;
          }

          

          if (!profile || profile.is_active === false) return null;
          const isInitialAdmin = login === "admin" && !profile.password_hash && password === localAdminPassword;
          const passwordMatches = isInitialAdmin || (await verifyPassword(password, profile.password_hash));
          if (!passwordMatches) return null;

          if (isInitialAdmin) {
            await supabase.from("profiles").update({ password_hash: await hashPassword(password) }).eq("id", profile.id);
          }
           

          await supabase
            .from("profiles")
            .update({
             last_login_at: new Date().toISOString()
            })
            .eq("id", profile.id);

          return {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            isActive: profile.is_active
          };
        } catch (error) {
          console.error("Credentials authorize failed", error);
          return null;
        }
      }
    }),
    ...(hasMicrosoftEntraConfig
      ? [
          MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
            issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
          })
        ]
      : [])
  ],
  callbacks: {
    async signIn({ profile, account }) {
      if (account?.provider === "credentials") return true;

      const email = profile?.email?.toLowerCase();
      if (!email || !profile) return false;
      const domain = email.split("@").at(1);
      if (allowedDomains.length && (!domain || !allowedDomains.includes(domain))) return false;
      if (!hasSupabaseAdminEnv()) return "/login?error=ServerConfig";
      const supabase = getSupabaseAdmin();
      const { data: existing } = await supabase.from("profiles").select("*").eq("email", email).maybeSingle();

      if (!existing && !autoCreateProfile) return "/login?error=AccessPending";

      if (!existing) {
        const role: Role = defaultAdminEmail === email ? "admin" : "staff";
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            name: profile.name ?? email,
            microsoft_id: profile.sub,
            avatar_url: profile.picture
          }
        });

        if (authError || !authUser.user) return false;

        await supabase.from("profiles").insert({
          id: authUser.user.id,
          microsoft_id: profile.sub,
          name: profile.name ?? email,
          email,
          avatar_url: profile.picture,
          role,
          last_login_at: new Date().toISOString()
        });
      } else {
        await supabase
          .from("profiles")
          .update({
            microsoft_id: existing.microsoft_id ?? profile.sub,
            name: profile.name ?? existing.name,
            avatar_url: profile.picture ?? existing.avatar_url,
            last_login_at: new Date().toISOString()
          })
          .eq("id", existing.id);
      }

      return true;
    },
    async jwt({ token, profile, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.isActive = user.isActive;
        token.name = user.name;
        token.email = user.email;
      }

      const email = (token.email ?? profile?.email)?.toLowerCase();
      if (!email) return token;
     if (!hasSupabaseAdminEnv()) return token;
      try {
        const supabase = getSupabaseAdmin();
        const { data } = await supabase.from("profiles").select("id, role, is_active, name").eq("email", email).maybeSingle();
        if (data) {
          token.sub = data.id;
          token.role = data.role;
          token.isActive = data.is_active;
          token.name = data.name;
        }
      } catch (error) {
        console.error("JWT profile sync failed", error);
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as Role) ?? "staff";
        session.user.isActive = token.isActive !== false;
      }
      return session;
    },
    authorized({ auth: session, request }) {
      const path = request.nextUrl.pathname;
      if (path === "/login" || path.startsWith("/api/auth")) return true;
      const role = session?.user?.role;
      const active = session?.user?.isActive !== false;
      if (!session?.user || !active) return false;
      if (path.startsWith("/admin")) return role === "admin";
      if (path.startsWith("/staff")) return role === "admin" || role === "staff";
      return true;
    }
  }
});
