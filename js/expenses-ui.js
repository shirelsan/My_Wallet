/* ============================================================
   expenses-ui.js — Expenses Management UI
   ============================================================ */

const ExpensesUI = (() => {

    /* ── Category config ────────────────────────────────────── */
    const CATS = {
        Food: { icon: '🍔', cls: 'cat-food' },
        Transport: { icon: '🚗', cls: 'cat-transport' },
        Health: { icon: '🏥', cls: 'cat-health' },
        Housing: { icon: '🏠', cls: 'cat-housing' },
        Shopping: { icon: '🛍️', cls: 'cat-shopping' },
        General: { icon: '📦', cls: 'cat-general' },
    };

    function getCatInfo(cat) {
        return CATS[cat] || { icon: '💰', cls: 'cat-general' };
    }

    const pendingUpdates = new Map();

    /* ── Init ───────────────────────────────────────────────── */
    function init() {
        // Toolbar
        document.getElementById('btn-add').addEventListener('click', openModal);
        document.getElementById('search-input').addEventListener('input', e => handleSearch(e.target.value));

        // Modal buttons
        document.getElementById('btn-save').addEventListener('click', saveExpense);
        document.getElementById('btn-cancel').addEventListener('click', closeModal);
        document.getElementById('btn-modal-close').addEventListener('click', closeModal);

        // Close modal when clicking overlay
        document.getElementById('expense-modal').addEventListener('click', e => {
            if (e.target === e.currentTarget) closeModal();
        });

        // Default date in modal
        document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
    }

    /* ── Load expenses ──────────────────────────────────────── */
    function loadExpenses() {
        document.getElementById('expense-list').innerHTML =
            '<div class="loading-row"><span class="spinner"></span> Loading your expenses…</div>';

        App.request('GET', '/expenses', null, (res) => {
            App.setExpenses(res.data || []);
            renderList(res.data || []);
            updateStats(res.data || []);
        });
    }

    /* ── Render list ────────────────────────────────────────── */
    function renderList(expenses) {
        const view = App.getCurrentView();
        let list = [...expenses];

        if (view === 'paid') list = list.filter(e => e.isPaid);
        if (view === 'unpaid') list = list.filter(e => !e.isPaid);
        list.sort((a, b) => new Date(b.date) - new Date(a.date));

        const el = document.getElementById('expense-list');

        if (list.length === 0) {
            el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🪙</div>
          <p>No expenses here yet.<br>
             Click <strong>＋ Add Expense</strong> to get started!</p>
        </div>`;
            return;
        }

        el.innerHTML = list.map(e => {
            const ci = getCatInfo(e.category);
            const amt = '₪' + parseFloat(e.amount).toLocaleString('he-IL', {
                minimumFractionDigits: 2, maximumFractionDigits: 2
            });
            const date = new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric'
            });
            const payTitle = e.isPaid ? 'Mark as pending' : 'Mark as paid';
            const payIcon = e.isPaid ? '↺' : '✓';

            return `
        <div class="expense-item">
          <div class="expense-cat-icon ${ci.cls}">${ci.icon}</div>
          <div class="expense-info">
            <div class="expense-title">${e.title}</div>
            <div class="expense-meta">
              <span>${date}</span>
              <span class="badge badge-cat">${e.category}</span>
              <span class="badge ${e.isPaid ? 'badge-paid' : 'badge-unpaid'}">
                ${e.isPaid ? '✓ Paid' : '⏳ Pending'}
              </span>
              ${e.description ? `<span>· ${e.description}</span>` : ''}
            </div>
          </div>
          <div class="expense-amount">${amt}</div>
          <div class="expense-actions">
            <button class="action-btn pay"  title="${payTitle}"
                    onclick="ExpensesUI.togglePay('${e.id}')">${payIcon}</button>
            <button class="action-btn edit" title="Edit"
                    onclick="ExpensesUI.openEdit('${e.id}')">✎</button>
            <button class="action-btn del"  title="Delete"
                    onclick="ExpensesUI.deleteExpense('${e.id}')">🗑</button>
          </div>
        </div>`;
        }).join('');
    }

    /* ── Update stats ───────────────────────────────────────── */
    function updateStats(expenses) {
        const fmt = v => '₪' + v.toLocaleString('he-IL', {
            minimumFractionDigits: 0, maximumFractionDigits: 0
        });
        const n = v => `${v} expense${v !== 1 ? 's' : ''}`;

        const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
        const paid = expenses.filter(e => e.isPaid);
        const unpaid = expenses.filter(e => !e.isPaid);

        document.getElementById('stat-total').textContent = fmt(total);
        document.getElementById('stat-count').textContent = n(expenses.length);
        document.getElementById('stat-paid').textContent = fmt(paid.reduce((s, e) => s + parseFloat(e.amount), 0));
        document.getElementById('stat-paid-count').textContent = n(paid.length);
        document.getElementById('stat-unpaid').textContent = fmt(unpaid.reduce((s, e) => s + parseFloat(e.amount), 0));
        document.getElementById('stat-unpaid-count').textContent = n(unpaid.length);
    }

    /* ── Search ─────────────────────────────────────────────── */
    function handleSearch(q) {
        const query = q.trim().toLowerCase();

        if (!query) {
            renderList(App.getExpenses());
            return;
        }

        const filtered = App.getExpenses().filter(e =>
            e.title.toLowerCase().includes(query) ||
            e.category.toLowerCase().includes(query) ||
            (e.description && e.description.toLowerCase().includes(query))
        );

        renderList(filtered);
    }

    /* ── Modal: Open (new) ──────────────────────────────────── */
    function openModal() {
        App.setEditingId(null);
        document.getElementById('modal-title').textContent = 'Add Expense';
        document.getElementById('exp-title').value = '';
        document.getElementById('exp-amount').value = '';
        document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('exp-category').value = 'Food';
        document.getElementById('exp-paid').value = 'false';
        document.getElementById('exp-desc').value = '';
        document.getElementById('btn-save').textContent = 'Save Expense';
        document.getElementById('expense-modal').classList.add('open');
    }

    /* ── Modal: Open (edit) ─────────────────────────────────── */
    function openEdit(id) {
        const exp = App.getExpenses().find(e => e.id === id);
        if (!exp) return;

        App.setEditingId(id);
        document.getElementById('modal-title').textContent = 'Edit Expense';
        document.getElementById('exp-title').value = exp.title;
        document.getElementById('exp-amount').value = exp.amount;
        document.getElementById('exp-date').value = exp.date;
        document.getElementById('exp-category').value = exp.category;
        document.getElementById('exp-paid').value = String(exp.isPaid);
        document.getElementById('exp-desc').value = exp.description || '';
        document.getElementById('btn-save').textContent = 'Update Expense';
        document.getElementById('expense-modal').classList.add('open');
    }

    /* ── Modal: Close ───────────────────────────────────────── */
    function closeModal() {
        document.getElementById('expense-modal').classList.remove('open');
    }

    /* ── Save expense ───────────────────────────────────────── */
    function saveExpense() {
        const title = document.getElementById('exp-title').value.trim();
        const amount = document.getElementById('exp-amount').value;
        const date = document.getElementById('exp-date').value;
        const category = document.getElementById('exp-category').value;
        const isPaid = document.getElementById('exp-paid').value === 'true';
        const desc = document.getElementById('exp-desc').value.trim();

        if (!title) { App.toast('Please enter a title', 'warning'); return; }
        if (!amount || parseFloat(amount) < 0) { App.toast('Please enter a valid amount', 'warning'); return; }

        const btn = document.getElementById('btn-save');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Saving…';

        const body = { title, amount: parseFloat(amount), date, category, isPaid, description: desc };
        const editingId = App.getEditingId();

        const done = (res, msg) => {
            btn.disabled = false;
            btn.textContent = editingId ? 'Update Expense' : 'Save Expense';

            const expenses = App.getExpenses();
            if (editingId) {
                const idx = expenses.findIndex(e => e.id === editingId);
                if (idx !== -1) expenses[idx] = res.data;
            } else {
                expenses.push(res.data);
            }

            App.setExpenses(expenses);
            renderList(expenses);
            updateStats(expenses);
            closeModal();
            App.toast(msg, 'success');
        };

        const fail = (res) => {
            btn.disabled = false;
            btn.textContent = editingId ? 'Update Expense' : 'Save Expense';
            App.toast(res.message || 'Failed to save. Please retry.', 'error');
        };

        if (editingId) {
            App.request('PUT', `/expenses/${editingId}`, body, res => done(res, 'Expense updated!'), fail);
        } else {
            App.request('POST', '/expenses', body, res => done(res, 'Expense added!'), fail);
        }
    }

    /* ── Toggle paid ────────────────────────────────────────── */
    function togglePay(id) {
        const btn = event.target;
        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '⏳';
        if (pendingUpdates.has(id)) {
            pendingUpdates.get(id).abort();
        }
        const request = App.request('PUT', `/expenses/${id}/pay`, null,
            (res) => {
                pendingUpdates.delete(id);
                btn.disabled = false;
                btn.innerHTML = res.data.isPaid ? '↺' : '✓';
                const expenses = App.getExpenses();
                const idx = expenses.findIndex(e => e.id === id);
                if (idx !== -1) expenses[idx] = res.data;
                App.setExpenses(expenses);
                renderList(expenses);
                updateStats(expenses);
                App.toast(res.message, 'success');
            },
            (res) => {
                pendingUpdates.delete(id);
                btn.disabled = false;
                btn.innerHTML = originalHTML;
                App.toast(res.message || 'Failed to update', 'error');
            }
        );
        pendingUpdates.set(id, request);
    }

    /* ── Delete expense ─────────────────────────────────────── */
    function deleteExpense(id) {
        const exp = App.getExpenses().find(e => e.id === id);
        if (!exp || !confirm(`Delete "${exp.title}"?`)) return;
        const btn = event.target;
        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '⏳';
        App.request('DELETE', `/expenses/${id}`, null,
            () => {
                const expenses = App.getExpenses().filter(e => e.id !== id);
                App.setExpenses(expenses);
                renderList(expenses);
                updateStats(expenses);
                App.toast('Expense deleted', 'warning');
            },
            (res) => {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
                App.toast(res.message || 'Failed to delete', 'error');
            }
        );
    }

    return {
        init,
        loadExpenses,
        renderList,
        updateStats,
        openModal,
        openEdit,
        togglePay,
        deleteExpense
    };
})();