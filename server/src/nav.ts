export type NavSection = "registry" | "check" | "sources" | "research" | "protect" | "account";

export const TOP_NAV_CSS = `
  .top-nav { height: 48px; box-sizing: border-box; background: #111827; color: #fff; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; gap: 20px; position:relative; z-index:10000; }
  .top-nav .brand { color: #fff; font-size: 15px; font-weight: 800; letter-spacing: .01em; text-decoration: none; }
  .nav-toggle { position:absolute; opacity:0; pointer-events:none; }
  .nav-toggle-label { display:none; min-width:44px; min-height:44px; align-items:center; justify-content:center; border:1px solid #374151; border-radius:8px; color:#fff; cursor:pointer; font-size:20px; line-height:1; }
  .top-nav nav { display: flex; align-items: stretch; height: 100%; }
  .top-nav nav a { color: #9ca3af; display: flex; align-items: center; padding: 0 12px; border-bottom: 2px solid transparent; font-size: 13px; font-weight: 600; text-decoration: none; }
  .top-nav nav a:hover { color: #fff; background: #1f2937; }
  .top-nav nav a.active { color: #fff; border-bottom-color: #f59e0b; }
  @media (max-width: 480px) {
    .top-nav { padding: 0 10px; gap: 8px; }
    .nav-toggle-label { display:flex; }
    .top-nav nav { display:none; position:absolute; top:48px; left:0; right:0; height:auto; padding:7px; background:#111827; border-top:1px solid #374151; box-shadow:0 8px 18px rgba(0,0,0,.25); }
    .top-nav nav a { min-height:44px; padding:0 12px; border:0; border-radius:7px; font-size:13px; }
    .top-nav nav a.active { background:#1f2937; border-left:3px solid #f59e0b; }
    .nav-toggle:checked ~ nav { display:block; }
  }
`;

export function renderTopNav(active: NavSection): string {
  return `<header class="top-nav">
  <a class="brand" href="/">Dende</a>
  <input class="nav-toggle" id="primary-nav-toggle" type="checkbox" aria-label="Toggle navigation" />
  <label class="nav-toggle-label" for="primary-nav-toggle" aria-hidden="true">☰</label>
  <nav aria-label="Primary navigation">
    <a href="/"${active === "registry" ? ' class="active" aria-current="page"' : ""}>Registry</a>
    <a href="/check"${active === "check" ? ' class="active" aria-current="page"' : ""}>Check a plot</a>
    <a href="/sources"${active === "sources" ? ' class="active" aria-current="page"' : ""}>Data sources</a>
    <a href="/research"${active === "research" ? ' class="active" aria-current="page"' : ""}>Land evidence</a>
    <a href="/protect"${active === "protect" ? ' class="active" aria-current="page"' : ""}>Protect a plot</a>
    <a href="/account"${active === "account" ? ' class="active" aria-current="page"' : ""}>Account</a>
  </nav>
</header>`;
}
