/* ============================================================
   profile-ui.js — Profile Page & Charts
   Handles user profile display and visualization
   ============================================================ */

const ProfileUI = (() => {

  /* ── Category colors ────────────────────────────────────── */
  const CAT_COLORS = {
    Food:      '#ff7d3b',
    Transport: '#1e6fff',
    Health:    '#f04b4b',
    Housing:   '#00c07a',
    Shopping:  '#a855f7',
    General:   '#8a95a3',
  };

  /* ── Category info ──────────────────────────────────────── */
  const CATS = {
    Food: { icon: '🍔' },
    Transport: { icon: '🚗' },
    Health: { icon: '🏥' },
    Housing: { icon: '🏠' },
    Shopping: { icon: '🛍️' },
    General: { icon: '📦' },
  };

  function getCatInfo(cat) {
    return CATS[cat] || { icon: '💰' };
  }

  /* ── Render profile ─────────────────────────────────────── */
  function render() {
    const user = App.getUser();
    const expenses = App.getExpenses();

    /* ── User info ──────────────────────────────────────── */
    document.getElementById('profile-avatar').textContent = user.username[0].toUpperCase();
    document.getElementById('profile-name').textContent = user.username;
    document.getElementById('profile-email').textContent = user.email || '—';

    // Get user creation date
    const rawUser = DBUsers.findById(user.id);
    if (rawUser && rawUser.createdAt) {
      const since = new Date(rawUser.createdAt).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      document.getElementById('profile-since').textContent = `Member since ${since}`;
    }

    /* ── Stats numbers ──────────────────────────────────── */
    const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
    const paid = expenses.filter(e => e.isPaid);
    const paidPct = expenses.length ? Math.round((paid.length / expenses.length) * 100) : 0;
    const avg = expenses.length ? total / expenses.length : 0;

    const fmtIL = v => '₪' + v.toLocaleString('he-IL', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    });

    document.getElementById('ps-total-amount').textContent = fmtIL(total);
    document.getElementById('ps-total-count').textContent = expenses.length;
    document.getElementById('ps-paid-pct').textContent = paidPct + '%';
    document.getElementById('ps-avg').textContent = fmtIL(avg);

    /* ── Charts ─────────────────────────────────────────── */
    renderDonut(expenses, fmtIL);
    renderBarChart(expenses, fmtIL);
  }

  /* ── Donut chart — spending by category ─────────────────── */
  function renderDonut(expenses, fmtIL) {
    const canvas = document.getElementById('chart-donut');
    const legend = document.getElementById('donut-legend');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    const radius = 85, inner = 50;

    // Aggregate by category
    const totals = {};
    expenses.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + parseFloat(e.amount);
    });

    const grand = Object.values(totals).reduce((s, v) => s + v, 0);
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);

    // Clear
    ctx.clearRect(0, 0, W, H);

    if (grand === 0) {
      ctx.fillStyle = '#eaecf0';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.arc(cx, cy, inner, 0, Math.PI * 2, true);
      ctx.fill();
      legend.innerHTML = '<div style="color:var(--gray-500);font-size:.82rem">No data yet</div>';
      return;
    }

    // Draw slices
    let startAngle = -Math.PI / 2;
    entries.forEach(([cat, val]) => {
      const slice = (val / grand) * Math.PI * 2;
      const color = CAT_COLORS[cat] || '#8a95a3';

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Thin gap between slices
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      startAngle += slice;
    });

    // Donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Center label
    ctx.fillStyle = '#1a2030';
    ctx.font = 'bold 13px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fmtIL(grand), cx, cy);

    // Legend
    legend.innerHTML = entries.map(([cat, val]) => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${CAT_COLORS[cat] || '#8a95a3'}"></span>
        <span>${cat}</span>
        <span class="legend-pct">${Math.round((val / grand) * 100)}%</span>
      </div>
    `).join('');
  }

  /* ── Bar chart — top 5 expenses ─────────────────────────── */
  function renderBarChart(expenses, fmtIL) {
    const container = document.getElementById('bar-chart');
    if (!container) return;

    if (expenses.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:2rem"><div class="empty-icon">📊</div><p>No expenses yet</p></div>';
      return;
    }

    // Sort by amount descending, take top 5
    const top5 = [...expenses]
      .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
      .slice(0, 5);

    const max = parseFloat(top5[0].amount);

    container.innerHTML = top5.map(e => {
      const pct = Math.round((parseFloat(e.amount) / max) * 100);
      const ci = getCatInfo(e.category);
      return `
        <div class="bar-row">
          <div class="bar-label" title="${e.title}">
            ${ci.icon} ${e.title}
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%"></div>
          </div>
          <div class="bar-amount">${fmtIL(parseFloat(e.amount))}</div>
        </div>`;
    }).join('');
  }

  return { render };
})();