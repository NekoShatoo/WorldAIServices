export const MANAGER_COMMON_STYLE = `

  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --mgr-border: #ddd0ff;
      --mgr-primary-soft: #efe7ff;
      --mgr-text: #2c1d49;
      --mgr-muted: #6e5d8f;
      --mgr-danger: #dc2626;
    }
    body {
      margin: 0;
      background: linear-gradient(165deg, #f8f4ff 0%, #f1eaff 100%);
      color: var(--mgr-text);
      min-height: 100vh;
    }
    .card {
      background: #fff;
      border: 1px solid var(--mgr-border);
      border-radius: 16px;
      box-shadow: 0 8px 30px rgba(139, 92, 246, 0.12);
    }
    .nav-item {
      width: 100%;
      text-align: left;
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 14px;
      color: var(--mgr-text);
    }
    .nav-item:hover { background: var(--mgr-primary-soft); }
    .nav-item.active { background: #8b5cf6; color: #fff; }
    .chip {
      border-radius: 999px;
      padding: 2px 10px;
      font-size: 12px;
      background: var(--mgr-primary-soft);
      color: #8b5cf6;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(35, 20, 60, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 40;
      padding: 16px;
    }
  </style>

`;
