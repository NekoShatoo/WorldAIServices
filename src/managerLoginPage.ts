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
  <div id="loginLoadingOverlay" class="loading-overlay hidden" aria-live="polite" aria-busy="true">
    <div class="card w-full max-w-sm p-5 flex items-center gap-4">
      <div class="loading-spinner flex-shrink-0"></div>
      <div class="min-w-0">
        <p class="text-sm font-semibold">処理中</p>
        <p id="loginLoadingText" class="text-sm text-[color:var(--mgr-muted)]">ログインを確認しています...</p>
      </div>
    </div>
  </div>
  <script>
    const token = localStorage.getItem("mgr_token") || "";
    if (token) location.href = "/mgr/app";
    const passwordInput = document.getElementById("passwordInput");
    const notice = document.getElementById("notice");
    const loginButton = document.getElementById("loginButton");
    const loginLoadingOverlay = document.getElementById("loginLoadingOverlay");
    const loginLoadingText = document.getElementById("loginLoadingText");
    function setLoginLoading(visible, text) {
      loginLoadingOverlay.classList.toggle("hidden", !visible);
      loginLoadingText.textContent = text || "ログインを確認しています...";
      loginButton.disabled = visible;
      passwordInput.disabled = visible;
      loginButton.classList.toggle("opacity-70", visible);
      loginButton.classList.toggle("cursor-not-allowed", visible);
    }
    async function login() {
      setLoginLoading(true, "ログインを確認しています...");
      notice.textContent = "";
      try {
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
        setLoginLoading(true, "管理画面へ移動しています...");
        localStorage.setItem("mgr_token", data.result.token);
        location.href = "/mgr/app";
      } catch (error) {
        console.error("[mgr/login]", error);
        notice.textContent = "通信に失敗しました。";
      } finally {
        setLoginLoading(false);
      }
    }
    loginButton.addEventListener("click", login);
    passwordInput.addEventListener("keydown", (event) => event.key === "Enter" ? login() : null);
  </script>
</body></html>`;
}
