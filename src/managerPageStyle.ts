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
    .modal-card-scroll {
      max-height: calc(100vh - 32px);
      overflow-y: auto;
    }
    .loading-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(35, 20, 60, 0.34);
      backdrop-filter: blur(3px);
      z-index: 80;
      padding: 16px;
      transition: opacity 0.18s ease;
      border-radius: 16px;
    }
    .loading-overlay.hidden {
      opacity: 0;
      pointer-events: none;
    }
    .loading-spinner {
      width: 52px;
      height: 52px;
      border-radius: 999px;
      border: 4px solid #d9c8ff;
      border-top-color: #7c3aed;
      animation: mgr-spin 0.85s linear infinite;
    }
    .section-loading {
      position: relative;
      min-height: 120px;
    }
    .section-loading::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.52) 50%, rgba(255,255,255,0.24) 100%);
      animation: mgr-shimmer 1.1s linear infinite;
      pointer-events: none;
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
