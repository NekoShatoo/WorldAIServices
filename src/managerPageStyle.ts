export const MANAGER_COMMON_STYLE = `

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --mgr-bg: #f7f3ff;
      --mgr-surface: #ffffff;
      --mgr-surface-soft: #f2ecff;
      --mgr-border: #ded3f7;
      --mgr-primary: #7c3aed;
      --mgr-primary-hover: #6d28d9;
      --mgr-primary-soft: #eee7ff;
      --mgr-text: #2d2244;
      --mgr-muted: #706286;
      --mgr-danger: #b42318;
      --mgr-danger-soft: #fee4e2;
      --mgr-warning: #a15c07;
      --mgr-warning-soft: #fff4d6;
      --mgr-info: #155eef;
      --mgr-info-soft: #eaf1ff;
      --mgr-shadow: 0 1px 2px rgba(45, 34, 68, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--mgr-bg);
      color: var(--mgr-text);
      font-family: "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif;
      letter-spacing: 0;
    }
    button, input, select, textarea { font: inherit; }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    .app-shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 248px minmax(0, 1fr);
    }
    .app-sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      border-right: 1px solid #2b1c4d;
      background: #2b184d;
      color: #f7f2ff;
      padding: 18px 14px;
    }
    .brand-block {
      padding: 8px 8px 18px;
      border-bottom: 1px solid rgba(255,255,255,0.14);
      margin-bottom: 14px;
    }
    .brand-title { font-size: 18px; font-weight: 750; line-height: 1.2; }
    .brand-subtitle { margin-top: 4px; font-size: 12px; color: #cbbdf1; }
    .nav-group { padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.12); }
    .nav-group-title {
      padding: 0 8px 6px;
      color: #cbbdf1;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .nav-item {
      width: 100%;
      display: block;
      text-align: left;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 14px;
      background: transparent;
      color: #d8cef4;
      transition: background 0.12s ease, color 0.12s ease, box-shadow 0.12s ease;
    }
    .nav-item:hover { background: rgba(255,255,255,0.11); color: #ffffff; }
    .nav-item.active {
      background: #ffffff;
      color: #4c1d95;
      box-shadow: inset 3px 0 0 #a78bfa;
    }
    .logout-button {
      width: calc(100% - 16px);
      margin: 16px 8px 0;
      padding: 9px 10px;
      border-radius: 6px;
      background: rgba(255,255,255,0.11);
      color: #f7f2ff;
      font-size: 13px;
      font-weight: 700;
    }
    .workspace {
      position: relative;
      min-width: 0;
      padding: 22px;
    }
    .panel {
      max-width: 1420px;
      margin: 0 auto;
      padding: 0;
    }
    .panel + .panel { margin-top: 0; }
    .panel-header, .section-header, .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .panel-title { font-size: 22px; font-weight: 780; line-height: 1.2; }
    .panel-subtitle { margin-top: 4px; font-size: 13px; color: var(--mgr-muted); }
    .surface, .card {
      background: var(--mgr-surface);
      border: 1px solid var(--mgr-border);
      border-radius: 8px;
      box-shadow: var(--mgr-shadow);
    }
    .surface { padding: 14px; }
    .section-stack { display: grid; gap: 14px; margin-top: 14px; }
    .two-column { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .metric { padding: 12px; }
    .metric-label { font-size: 12px; color: var(--mgr-muted); }
    .metric-value { margin-top: 4px; font-size: 19px; font-weight: 780; }
    .field-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .field-label { display: block; font-size: 13px; font-weight: 650; color: var(--mgr-text); }
    .field-input {
      width: 100%;
      margin-top: 5px;
      border: 1px solid var(--mgr-border);
      border-radius: 7px;
      padding: 8px 10px;
      background: #ffffff;
      color: var(--mgr-text);
      outline: none;
    }
    .field-input:focus { border-color: var(--mgr-primary); box-shadow: 0 0 0 3px rgba(124,58,237,0.14); }
    .span-2 { grid-column: span 2 / span 2; }
    .span-3 { grid-column: span 3 / span 3; }
    .button-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      border-radius: 7px;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.1;
      white-space: nowrap;
    }
    .btn-primary, .bg-violet-600, .hover\\:bg-violet-500:hover {
      background: var(--mgr-primary) !important;
      color: #ffffff !important;
    }
    .btn-primary:hover { background: var(--mgr-primary-hover); }
    .btn-soft, .bg-violet-100 {
      background: var(--mgr-primary-soft) !important;
      color: #5b21b6 !important;
    }
    .btn-info, .bg-sky-600 {
      background: var(--mgr-info) !important;
      color: #ffffff !important;
    }
    .btn-danger, .bg-red-100 {
      background: var(--mgr-danger-soft) !important;
      color: var(--mgr-danger) !important;
    }
    .text-violet-700 { color: #5b21b6 !important; }
    .border-violet-100 { border-color: rgba(255,255,255,0.12) !important; }
    .border-violet-400 { border-color: var(--mgr-primary) !important; }
    .bg-violet-50 { background: var(--mgr-surface-soft) !important; }
    .rounded-xl, .rounded-lg { border-radius: 7px !important; }
    .chip {
      border-radius: 999px;
      padding: 2px 9px;
      font-size: 12px;
      background: var(--mgr-primary-soft);
      color: #5b21b6;
    }
    .progress-row { display: grid; gap: 8px; }
    .progress-label {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
      color: var(--mgr-muted);
    }
    .progress-track {
      width: 100%;
      height: 8px;
      overflow: hidden;
      border-radius: 999px;
      background: #ece4fb;
    }
    .progress-track > div { height: 100%; }
    .log-box {
      min-height: 96px;
      max-height: 260px;
      overflow: auto;
      border: 1px solid var(--mgr-border);
      border-radius: 8px;
      background: #faf8ff;
      padding: 10px;
      color: var(--mgr-text);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(38, 21, 65, 0.46);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 40;
      padding: 16px;
    }
    .modal-card-scroll {
      max-height: calc(100vh - 32px);
      overflow-y: auto;
    }
    .loading-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(247, 243, 255, 0.76);
      backdrop-filter: blur(3px);
      z-index: 80;
      padding: 16px;
      transition: opacity 0.18s ease;
    }
    .workspace > .loading-overlay { position: absolute; }
    .loading-overlay.hidden {
      opacity: 0;
      pointer-events: none;
    }
    .loading-spinner {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      border: 3px solid #ddd0ff;
      border-top-color: var(--mgr-primary);
      animation: mgr-spin 0.85s linear infinite;
    }
    .section-loading { position: relative; min-height: 100px; overflow: hidden; }
    .section-loading::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.54) 50%, rgba(255,255,255,0.1) 100%);
      animation: mgr-shimmer 1.1s linear infinite;
      pointer-events: none;
    }
    .hidden { display: none !important; }
    .relative { position: relative; }
    .absolute { position: absolute; }
    .inline-block { display: inline-block; }
    .grid { display: grid; }
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .flex-wrap { flex-wrap: wrap; }
    .flex-1 { flex: 1 1 0%; }
    .flex-shrink-0 { flex-shrink: 0; }
    .items-start { align-items: flex-start; }
    .items-center { align-items: center; }
    .items-end { align-items: flex-end; }
    .justify-between { justify-content: space-between; }
    .justify-center { justify-content: center; }
    .justify-end { justify-content: flex-end; }
    .self-center { align-self: center; }
    .gap-2 { gap: 8px; }
    .gap-3 { gap: 12px; }
    .gap-4 { gap: 16px; }
    .space-y-1 > * + * { margin-top: 4px; }
    .space-y-2 > * + * { margin-top: 8px; }
    .space-y-4 > * + * { margin-top: 16px; }
    .mt-0 { margin-top: 0; }
    .mt-2 { margin-top: 8px; }
    .mt-3 { margin-top: 12px; }
    .mb-2 { margin-bottom: 8px; }
    .p-3 { padding: 12px; }
    .p-4 { padding: 16px; }
    .p-5 { padding: 20px; }
    .p-6 { padding: 24px; }
    .px-2 { padding-left: 8px; padding-right: 8px; }
    .px-3 { padding-left: 12px; padding-right: 12px; }
    .px-4 { padding-left: 16px; padding-right: 16px; }
    .py-1 { padding-top: 4px; padding-bottom: 4px; }
    .py-2 { padding-top: 8px; padding-bottom: 8px; }
    .py-3 { padding-top: 12px; padding-bottom: 12px; }
    .pr-1 { padding-right: 4px; }
    .w-full { width: 100%; }
    .w-auto { width: auto; }
    .w-28 { width: 112px; }
    .h-28 { height: 112px; }
    .h-full { height: 100%; }
    .min-h-screen { min-height: 100vh; }
    .min-h-40 { min-height: 160px; }
    .min-w-0 { min-width: 0; }
    .max-w-xs { max-width: 320px; }
    .max-w-sm { max-width: 384px; }
    .max-w-md { max-width: 448px; }
    .max-w-3xl { max-width: 768px; }
    .max-w-full { max-width: 100%; }
    .max-h-40 { max-height: 160px; }
    .max-h-96 { max-height: 384px; }
    .max-h-full { max-height: 100%; }
    .max-h-\\[28rem\\] { max-height: 28rem; }
    .overflow-auto { overflow: auto; }
    .overflow-y-auto { overflow-y: auto; }
    .object-contain { object-fit: contain; }
    .break-all { word-break: break-all; }
    .whitespace-pre-wrap { white-space: pre-wrap; }
    .underline { text-decoration: underline; }
    .select-none { user-select: none; }
    .pointer-events-none { pointer-events: none; }
    .cursor-pointer { cursor: pointer; }
    .cursor-grab { cursor: grab; }
    .cursor-not-allowed { cursor: not-allowed; }
    .font-semibold { font-weight: 700; }
    .font-bold { font-weight: 780; }
    .text-xs { font-size: 12px; }
    .text-sm { font-size: 14px; }
    .text-lg { font-size: 18px; }
    .text-\\[color\\:var\\(--mgr-muted\\)\\] { color: var(--mgr-muted); }
    .text-\\[color\\:var\\(--mgr-text\\)\\] { color: var(--mgr-text); }
    .text-slate-500 { color: #667085; }
    .text-white { color: #ffffff; }
    .text-sky-700 { color: #026aa2; }
    .text-emerald-700 { color: #047857; }
    .text-amber-700 { color: #b54708; }
    .text-red-700 { color: var(--mgr-danger); }
    .text-yellow-700 { color: var(--mgr-warning); }
    .bg-white { background: #ffffff; }
    .bg-slate-100 { background: #eef2f6; }
    .bg-sky-100 { background: var(--mgr-info-soft); }
    .bg-emerald-100 { background: #dcfae6; }
    .bg-emerald-50 { background: #ecfdf3; }
    .bg-emerald-500 { background: #12b76a; }
    .bg-amber-100 { background: var(--mgr-warning-soft); }
    .bg-amber-500 { background: #f79009; }
    .bg-red-50 { background: #fef3f2; }
    .bg-red-100 { background: var(--mgr-danger-soft); }
    .bg-sky-500 { background: #2e90fa; }
    .bg-no-repeat { background-repeat: no-repeat; }
    .border { border-width: 1px; border-style: solid; border-color: var(--mgr-border); }
    .border-2 { border-width: 2px; border-style: solid; }
    .border-\\[color\\:var\\(--mgr-border\\)\\] { border-color: var(--mgr-border); }
    .border-emerald-200 { border-color: #abefc6; }
    .border-red-200 { border-color: #fecdca; }
    .rounded { border-radius: 6px; }
    .rounded-full { border-radius: 999px; }
    .shadow-lg { box-shadow: 0 12px 24px rgba(23, 33, 33, 0.16); }
    .opacity-60 { opacity: 0.6; }
    .opacity-70 { opacity: 0.7; }
    .transition-all { transition-property: all; }
    .duration-200 { transition-duration: 200ms; }
    @media (min-width: 768px) {
      .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .md\\:col-span-2 { grid-column: span 2 / span 2; }
    }
    @media (max-width: 900px) {
      .app-shell { grid-template-columns: 1fr; }
      .app-sidebar { position: relative; height: auto; }
      .workspace { padding: 14px; }
      .metric-grid, .field-grid, .two-column { grid-template-columns: 1fr; }
      .span-2, .span-3 { grid-column: span 1 / span 1; }
    }
    @keyframes mgr-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes mgr-shimmer {
      from { transform: translateX(-100%); }
      to { transform: translateX(100%); }
    }
  </style>

`;
