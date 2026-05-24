/* ============================================================
   TOAST NOTIFICATION SYSTEM
   ============================================================ */

/**
 * Shows a toast notification with slide-in animation
 * @param {string} message - The message to display
 * @param {string} type - Type of toast: 'success', 'error', 'info' (default: 'success')
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
function showToast(message, type = 'success', duration = 3000) {
  // Create or get container
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Add icon based on type
  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  switch (type) {
    case 'success':
      icon.textContent = '✓';
      break;
    case 'error':
      icon.textContent = '✕';
      break;
    case 'info':
      icon.textContent = 'ℹ';
      break;
    default:
      icon.textContent = '✓';
  }

  // Add message
  const messageEl = document.createElement('span');
  messageEl.className = 'toast-message';
  messageEl.textContent = message;

  // Assemble toast
  toast.appendChild(icon);
  toast.appendChild(messageEl);

  // Add to container
  container.appendChild(toast);

  // Remove after duration
  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, duration);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { showToast };
}
