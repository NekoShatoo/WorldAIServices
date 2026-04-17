import { MANAGER_COMMON_STYLE } from './managerPageStyle';

export function buildManagerLoginPageHtml() {
	return `<!doctype html><html lang="ja"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Manager Login</title>${MANAGER_COMMON_STYLE}</head>
<body class="font-sans">
  <main class="min-h-screen flex items-center justify-center px-4">
    <section class="card w-full max-w-md p-6 space-y-4">
      <h1 class="text-2xl font-bold">管理画面ログイン</h1>
      <p class="text-sm text-[color:var(--mgr-muted)]">World AI Services /mgr</p>
      <label class="block text-sm font-semibold">管理パスワード</label>
      <input id="passwordInput" type="password" class="w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)] focus:outline-none focus:ring-2 focus:ring-violet-400" />
      <button id="loginButton" class="w-full px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500">ログイン</button>
      <p id="notice" class="text-sm text-[color:var(--mgr-muted)]"></p>
    </section>
  </main>
  <script>
    const token = localStorage.getItem("mgr_token") || "";
    if (token) location.href = "/mgr/app";
    const passwordInput = document.getElementById("passwordInput");
    const notice = document.getElementById("notice");
    async function login() {
      const response = await fetch("/mgr/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: passwordInput.value }),
      });
      const data = await response.json().catch(() => ({ status: "error" }));
      if (data.status !== "ok") {
        notice.textContent = "ログインに失敗しました。";
        return;
      }
      localStorage.setItem("mgr_token", data.result.token);
      location.href = "/mgr/app";
    }
    document.getElementById("loginButton").addEventListener("click", login);
    passwordInput.addEventListener("keydown", (event) => event.key === "Enter" ? login() : null);
  </script>
</body></html>`;
}
