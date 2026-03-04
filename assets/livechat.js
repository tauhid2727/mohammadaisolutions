<script>
(function () {
  // Find Flowise bubble toggle button (normal or shadow DOM)
  function findFlowiseToggleButton() {
    // Some versions render a normal button in DOM
    const direct =
      document.querySelector('[data-testid="flowise-chatbot-button"]') ||
      document.querySelector('.flowise-chatbot-button') ||
      document.querySelector('#flowise-chatbot-button') ||
      document.querySelector('button.flowise-chatbot-button');

    if (direct) return direct;

    // Shadow DOM version: <flowise-chatbot>
    const el = document.querySelector('flowise-chatbot');
    if (el && el.shadowRoot) {
      // Try common patterns inside shadow
      const shadowBtn =
        el.shadowRoot.querySelector('[data-testid="flowise-chatbot-button"]') ||
        el.shadowRoot.querySelector('button') ||
        el.shadowRoot.querySelector('[role="button"]');

      if (shadowBtn) return shadowBtn;
    }

    return null;
  }

  // Public function
  window.openLiveChat = function () {
    // If chat is already open, do nothing (prevents weird double toggles)
    const possibleWindow =
      document.querySelector('.flowise-chatbot-window') ||
      document.querySelector('flowise-chatbot');

    // Try immediately
    const btnNow = findFlowiseToggleButton();
    if (btnNow) {
      btnNow.click();
      return;
    }

    // Wait/retry up to 10 seconds
    let tries = 0;
    const maxTries = 25; // 25 * 400ms = 10s
    const t = setInterval(() => {
      tries++;
      const btn = findFlowiseToggleButton();
      if (btn) {
        clearInterval(t);
        btn.click();
      } else if (tries >= maxTries) {
        clearInterval(t);
        alert("Chat is still loading. Please wait a few seconds and try again.");
      }
    }, 400);
  };

  // Auto-wire any button/link with data-open-livechat
  document.addEventListener("click", function (e) {
    const target = e.target.closest("[data-open-livechat]");
    if (!target) return;
    e.preventDefault(); // stops navigation (fixes your “double click” issue)
    window.openLiveChat();
  });
})();
</script>
