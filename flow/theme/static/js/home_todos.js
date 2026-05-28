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
      const method = (options.method || "GET").toUpperCase();
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

    async function submitNewTodo(e) {
      e.preventDefault();

      const titleInput = $("todo-title");
      const title = titleInput?.value?.trim() || "";
      if (!title) return;

      // Get priority from radio buttons
      const urgency = document.querySelector('input[name="urgency"]:checked')?.value || "Not Urgent";
      const importance = document.querySelector('input[name="importance"]:checked')?.value || "Not Important";
      const priority = `${urgency} & ${importance}`;

      const body = { text: title, priority: priority };
      const { resp, payload } = await apiFetch("/api/todos/create/", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        throw new Error(payload?.message || payload?.error || "create_failed");
      }

      return payload;
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
            No todos yet. Add one to get started!
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
            ${todo.is_completed ? '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
          </div>
          <div class="todo-content">
            <div class="todo-title ${todo.is_completed ? 'completed' : ''}">${escapeHtml(todo.text || '')}</div>
            ${todo.priority ? `<span class="todo-priority">${escapeHtml(todo.priority)}</span>` : ''}
          </div>
          <button class="todo-delete" data-todo-id="${todo.id}" type="button" aria-label="Delete todo">Delete</button>
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
        const { resp, payload } = await apiFetch(`/api/todos/${todoId}/update/`, {
          method: "PATCH",
          body: JSON.stringify({ is_completed: !oldState }),
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
        todo.is_completed = payload?.is_completed ?? todo.is_completed;
        renderTodoList(todayTodos);

        if (typeof showToast !== 'undefined') {
          showToast(todo.is_completed ? "Todo completed!" : "Todo reopened", "success");
        }
      } catch (err) {
        console.error("toggle error:", err);
        // Rollback
        todo.is_completed = oldState;
        renderTodoList(todayTodos);
      }
    }

    async function deleteTodo(todoId) {
      // Optimistic UI - no confirmation dialog
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

    function updateTodoStats() {
      const total = todayTodos.length;
      const completed = todayTodos.filter(t => t.is_completed).length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      const progressText = $("todo-progress-text");
      const progressPercent = $("todo-progress-percent");
      const progressFill = $("todo-progress-fill");

      if (total === 0) {
        // Explicitly handle empty state to overwrite hardcoded placeholders
        if (progressText) {
          progressText.textContent = "0 of 0 goals completed";
        }
        if (progressPercent) {
          progressPercent.textContent = "0%";
        }
        if (progressFill) {
          progressFill.style.width = "0%";
        }
      } else {
        if (progressText) {
          progressText.textContent = `${completed} of ${total} goals completed`;
        }
        if (progressPercent) {
          progressPercent.textContent = `${percentage}%`;
        }
        if (progressFill) {
          progressFill.style.width = `${percentage}%`;
        }
      }
    }

    /* ══════════════════════════════════════════════════
       TODO API - Load todos
    ═════════════════════════════════════════════════════ */

    async function loadTodos() {
      try {
        const { resp, payload } = await apiFetch("/api/todos/");
        // Unconditionally render even if data is empty array
        if (resp.ok) {
          todayTodos = payload?.data || [];
          renderTodoList(todayTodos);
        }
      } catch (err) {
        console.error("Failed to load todos:", err);
      }
    }

    /* ══════════════════════════════════════════════════
       INITIALIZATION
    ═════════════════════════════════════════════════════ */

    function init() {
      // Load todos on page load
      loadTodos();

      // Set up form submission
      const form = $("todo-form");
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          try {
            const newTodo = await submitNewTodo(e);
            if (newTodo) {
              // Push the actual task object with properties (id, text, is_completed, priority)
              todayTodos.push(newTodo);
              renderTodoList(todayTodos);
              hideAddTodoModal();
              if (typeof showToast !== 'undefined') {
                showToast("Goal added successfully!", "success");
              }
            }
          } catch (err) {
            console.error("Failed to create todo:", err);
            if (typeof showToast !== 'undefined') {
              showToast("Failed to add goal", "error");
            }
          }
        });
      }

      // Set up add button
      const addBtn = $("btn-add-todo");
      if (addBtn) {
        addBtn.addEventListener("click", showAddTodoModal);
      }
    }

    // Run initialization when DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }

})();
