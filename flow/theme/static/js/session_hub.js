(() => {
  "use strict";

  let currentSessionId = null;
  let timerIntervalId = null;
  let elapsedSeconds = 0;
  let localStartTimeMs = 0;
  let sessionDuration = 1500;
  let breakNotificationShown = false;
  let breakHideTimeoutId = null;
  let resetUiTimeoutId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function getCookie(name) {
    const cookies = document.cookie ? document.cookie.split(";") : [];
    for (const cookie of cookies) {
      const trimmed = cookie.trim();
      if (trimmed.startsWith(name + "=")) {
        return decodeURIComponent(trimmed.slice(name.length + 1));
      }
    }
    return null;
  }

  function formatHHMMSS(totalSeconds) {
    const s = Math.max(0, Number(totalSeconds) || 0);
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = Math.floor(s % 60);

    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  function secondsToMinutes(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    return Math.round(s / 60);
  }

  function formatRemaining(totalSeconds) {
    const s = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(s / 60);
    const seconds = Math.floor(s % 60);
    return `Time remaining: ${minutes} min ${seconds} sec`;
  }

  function setStatus(text) {
    const el = $("session-status-text");
    if (el) el.textContent = text;
  }

  function setTimer(seconds) {
    const el = $("timer-display");
    if (el) el.textContent = formatHHMMSS(seconds);
  }

  function setButtons({ isActive, isPaused }) {
    const btnStart = $("btn-start-session");
    const btnStop = $("btn-stop-session");
    const btnPause = $("btn-pause-session");
    const btnResume = $("btn-resume-session");

    if (btnStart) btnStart.hidden = (isActive || isPaused);
    if (btnStop) btnStop.hidden = !(isActive || isPaused);
    if (btnPause) btnPause.hidden = !isActive;
    if (btnResume) btnResume.hidden = !isPaused;

    const presetBtns = document.querySelectorAll(".preset-btn");
    presetBtns.forEach(btn => btn.disabled = (isActive || isPaused));
  }

  function setActiveSessionDataset({ sessionId, status, startTime }) {
    const el = $("active-session");
    if (!el) return;
    el.dataset.sessionId = sessionId ? String(sessionId) : "";
    el.dataset.sessionStatus = status ? String(status) : "";
    el.dataset.startTime = startTime ? String(startTime) : "";
  }

  function stopTimer() {
    if (timerIntervalId !== null) {
      window.clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
  }

  function playZenChime() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playTone = (freq, duration, vol=1) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
      };
      
      // Glass bell harmonics
      playTone(523.25, 2, 0.5); // C5
      playTone(1046.50, 2, 0.3); // C6
      playTone(1569.75, 2, 0.2); // G6
    } catch(e) {
      console.warn("Web Audio API not supported for Zen Chime");
    }
  }

  function hideBreakNotification() {
    const el = $("break-notification");
    if (!el) return;
    el.hidden = true;
    el.style.display = "none";
  }

  function showBreakNotification() {
    const el = $("break-notification");
    if (!el) return;

    if (breakHideTimeoutId !== null) {
      window.clearTimeout(breakHideTimeoutId);
      breakHideTimeoutId = null;
    }

    el.hidden = false;
    el.style.display = "block";

    breakHideTimeoutId = window.setTimeout(() => {
      hideBreakNotification();
      breakHideTimeoutId = null;
    }, 5000);
  }

  function checkBreakTime() {
    if (breakNotificationShown) return;
    if (elapsedSeconds >= 1500) {
      breakNotificationShown = true;
      playZenChime();
      showBreakNotification();
    }
  }

  function checkSessionComplete() {
    const remaining = sessionDuration - elapsedSeconds;
    if (remaining > 0) {
      setStatus(formatRemaining(remaining));
    } else {
      stopTimer();
      playZenChime();
      stopSession();
    }
  }

  function startTimer() {
    stopTimer();
    checkSessionComplete();
    
    if (!localStartTimeMs) {
      localStartTimeMs = Date.now() - (elapsedSeconds * 1000);
    }

    timerIntervalId = window.setInterval(() => {
      elapsedSeconds = Math.floor((Date.now() - localStartTimeMs) / 1000);
      setTimer(elapsedSeconds);
      checkSessionComplete();
      checkBreakTime();
    }, 1000);
  }

  function resetSessionUI() {
    stopTimer();
    currentSessionId = null;
    elapsedSeconds = 0;
    localStartTimeMs = 0;
    breakNotificationShown = false;
    hideBreakNotification();
    hideRatingModal();
    setActiveSessionDataset({ sessionId: null, status: "", startTime: "" });
    setButtons({ isActive: false, isPaused: false });
    setTimer(0);
    setStatus("No active session");
  }

  function handleAuthRequired() {
    setStatus("Authentication required. Please sign in.");
    console.warn("Authentication required (401).");
  }

  async function apiFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    const method = (options.method || "GET").toUpperCase();

    if (method !== "GET") {
      headers.set("Content-Type", "application/json");
      const csrf = getCookie("csrftoken");
      if (csrf) headers.set("X-CSRFToken", csrf);
    }

    const resp = await fetch(url, {
      credentials: "same-origin",
      ...options,
      method,
      headers,
    });

    let payload = null;
    try {
      payload = await resp.json();
    } catch {
      payload = null;
    }

    return { resp, payload };
  }

  async function startSession() {
    try {
      if (resetUiTimeoutId !== null) {
        window.clearTimeout(resetUiTimeoutId);
        resetUiTimeoutId = null;
      }
      breakNotificationShown = false;
      hideBreakNotification();
      hideRatingModal();

      const { resp, payload } = await apiFetch("/api/session/start/", {
        method: "POST",
        body: JSON.stringify({ target_duration: sessionDuration }),
      });

      if (resp.status === 401) {
        handleAuthRequired();
        return;
      }

      if (!resp.ok) {
        console.error("Failed to start session:", resp.status, payload);
        setStatus("Could not start session.");
        return;
      }

      currentSessionId = payload?.session_id ?? null;
      // Confirm the server accepted our target (fallback to local value).
      sessionDuration = Number(payload?.target_duration) || sessionDuration;
      elapsedSeconds = 0;
      localStartTimeMs = Date.now();

      setActiveSessionDataset({
        sessionId: currentSessionId,
        status: payload?.status ?? "active",
        startTime: payload?.start_time ?? "",
      });

      setButtons({ isActive: true, isPaused: false });
      setStatus("Session active");
      setTimer(elapsedSeconds);
      startTimer();
    } catch (err) {
      console.error("Start session error:", err);
      setStatus("Network error starting session.");
    }
  }

  async function stopSession() {
    if (!currentSessionId) {
      setStatus("No active session to stop.");
      return;
    }

    try {
      if (resetUiTimeoutId !== null) {
        window.clearTimeout(resetUiTimeoutId);
        resetUiTimeoutId = null;
      }

      const { resp, payload } = await apiFetch(`/api/session/stop/${currentSessionId}/`, {
        method: "POST",
        body: JSON.stringify({ session_id: currentSessionId }),
      });

      if (resp.status === 401) {
        handleAuthRequired();
        return;
      }

      if (!resp.ok) {
        console.error("Failed to stop session:", resp.status, payload);
        setStatus("Could not stop session.");
        return;
      }

      stopTimer();

      const duration = payload?.duration ?? elapsedSeconds;
      elapsedSeconds = Number(duration) || 0;
      setTimer(elapsedSeconds);

      setActiveSessionDataset({
        sessionId: currentSessionId,
        status: payload?.status ?? "completed",
        startTime: "",
      });

      const minutes = secondsToMinutes(elapsedSeconds);
      setStatus(`Session completed: ${minutes} minutes. Great work!`);
      setButtons({ isActive: false, isPaused: false });

      showRatingModal(currentSessionId);
      load7DayHistory(); // Refresh history and stats after session ends
    } catch (err) {
      console.error("Stop session error:", err);
      setStatus("Network error stopping session.");
    }
  }

  function showRatingModal(sessionId) {
    const modal = $("rating-modal");
    if (!modal) return;
    
    modal.dataset.sessionId = sessionId;
    modal.style.display = "block";
    
    const statusEl = $("rating-status")
    if (statusEl) statusEl.textContent = "";
    document.querySelectorAll("#rating-stars span").forEach(star => {
      star.style.color = "var(--muted)";
    });
  }

  function hideRatingModal() {
    const modal = $("rating-modal");
    if (modal) modal.style.display = "none";
  }

  async function submitRating(rating) {
    const modal = $("rating-modal");
    if (!modal) return;
    const sessionId = modal.dataset.sessionId;
    if (!sessionId) return;
    
    const statusEl = $("rating-status");

    try {
      if (statusEl) statusEl.textContent = "Saving...";
      const { resp, payload } = await apiFetch(`/api/session/rate/${sessionId}/`, {
        method: "POST",
        body: JSON.stringify({ rating }),
      });

      if (resp.ok) {
        if (statusEl) statusEl.textContent = "Saved! Thanks.";
        setTimeout(() => {
          hideRatingModal();
          resetSessionUI();
        }, 1500);
      } else {
        if (statusEl) statusEl.textContent = "Failed to save.";
      }
    } catch (err) {
      console.error("Rating submission error:", err);
      if (statusEl) statusEl.textContent = "Error saving rating.";
    }
  }

  function setupRatingUI() {
    const stars = document.querySelectorAll("#rating-stars span");
    stars.forEach(star => {
      star.addEventListener("click", (e) => {
        const rating = parseInt(e.target.dataset.value);
        stars.forEach(s => {
          if (parseInt(s.dataset.value) <= rating) {
            s.style.color = "gold";
          } else {
            s.style.color = "var(--muted)";
          }
        });
        submitRating(rating);
      });
      
      star.addEventListener("mouseenter", (e) => {
        const rating = parseInt(e.target.dataset.value);
        stars.forEach(s => {
          if (parseInt(s.dataset.value) <= rating) {
            s.style.color = "gold";
          }
        });
      });
    });
  }

  function createProgressRing(percentage) {
    const p = Math.min(Math.max(percentage, 0), 100);
    return `
      <svg viewBox="0 0 36 36" class="circular-chart accent-ring">
        <path class="circle-bg"
          d="M18 2.0845
            a 15.9155 15.9155 0 0 1 0 31.831
            a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <path class="circle"
          stroke-dasharray="${p}, 100"
          d="M18 2.0845
            a 15.9155 15.9155 0 0 1 0 31.831
            a 15.9155 15.9155 0 0 1 0 -31.831"
        />
      </svg>
    `;
  }

  function createDayCard({ date, total_focus_time, circular_progress }) {
    const article = document.createElement("article");
    article.className = "day-card";
    article.setAttribute("role", "listitem");
    article.dataset.date = date;
    article.dataset.totalFocusSeconds = String(total_focus_time ?? 0);
    article.dataset.circularProgress = String(circular_progress ?? 0);

    const minutes = secondsToMinutes(total_focus_time);
    const dailyGoalMinutes = 120;
    const progressPercent = Math.min((minutes / dailyGoalMinutes) * 100, 100);

    article.innerHTML = `
      <header class="day-card-header">
        <h3 class="day-card-date"></h3>
      </header>
      <div class="day-card-body">
        <p class="day-card-focus">
          Focus: <span class="focus-minutes"></span> min
        </p>
        <div class="progress-ring" aria-hidden="true">
          ${createProgressRing(progressPercent)}
        </div>
      </div>
    `;

    const dateEl = article.querySelector(".day-card-date");
    const minEl = article.querySelector(".focus-minutes");
    if (dateEl) dateEl.textContent = date;
    if (minEl) minEl.textContent = String(minutes);

    return article;
  }

  function updateStatsDisplay(days) {
    if (!Array.isArray(days)) return;

    let weeklyTotalMinutes = 0;
    let daysFocusedCount = 0;
    let bestDayMinutes = 0;
    let bestDayDate = "-";

    for (const day of days) {
      const mins = secondsToMinutes(day.total_focus_time);
      weeklyTotalMinutes += mins;
      if (mins > 0) daysFocusedCount += 1;
      if (mins > bestDayMinutes) {
        bestDayMinutes = mins;
        bestDayDate = day.date;
      }
    }

    let todayMinutes = 0;
    if (days.length > 0) {
      const todayStr = new Date().toISOString().split("T")[0];
      const todayObj = days.find(d => d.date === todayStr);
      if (todayObj) {
        todayMinutes = secondsToMinutes(todayObj.total_focus_time);
      } else {
        todayMinutes = secondsToMinutes(days[days.length - 1].total_focus_time);
      }
    }

    const elToday = $("stat-today-focus");
    const elDays = $("stat-days-focused");
    const elTotal = $("stat-weekly-total");
    const elBest = $("stat-best-day");

    if (elToday) elToday.textContent = `${todayMinutes} min`;
    if (elDays) elDays.textContent = `${daysFocusedCount}`;
    if (elTotal) elTotal.textContent = `${weeklyTotalMinutes} min`;
    if (elBest) elBest.textContent = bestDayDate === "-" ? "-" : `${bestDayDate} (${bestDayMinutes}m)`;
  }

  async function load7DayHistory() {
    const container = $("history-carousel");
    if (!container) return;

    try {
      const { resp, payload } = await apiFetch("/api/history/7days/", {
        method: "GET",
      });

      if (resp.status === 401) {
        handleAuthRequired();
        return;
      }

      if (!resp.ok) {
        console.error("Failed to load history:", resp.status, payload);
        return;
      }

      const days = Array.isArray(payload?.data) ? payload.data : [];

      container.innerHTML = "";
      for (const day of days) {
        container.appendChild(createDayCard(day));
      }
      
      updateStatsDisplay(days);
    } catch (err) {
      console.error("History fetch error:", err);
    }
  }

  function setSessionDuration(seconds) {
    if (currentSessionId) return;
    sessionDuration = Number(seconds) || 1500;
    const minutes = Math.round(sessionDuration / 60);
    const el = $("selected-duration-text");
    if (el) el.textContent = `Selected: ${minutes} min`;
  }

  async function checkActiveSession() {
    try {
      const { resp, payload } = await apiFetch("/api/session/current/");
      if (resp.ok && payload && payload.active) {
        currentSessionId = payload.session_id;
        elapsedSeconds = payload.elapsed_seconds;
        const isPaused = payload.status === "paused";

        // 🔑 Recover the real target from the DB — this fixes the "stuck at 25m" bug.
        if (payload.target_duration) {
          sessionDuration = Number(payload.target_duration);
        }

        // Update the "Selected: X min" label to reflect the recovered goal.
        const durationLabel = $("selected-duration-text");
        if (durationLabel) {
          const minutes = Math.round(sessionDuration / 60);
          durationLabel.textContent = `Selected: ${minutes} min`;
        }

        // ⏱ Anchor the local clock relative to how much time has already passed
        // (server-reported elapsed). This prevents the 490-minute jump bug.
        localStartTimeMs = Date.now() - (elapsedSeconds * 1000);

        setActiveSessionDataset({
          sessionId: currentSessionId,
          status: payload.status,
          startTime: payload.start_time || "",
        });

        setButtons({ isActive: !isPaused, isPaused: isPaused });

        if (isPaused) {
          setStatus("Session paused");
          setTimer(elapsedSeconds);
        } else {
          setStatus("Session active");
          setTimer(elapsedSeconds);
          startTimer();
        }
      }
    } catch (err) {
      console.error("Error checking active session:", err);
    }
  }

  async function pauseSession() {
    if (!currentSessionId) return;

    try {
      const { resp, payload } = await apiFetch(`/api/session/pause/${currentSessionId}/`, {
        method: "POST",
      });

      if (resp.status === 401) {
        handleAuthRequired();
        return;
      }

      if (resp.ok) {
        stopTimer();
        elapsedSeconds = payload.duration;
        setTimer(elapsedSeconds);
        setStatus("Session paused");
        setButtons({ isActive: false, isPaused: true });
      } else {
        console.error("Failed to pause session:", payload);
      }
    } catch (err) {
      console.error("Pause session error:", err);
    }
  }

  async function resumeSession() {
    if (!currentSessionId) return;

    try {
      const { resp, payload } = await apiFetch(`/api/session/resume/${currentSessionId}/`, {
        method: "POST",
      });

      if (resp.status === 401) {
        handleAuthRequired();
        return;
      }

      if (resp.ok) {
        elapsedSeconds = payload.duration || elapsedSeconds;
        localStartTimeMs = Date.now() - (elapsedSeconds * 1000);
        setStatus("Session active");
        setButtons({ isActive: true, isPaused: false });
        startTimer();
      } else {
        console.error("Failed to resume session:", payload);
      }
    } catch (err) {
      console.error("Resume session error:", err);
    }
  }

  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Ignore if user is typing in an input or textarea
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        
        const btnStartHidden = $("btn-start-session")?.hidden;
        const btnPauseHidden = $("btn-pause-session")?.hidden;
        const btnResumeHidden = $("btn-resume-session")?.hidden;
        
        if (!btnStartHidden) {
          startSession();
        } else if (!btnPauseHidden) {
          pauseSession();
        } else if (!btnResumeHidden) {
          resumeSession();
        }
      } else if (e.code === "Escape") {
        const modal = $("rating-modal");
        if (modal && modal.style.display !== "none") {
          hideRatingModal();
          resetSessionUI();
          load7DayHistory();
        }
      }
    });
  }

  function bindUI() {
    const btnStart = $("btn-start-session");
    const btnStop = $("btn-stop-session");
    const btnPause = $("btn-pause-session");
    const btnResume = $("btn-resume-session");

    if (btnStart) btnStart.addEventListener("click", startSession);
    if (btnStop) btnStop.addEventListener("click", stopSession);
    if (btnPause) btnPause.addEventListener("click", pauseSession);
    if (btnResume) btnResume.addEventListener("click", resumeSession);

    const presetBtns = document.querySelectorAll(".preset-btn");
    presetBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        if (!currentSessionId) {
          const duration = e.target.dataset.duration;
          setSessionDuration(duration);
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindUI();
    setupRatingUI();
    setupKeyboardShortcuts();
    // Set a default; checkActiveSession() below will override this
    // with the real DB value if a session is already running.
    setSessionDuration(1500);
    setButtons({ isActive: false, isPaused: false });
    setTimer(0);
    hideBreakNotification();
    load7DayHistory();
    // Must be LAST: overrides the 1500 default when a session is recovered.
    checkActiveSession();
  });
})();
