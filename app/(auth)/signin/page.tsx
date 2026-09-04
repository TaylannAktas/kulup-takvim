import { signIn } from "@/auth";

/** Açık yönlendirme (open redirect) riskine karşı sadece uygulama içi yollara izin ver. */
function safeCallbackUrl(value: string | string[] | undefined): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-xl font-semibold">Kulüp Takvimi</h1>
        <p className="text-sm text-gray-600">
          Devam etmek için kulüp hesabınızla giriş yapın.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl });
          }}
        >
          <button
            type="submit"
            className="w-full rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Google ile giriş yap
          </button>
        </form>
      </div>
    </main>
  );
}
