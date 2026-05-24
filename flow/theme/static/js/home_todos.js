// flow/theme/static/js/home_todos.js
(() => {
    "use strict";
  
    /* ── DOM Helper ──────────────────────────────────── */
    function $(id) { return document.getElementById(id); }
  
    /* ── CSRF ────────────────────────────────────────── */
    function getCookie(name) {
      const cookies = document.cookie ? document.cookie.split(";") : [];
      for (const cookie of cookies) {
        const trimmed = cookie.trim();
        if (trimmed.startsWith(name + "="))
          return decodeURIComponent(trimmed.slice(name.length + 1));
      }
      return null;
    }
  
    /* ── Formatting helpers ──────────────────────────── */
    function secondsToMinutes(s) {
      return Math.round(Math.max(0, Number(s) || 0) / 60);
    }
  
    /* ── Network helper ──────────────────────────────── */
    async function apiFetch(url, options = {}) {
      const headers = new Headers(options.headers || {});
      const method  = (options.method || "GET").toUpperCase();
      if (method !== "GET") {
        headers.set("Content-Type", "application/json");
        const csrf = getCookie("csrftoken");
        if (csrf) headers.set("X-CSRFToken", csrf);
      }
      const resp = await fetch(url, { credentials: "same-origin", ...options, method, headers });
      let payload = null;
      try { payload = await resp.json(); } catch { payload = null; }
      return { resp, payload };
    }
  
    /* ══════════════════════════════════════════════════
       TODO STATE
    ═════════════════════════════════════════════════════ */
    let todayTodos = [];
  
    /* ══════════════════════════════════════════════════
       TODO MODAL - Open/Close/Submit
    ═════════════════════════════════════════════════════ */
  
    function showAddTodoModal() {
      const backdrop = $("todo-modal-backdrop");
      if (!backdrop) return;
      backdrop.hidden = false;
      $("todo-title")?.focus?.();
    }
  
    function hideAddTodoModal() {
      const backdrop = $("todo-modal-backdrop");
      if (!backdrop) return;
      backdrop.hidden = true;
      const form = $("todo-form");
      if (form) form.reset();
    }
  
    async function submitNewTodo(title, description, priority) {
      const body = { title, description, priority };
      const { resp, payload } = await apiFetch("/api/todos/create/", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        throw new Error(payload?.message || payload?.error || "create_failed");
      }
      return payload?.todo;
    }
  
    /* ══════════════════════════════════════════════════
       TODO LIST - Render/Toggle/Delete
    ═════════════════════════════════════════════════════ */
  
    function renderTodoList(todos) {
      const container = $("todo-list");
      if (!container) return;
  
      if (todos.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:20px; color:rgba(232,236,255,0.55); font-size:13px;">
            No todos yet. Add one to get started! 📝
          </div>
        `;
        updateTodoStats();
        return;
      }
  
      container.innerHTML = todos.map(todo => `
        <div class="todo-item" data-todo-id="${todo.id}">
          <div class="todo-checkbox ${todo.is_completed ? 'is-checked' : ''}" 
               data-todo-id="${todo.id}" 
               role="checkbox" 
               aria-checked="${todo.is_completed}"
               tabindex="0">
          </div>
          <div class="todo-priority-dot ${todo.priority}"></div>
          <div class="todo-title ${todo.is_completed ? 'completed' : ''}">${escapeHtml(todo.title)}</div>
          <span class="todo-status ${todo.is_completed ? 'completed' : ''}">${todo.is_completed ? 'done' : 'pending'}</span>
          <button class="todo-delete" data-todo-id="${todo.id}" type="button" aria-label="Delete todo">🗑️</button>
        </div>
      `).join('');
  
      // Attach event listeners
      container.querySelectorAll('.todo-checkbox').forEach(checkbox => {
        checkbox.addEventListener('click', (e) => {
          const todoId = parseInt(e.currentTarget.dataset.todoId);
          toggleTodoCompletion(todoId);
        });
        checkbox.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const todoId = parseInt(e.currentTarget.dataset.todoId);
            toggleTodoCompletion(todoId);
          }
        });
      });
  
      container.querySelectorAll('.todo-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const todoId = parseInt(e.currentTarget.dataset.todoId);
          deleteTodo(todoId);
        });
      });
  
      updateTodoStats();
    }
  
    function escapeHtml(text) {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
      return text.replace(/[&<>"']/g, m => map[m]);
    }
  
    async function toggleTodoCompletion(todoId) {
      const todo = todayTodos.find(t => t.id === todoId);
      if (!todo) return;
  
      // Optimistic UI update
      const oldState = todo.is_completed;
      todo.is_completed = !todo.is_completed;
      renderTodoList(todayTodos);
  
      try {
        const { resp, payload } = await apiFetch(`/api/todos/${todoId}/toggle/`, {
          method: "PATCH",
        });
  
        if (!resp.ok) {
          // Rollback on error
          todo.is_completed = oldState;
          renderTodoList(todayTodos);
          if (typeof showToast !== 'undefined') {
            showToast("Error updating todo", "error");
          }
          return;
        }
  
        // Update from server response
        todo.is_completed = payload.todo?.is_completed ?? todo.is_completed;
        todo.completed_at = payload.todo?.completed_at ?? null;
        renderTodoList(todayTodos);
  
        if (typeof showToast !== 'undefined') {
          showToast(todo.is_completed ? "Todo completed! ✓" : "Todo reopened", "success");
        }
      } catch (err) {
        console.error("toggle error:", err);
        // Rollback
        todo.is_completed = oldState;
        renderTodoList(todayTodos);
      }
    }
  
    async function deleteTodo(todoId) {
      if (!confirm("Delete this todo?")) return;
  
      // Optimistic UI
      const idx = todayTodos.findIndex(t => t.id === todoId);
      const oldTodos = [...todayTodos];
      if (idx !== -1) todayTodos.splice(idx, 1);
      renderTodoList(todayTodos);
  
      try {
        const { resp } = await apiFetch(`/api/todos/${todoId}/`, {
          method: "DELETE",
        });
  
        if (!resp.ok) {
          // Rollback
          todayTodos = oldTodos;
          renderTodoList(todayTodos);
          if (typeof showToast !== 'undefined') {
            showToast("Error deleting todo", "error");
          }
          return;
        }
  
        if (typeof showToast !== 'undefined') {
          showToast("Todo deleted", "success");
        }
      } catch (err) {
        console.error("delete error:", err);
        todayTodos = oldTodos;
        renderTodoList(todayTodos);
      }
    }
  
    /* ══════════════════════════════════════════════════
       TODO STATS - Progress Bar
    ═════════════════════════════════════════════════════ */
  
    async function updateTodoStats() {
      try {
        const { resp, payload } = await apiFetch("/api/todos/stats/");
        if (!resp.ok) return;
  
        const total = payload.total_todos || 0;
        const completed = payload.completed_todos || 0;
        const percent = payload.completion_percent || 0;
  
        const textEl = $("todo-progress-text");
        if (textEl) textEl.textContent = `${completed} of ${total} completed`;
  
        const percentEl = $("todo-progress-percent");
        if (percentEl) percentEl.textContent = `${Math.round(percent)}%`;
  
        const fillEl = $("todo-progress-fill");
        if (fillEl) fillEl.style.width = `${Math.min(percent, 100)}%`;
      } catch (err) {
        console.error("stats error:", err);
      }
    }
  
    /* ══════════════════════════════════════════════════
       LOAD TODOS
    ═════════════════════════════════════════════════════ */
  
    async function loadTodosForToday() {
      try {
        const { resp, payload } = await apiFetch("/api/todos/today/");
        if (!resp.ok) return;
  
        todayTodos = Array.isArray(payload.todos) ? payload.todos : [];
        renderTodoList(todayTodos);
      } catch (err) {
        console.error("load todos error:", err);
      }
    }
  
    /* ══════════════════════════════════════════════════
       BIND EVENTS & BOOTSTRAP
    ═════════════════════════════════════════════════════ */
  
    document.addEventListener("DOMContentLoaded", () => {
      // Add Todo button
      const addTodoBtn = $("btn-add-todo");
      if (addTodoBtn) addTodoBtn.addEventListener("click", showAddTodoModal);
  
      // Modal close button (×)
      const modalClose = $("todo-modal-close");
      if (modalClose) modalClose.addEventListener("click", hideAddTodoModal);
  
      // Modal cancel button
      const cancelBtn = $("todo-cancel");
      if (cancelBtn) cancelBtn.addEventListener("click", hideAddTodoModal);
  
      // Backdrop click (close if clicking outside modal card)
      const backdrop = $("todo-modal-backdrop");
      if (backdrop) {
        backdrop.addEventListener("click", e => {
          if (e.target === backdrop) hideAddTodoModal();
        });
      }
  
      // Escape key closes modal
      document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
          const bd = $("todo-modal-backdrop");
          if (bd && !bd.hidden) hideAddTodoModal();
        }
      });
  
      // Form submit
      const form = $("todo-form");
      if (form) {
        form.addEventListener("submit", async e => {
          e.preventDefault();
          const title = $("todo-title")?.value?.trim?.() || "";
          const description = $("todo-description")?.value?.trim?.() || "";
          const priority = $("todo-priority")?.value || "medium";
  
          if (!title) {
            if (typeof showToast !== 'undefined') {
              showToast("Please enter a title", "error");
            }
            return;
          }
  
          try {
            const created = await submitNewTodo(title, description, priority);
            if (created) {
              todayTodos = [created, ...todayTodos];
              renderTodoList(todayTodos);
              hideAddTodoModal();
              if (typeof showToast !== 'undefined') {
                showToast("✓ Todo created!", "success");
              }
            }
          } catch (err) {
            console.error("submit todo error:", err);
            if (typeof showToast !== 'undefined') {
              showToast("Could not create todo", "error");
            }
          }
        });
      }
  
      // Load initial todos
      loadTodosForToday();
    });
  })();