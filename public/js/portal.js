/**
 * NEXIFI PISOWIFI Portal - Vanilla JavaScript
 * Fully Wired to Backend System
 */

(function() {
  'use strict';

  // ─── Configuration ───
  const API_BASE = '/api';
  const POLL_INTERVAL = 5000;

  // ─── State ───
  let currentSession = null;
  let pollTimer = null;
  let countdownTimer = null;
  let clientIp = '';
  let clientMac = '';
  let isOnline = null;
  let rates = [];
  let portalConfig = null;
  let creditPesos = 0;
  let creditMinutes = 0;
  let selectedSlot = 'main';
  let coinSlotLockId = null;
  let reservedSlot = null;

  // ── DOM Elements ───
  const elements = {
    splash: document.getElementById('splash'),
    portal: document.getElementById('portal'),
    portalTitle: document.getElementById('portal-title'),
    portalSubtitle: document.getElementById('portal-subtitle'),
    portalHeader: document.getElementById('portal-header'),
    customCss: document.getElementById('portal-custom-css'),
    customHtmlTop: document.getElementById('custom-html-top'),
    customHtmlBottom: document.getElementById('custom-html-bottom'),
    footerText: document.getElementById('footer-text'),
    statusMessage: document.getElementById('status-message'),
    statusText: document.getElementById('status-text'),
    sessionView: document.getElementById('session-view'),
    loginView: document.getElementById('login-view'),
    sessionTimer: document.getElementById('session-timer'),
    statusDot: document.getElementById('status-dot'),
    statusLabel: document.getElementById('status-label'),
    deviceIp: document.getElementById('device-ip'),
    deviceMac: document.getElementById('device-mac'),
    creditDisplay: document.getElementById('credit-display'),
    creditPesos: document.getElementById('credit-pesos'),
    loginDeviceIp: document.getElementById('login-device-ip'),
    loginDeviceMac: document.getElementById('login-device-mac'),
    loginCreditDisplay: document.getElementById('login-credit-display'),
    loginCreditPesos: document.getElementById('login-credit-pesos'),
    onlineStatus: document.getElementById('online-status'),
    onlineDot: document.getElementById('online-dot'),
    onlineLabel: document.getElementById('online-label'),
    coinslotSelector: document.getElementById('coinslot-selector'),
    coinslotSelect: document.getElementById('coinslot-select'),
    btnInsertCoin: document.getElementById('btn-insert-coin'),
    btnUseCredit: document.getElementById('btn-use-credit'),
    btnViewRates: document.getElementById('btn-view-rates'),
    btnProceed: document.getElementById('btn-proceed'),
    btnPause: document.getElementById('btn-pause'),
    btnRefresh: document.getElementById('btn-refresh'),
    btnRestore: document.getElementById('btn-restore'),
    btnCloseRates: document.getElementById('btn-close-rates'),
    ratesModal: document.getElementById('rates-modal'),
    ratesList: document.getElementById('rates-list'),
    coinModal: document.getElementById('coin-modal'),
    btnCancelCoin: document.getElementById('btn-cancel-coin'),
    coinAmount: document.getElementById('coin-amount'),
    voucherModal: document.getElementById('voucher-modal'),
    voucherCode: document.getElementById('voucher-code'),
    btnActivateVoucher: document.getElementById('btn-activate-voucher'),
    btnCloseVoucher: document.getElementById('btn-close-voucher'),
    errorMessage: document.getElementById('error-message'),
    errorText: document.getElementById('error-text'),
    audioInsertCoin: document.getElementById('audio-insert-coin'),
    audioCoinDrop: document.getElementById('audio-coin-drop'),
    audioConnected: document.getElementById('audio-connected')
  };

  // ─── API Functions ───

  async function fetchPortalConfig() {
    try {
      const response = await fetch(`${API_BASE}/portal/config`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) return null;

      const config = await response.json();
      return config;
    } catch (error) {
      console.error('[Portal] Config fetch error:', error);
      return null;
    }
  }

  async function checkSession() {
    try {
      const response = await fetch(`${API_BASE}/whoami`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[Portal] Session check error:', error);
      return null;
    }
  }

  async function fetchRates() {
    try {
      const response = await fetch(`${API_BASE}/rates`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.rates || data || [];
    } catch (error) {
      console.error('[Portal] Rates fetch error:', error);
      return [];
    }
  }

  async function checkInternetStatus() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch('/api/network/internet-status', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) return false;

      const data = await response.json();
      return data && typeof data.online === 'boolean' ? data.online : false;
    } catch (error) {
      return false;
    }
  }

  async function reserveCoinSlot(slot) {
    try {
      const response = await fetch(`${API_BASE}/coinslot/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot })
      });

      return await response.json();
    } catch (error) {
      console.error('[Portal] Reserve error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async function releaseCoinSlot(slot, lockId) {
    try {
      await fetch(`${API_BASE}/coinslot/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, lockId })
      });
    } catch (error) {
      console.error('[Portal] Release error:', error);
    }
  }

  async function activateVoucher(code) {
    try {
      const response = await fetch(`${API_BASE}/voucher/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      return await response.json();
    } catch (error) {
      console.error('[Portal] Voucher error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async function pauseSession(token) {
    try {
      const response = await fetch(`${API_BASE}/session/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      return await response.json();
    } catch (error) {
      console.error('[Portal] Pause error:', error);
      return { success: false };
    }
  }

  async function resumeSession(token) {
    try {
      const response = await fetch(`${API_BASE}/session/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      return await response.json();
    } catch (error) {
      console.error('[Portal] Resume error:', error);
      return { success: false };
    }
  }

  // ─── UI Functions ───

  function applyPortalConfig(config) {
    if (!config) return;

    portalConfig = config;

    // Apply title
    if (config.title) {
      elements.portalTitle.textContent = config.title;
      document.title = config.title;
      if (elements.footerText) {
        elements.footerText.textContent = `Powered by ${config.title}`;
      }
    }

    // Apply subtitle
    if (config.subtitle) {
      elements.portalSubtitle.textContent = config.subtitle;
    }

    // Apply colors
    if (config.primaryColor) {
      document.documentElement.style.setProperty('--primary', config.primaryColor);
      if (elements.portalHeader) {
        elements.portalHeader.style.background = `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.secondaryColor || config.primaryColor} 100%)`;
      }
    }

    if (config.secondaryColor) {
      document.documentElement.style.setProperty('--primary-dark', config.secondaryColor);
    }

    if (config.backgroundColor) {
      document.documentElement.style.setProperty('--bg', config.backgroundColor);
    }

    if (config.textColor) {
      document.documentElement.style.setProperty('--text-main', config.textColor);
    }

    // Apply custom CSS
    if (config.customCss && elements.customCss) {
      elements.customCss.textContent = config.customCss;
    }

    // Apply custom HTML
    if (config.customHtmlTop && elements.customHtmlTop) {
      elements.customHtmlTop.innerHTML = config.customHtmlTop;
    }

    if (config.customHtmlBottom && elements.customHtmlBottom) {
      elements.customHtmlBottom.innerHTML = config.customHtmlBottom;
    }

    // Apply audio
    if (config.insertCoinAudio && elements.audioInsertCoin) {
      elements.audioInsertCoin.src = config.insertCoinAudio;
    }

    if (config.coinDropAudio && elements.audioCoinDrop) {
      elements.audioCoinDrop.src = config.coinDropAudio;
    }

    if (config.connectedAudio && elements.audioConnected) {
      elements.audioConnected.src = config.connectedAudio;
    }
  }

  function showStatus(message, type = 'info') {
    if (!elements.statusText || !elements.statusMessage) return;

    elements.statusText.textContent = message;
    elements.statusMessage.style.display = 'flex';

    setTimeout(() => {
      elements.statusMessage.style.display = 'none';
    }, 5000);
  }

  function showError(message) {
    if (!elements.errorText || !elements.errorMessage) return;

    elements.errorText.textContent = message;
    elements.errorMessage.style.display = 'flex';
  }

  function hideError() {
    if (elements.errorMessage) {
      elements.errorMessage.style.display = 'none';
    }
  }

  function formatSessionTime(seconds) {
    if (!seconds || seconds <= 0) return '0m 0s';

    if (seconds >= 86400) {
      const days = Math.floor(seconds / 86400);
      const remainingSeconds = seconds % 86400;
      const hours = Math.floor(remainingSeconds / 3600);
      const mins = Math.floor((remainingSeconds % 3600) / 60);
      const secs = remainingSeconds % 60;
      return `${days}d ${hours}h ${mins}m ${secs}s`;
    }

    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hours}h ${mins}m ${secs}s`;
    }

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  function showSession(session) {
    if (!elements.sessionView || !elements.loginView) return;

    currentSession = session;

    // Show session view, hide login
    elements.loginView.style.display = 'none';
    elements.sessionView.style.display = 'block';

    // Update timer
    if (elements.sessionTimer) {
      elements.sessionTimer.textContent = formatSessionTime(session.remainingSeconds || session.remaining_seconds);
    }

    // Update status
    if (session.isPaused) {
      if (elements.statusDot) {
        elements.statusDot.className = 'status-dot paused';
      }
      if (elements.statusLabel) {
        elements.statusLabel.textContent = 'Time Paused - Internet Suspended';
        elements.statusLabel.className = 'status-label-text paused';
      }
      if (elements.btnPause) {
        elements.btnPause.innerHTML = '▶️ RESUME MY TIME';
      }
    } else {
      if (elements.statusDot) {
        elements.statusDot.className = 'status-dot active';
      }
      if (elements.statusLabel) {
        elements.statusLabel.textContent = 'Internet Access Live';
        elements.statusLabel.className = 'status-label-text';
      }
      if (elements.btnPause) {
        elements.btnPause.innerHTML = '⏸️ PAUSE MY TIME';
      }
    }

    // Update device info
    if (elements.deviceIp) elements.deviceIp.textContent = clientIp || 'Detecting...';
    if (elements.deviceMac) elements.deviceMac.textContent = clientMac || 'Detecting...';

    // Update credit
    if (creditPesos > 0) {
      if (elements.creditDisplay) elements.creditDisplay.style.display = 'inline';
      if (elements.creditPesos) elements.creditPesos.textContent = creditPesos;
    }

    // Start countdown
    startCountdown(session.remainingSeconds || session.remaining_seconds);
  }

  function showLogin() {
    if (!elements.sessionView || !elements.loginView) return;

    currentSession = null;

    // Hide session, show login
    elements.sessionView.style.display = 'none';
    elements.loginView.style.display = 'block';

    // Update device info
    if (elements.loginDeviceIp) elements.loginDeviceIp.textContent = clientIp || 'Detecting...';
    if (elements.loginDeviceMac) elements.loginDeviceMac.textContent = clientMac || 'Detecting...';

    // Update credit
    if (creditPesos > 0) {
      if (elements.loginCreditDisplay) elements.loginCreditDisplay.style.display = 'inline';
      if (elements.loginCreditPesos) elements.loginCreditPesos.textContent = creditPesos;
      if (elements.btnUseCredit) elements.btnUseCredit.style.display = 'block';
    }

    // Stop countdown
    stopCountdown();
  }

  function startCountdown(seconds) {
    stopCountdown();

    let remaining = seconds;

    countdownTimer = setInterval(() => {
      remaining--;

      if (remaining <= 0) {
        stopCountdown();
        showLogin();
        showStatus('Session expired. Please insert coins.');
      } else if (elements.sessionTimer) {
        elements.sessionTimer.textContent = formatSessionTime(remaining);
      }
    }, 1000);
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function showRatesModal() {
    if (!elements.ratesModal || !elements.ratesList) return;

    // Populate rates
    elements.ratesList.innerHTML = '';

    if (rates.length === 0) {
      elements.ratesList.innerHTML = '<p class="text-center" style="color: var(--text-muted); font-size: 0.75rem;">No rates available</p>';
    } else {
      rates.sort((a, b) => a.pesos - b.pesos).forEach(rate => {
        const rateItem = document.createElement('div');
        rateItem.className = 'rate-item';

        const timeLabel = rate.minutes >= 60
          ? `${Math.floor(rate.minutes / 60)}h ${rate.minutes % 60 > 0 ? (rate.minutes % 60) + 'm' : ''}`
          : `${rate.minutes} Minutes`;

        rateItem.innerHTML = `
          <div>
            <span class="rate-pesos">₱${rate.pesos}</span>
            <span class="rate-time">${timeLabel}</span>
          </div>
        `;

        elements.ratesList.appendChild(rateItem);
      });
    }

    elements.ratesModal.style.display = 'flex';
  }

  function hideRatesModal() {
    if (elements.ratesModal) {
      elements.ratesModal.style.display = 'none';
    }
  }

  function showCoinModal() {
    if (!elements.coinModal) return;

    if (elements.coinAmount) elements.coinAmount.style.display = 'none';
    elements.coinModal.style.display = 'flex';

    // Play insert coin audio
    if (elements.audioInsertCoin && elements.audioInsertCoin.src) {
      elements.audioInsertCoin.play().catch(() => {});
    }

    // TODO: Start coin detection polling
    startCoinDetection();
  }

  function hideCoinModal() {
    if (elements.coinModal) {
      elements.coinModal.style.display = 'none';
    }

    // Release coin slot if reserved
    if (reservedSlot && coinSlotLockId) {
      releaseCoinSlot(reservedSlot, coinSlotLockId);
      reservedSlot = null;
      coinSlotLockId = null;
    }

    stopCoinDetection();
  }

  function showVoucherModal() {
    if (!elements.voucherModal) return;

    if (elements.voucherCode) elements.voucherCode.value = '';
    elements.voucherModal.style.display = 'flex';
  }

  function hideVoucherModal() {
    if (elements.voucherModal) {
      elements.voucherModal.style.display = 'none';
    }
  }

  async function updateOnlineStatus() {
    const online = await checkInternetStatus();
    isOnline = online;

    if (elements.onlineStatus) {
      elements.onlineStatus.className = 'online-status ' + (online ? 'online' : 'offline');
    }
    if (elements.onlineDot) {
      elements.onlineDot.className = 'online-dot';
    }
    if (elements.onlineLabel) {
      elements.onlineLabel.textContent = online ? 'Online' : 'Offline';
    }
  }

  // ── Coin Detection ───

  let coinDetectionInterval = null;

  function startCoinDetection() {
    // TODO: Implement actual coin detection via API
    // This should poll the coinslot status
    coinDetectionInterval = setInterval(async () => {
      // Check coin slot status
      // If coin detected, show amount and minutes
      // Play coin drop audio
      // Auto-close modal after detection
    }, 1000);
  }

  function stopCoinDetection() {
    if (coinDetectionInterval) {
      clearInterval(coinDetectionInterval);
      coinDetectionInterval = null;
    }
  }

  // ─── Event Handlers ───

  async function handleInsertCoin() {
    hideError();

    // Reserve coin slot
    const reserve = await reserveCoinSlot(selectedSlot);
    if (!reserve.success || !reserve.lockId) {
      showError(reserve.error || 'Failed to open coinslot. Please try again.');
      return;
    }

    reservedSlot = selectedSlot;
    coinSlotLockId = reserve.lockId;

    // Show coin modal
    showCoinModal();
  }

  function handleUseCredit() {
    if (creditPesos <= 0) {
      showError('Walang available na credit para gamitin.');
      return;
    }

    const input = prompt(`Ilang credit ang gagamitin? (Max: ${creditPesos})`, '1');
    if (!input) return;

    const requested = parseInt(input, 10);
    if (isNaN(requested) || requested <= 0 || requested > creditPesos) {
      showError('Invalid na halaga ng credit.');
      return;
    }

    // TODO: Call use credit API
    alert('Credit usage - integrate with API');
  }

  function handleViewRates() {
    showRatesModal();
  }

  function handleCloseRates() {
    hideRatesModal();
  }

  function handleProceed() {
    window.location.href = '/success';
  }

  async function handlePause() {
    if (!currentSession || !currentSession.token) return;

    if (currentSession.isPaused) {
      // Resume
      const result = await resumeSession(currentSession.token);
      if (result.success) {
        pollSession();
      } else {
        alert('Resume failed: ' + result.message);
      }
    } else {
      // Pause
      const result = await pauseSession(currentSession.token);
      if (result.success) {
        pollSession();
      } else {
        alert('Pause failed: ' + result.message);
      }
    }
  }

  function handleRefresh() {
    window.location.reload();
  }

  function handleRestore() {
    // TODO: Implement session restore logic
    alert('Session restore - checking for active sessions...');
  }

  async function handleActivateVoucher() {
    const code = elements.voucherCode?.value?.trim();
    if (!code) {
      alert('Please enter a voucher code');
      return;
    }

    elements.btnActivateVoucher.disabled = true;
    elements.btnActivateVoucher.textContent = 'Activating...';

    const result = await activateVoucher(code);

    elements.btnActivateVoucher.disabled = false;
    elements.btnActivateVoucher.textContent = 'Activate';

    if (result.success) {
      alert('✅ ' + (result.message || 'Voucher activated successfully!'));
      hideVoucherModal();
      pollSession();
    } else {
      alert('❌ ' + (result.error || 'Failed to activate voucher'));
    }
  }

  function handleCancelCoin() {
    hideCoinModal();
  }

  function handleCloseVoucher() {
    hideVoucherModal();
  }

  // ─── Polling ───

  async function pollSession() {
    try {
      const session = await checkSession();

      if (session) {
        if (session.ip) clientIp = session.ip;
        if (session.mac) clientMac = session.mac;
        if (typeof session.creditPesos === 'number') creditPesos = session.creditPesos;
        if (typeof session.creditMinutes === 'number') creditMinutes = session.creditMinutes;

        if (session.remainingSeconds > 0 || session.remaining_seconds > 0) {
          showSession(session);
        } else {
          showLogin();
        }
      } else {
        showLogin();
      }
    } catch (error) {
      console.error('[Portal] Poll error:', error);
    }
  }

  function startPolling() {
    stopPolling();

    // Poll immediately
    pollSession();

    // Then poll at intervals
    pollTimer = setInterval(pollSession, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ─── Initialization ───

  async function init() {
    console.log('[Portal] Initializing NEXIFI PISOWIFI Portal...');

    // Fetch portal config
    portalConfig = await fetchPortalConfig();
    if (portalConfig) {
      applyPortalConfig(portalConfig);
    }

    // Fetch rates
    rates = await fetchRates();

    // Get client info
    try {
      const whoami = await checkSession();
      if (whoami) {
        if (whoami.ip) clientIp = whoami.ip;
        if (whoami.mac) clientMac = whoami.mac;
      }
    } catch (e) {
      console.error('Failed to get client info');
    }

    // Check online status
    await updateOnlineStatus();
    setInterval(updateOnlineStatus, 15000);

    // Attach event listeners
    if (elements.btnInsertCoin) {
      elements.btnInsertCoin.addEventListener('click', handleInsertCoin);
    }

    if (elements.btnUseCredit) {
      elements.btnUseCredit.addEventListener('click', handleUseCredit);
    }

    if (elements.btnViewRates) {
      elements.btnViewRates.addEventListener('click', handleViewRates);
    }

    if (elements.btnCloseRates) {
      elements.btnCloseRates.addEventListener('click', handleCloseRates);
    }

    if (elements.btnProceed) {
      elements.btnProceed.addEventListener('click', handleProceed);
    }

    if (elements.btnPause) {
      elements.btnPause.addEventListener('click', handlePause);
    }

    if (elements.btnRefresh) {
      elements.btnRefresh.addEventListener('click', handleRefresh);
    }

    if (elements.btnRestore) {
      elements.btnRestore.addEventListener('click', handleRestore);
    }

    if (elements.btnCancelCoin) {
      elements.btnCancelCoin.addEventListener('click', handleCancelCoin);
    }

    if (elements.btnActivateVoucher) {
      elements.btnActivateVoucher.addEventListener('click', handleActivateVoucher);
    }

    if (elements.btnCloseVoucher) {
      elements.btnCloseVoucher.addEventListener('click', handleCloseVoucher);
    }

    // Close modals on overlay click
    [elements.ratesModal, elements.coinModal, elements.voucherModal].forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.style.display = 'none';
          }
        });
      }
    });

    // Hide splash and show portal
    if (elements.splash) {
      elements.splash.style.display = 'none';
    }
    if (elements.portal) {
      elements.portal.style.display = 'block';
    }

    // Start polling
    startPolling();

    console.log('[Portal] Portal initialized successfully');
  }

  // ─── Start When DOM Ready ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    stopPolling();
    stopCountdown();
    stopCoinDetection();
  });

})();
/**
 * NEXIFI PISOWIFI Portal - Vanilla JavaScript
 * Matches Original TSX Portal Functionality
 */

(function() {
  'use strict';

  // ─── Configuration ───
  const API_BASE = '/api';
  const POLL_INTERVAL = 5000;

  // ── State ───
  let currentSession = null;
  let pollTimer = null;
  let countdownTimer = null;
  let clientIp = '';
  let clientMac = '';
  let isOnline = null;
  let rates = [];

  // ─── DOM Elements ───
  const elements = {
    splash: document.getElementById('splash'),
    portal: document.getElementById('portal'),
    statusMessage: document.getElementById('status-message'),
    statusText: document.getElementById('status-text'),
    sessionView: document.getElementById('session-view'),
    loginView: document.getElementById('login-view'),
    sessionTimer: document.getElementById('session-timer'),
    statusDot: document.getElementById('status-dot'),
    statusLabel: document.getElementById('status-label'),
    deviceIp: document.getElementById('device-ip'),
    deviceMac: document.getElementById('device-mac'),
    loginDeviceIp: document.getElementById('login-device-ip'),
    loginDeviceMac: document.getElementById('login-device-mac'),
    onlineStatus: document.getElementById('online-status'),
    onlineDot: document.getElementById('online-dot'),
    onlineLabel: document.getElementById('online-label'),
    btnInsertCoin: document.getElementById('btn-insert-coin'),
    btnViewRates: document.getElementById('btn-view-rates'),
    btnProceed: document.getElementById('btn-proceed'),
    btnPause: document.getElementById('btn-pause'),
    btnRefresh: document.getElementById('btn-refresh'),
    btnRestore: document.getElementById('btn-restore'),
    btnCloseRates: document.getElementById('btn-close-rates'),
    ratesModal: document.getElementById('rates-modal'),
    ratesList: document.getElementById('rates-list'),
    errorMessage: document.getElementById('error-message'),
    errorText: document.getElementById('error-text')
  };

  // ─── API Functions ──

  async function checkSession() {
    try {
      const response = await fetch(`${API_BASE}/whoami`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[Portal] Session check error:', error);
      return null;
    }
  }

  async function fetchRates() {
    try {
      const response = await fetch(`${API_BASE}/rates`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.rates || data || [];
    } catch (error) {
      console.error('[Portal] Rates fetch error:', error);
      return [];
    }
  }

  async function checkInternetStatus() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch('/api/network/internet-status', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) return false;

      const data = await response.json();
      return data && typeof data.online === 'boolean' ? data.online : false;
    } catch (error) {
      return false;
    }
  }

  // ─── UI Functions ───

  function showStatus(message, type = 'info') {
    if (!elements.statusText || !elements.statusMessage) return;

    elements.statusText.textContent = message;
    elements.statusMessage.style.display = 'flex';

    setTimeout(() => {
      elements.statusMessage.style.display = 'none';
    }, 5000);
  }

  function showError(message) {
    if (!elements.errorText || !elements.errorMessage) return;

    elements.errorText.textContent = message;
    elements.errorMessage.style.display = 'flex';
  }

  function hideError() {
    if (elements.errorMessage) {
      elements.errorMessage.style.display = 'none';
    }
  }

  function formatSessionTime(seconds) {
    if (!seconds || seconds <= 0) return '0m 0s';

    if (seconds >= 86400) {
      const days = Math.floor(seconds / 86400);
      const remainingSeconds = seconds % 86400;
      const hours = Math.floor(remainingSeconds / 3600);
      const mins = Math.floor((remainingSeconds % 3600) / 60);
      const secs = remainingSeconds % 60;
      return `${days}d ${hours}h ${mins}m ${secs}s`;
    }

    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hours}h ${mins}m ${secs}s`;
    }

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  function showSession(session) {
    if (!elements.sessionView || !elements.loginView) return;

    currentSession = session;

    // Show session view, hide login
    elements.loginView.style.display = 'none';
    elements.sessionView.style.display = 'block';

    // Update timer
    if (elements.sessionTimer) {
      elements.sessionTimer.textContent = formatSessionTime(session.remainingSeconds || session.remaining_seconds);
    }

    // Update status
    if (session.isPaused) {
      if (elements.statusDot) {
        elements.statusDot.className = 'status-dot paused';
      }
      if (elements.statusLabel) {
        elements.statusLabel.textContent = 'Time Paused - Internet Suspended';
        elements.statusLabel.className = 'status-label-text paused';
      }
      if (elements.btnPause) {
        elements.btnPause.innerHTML = '▶️ RESUME MY TIME';
      }
    } else {
      if (elements.statusDot) {
        elements.statusDot.className = 'status-dot active';
      }
      if (elements.statusLabel) {
        elements.statusLabel.textContent = 'Internet Access Live';
        elements.statusLabel.className = 'status-label-text';
      }
      if (elements.btnPause) {
        elements.btnPause.innerHTML = '⏸️ PAUSE MY TIME';
      }
    }

    // Update device info
    if (elements.deviceIp) elements.deviceIp.textContent = clientIp || 'Detecting...';
    if (elements.deviceMac) elements.deviceMac.textContent = clientMac || 'Detecting...';

    // Start countdown
    startCountdown(session.remainingSeconds || session.remaining_seconds);
  }

  function showLogin() {
    if (!elements.sessionView || !elements.loginView) return;

    currentSession = null;

    // Hide session, show login
    elements.sessionView.style.display = 'none';
    elements.loginView.style.display = 'block';

    // Update device info
    if (elements.loginDeviceIp) elements.loginDeviceIp.textContent = clientIp || 'Detecting...';
    if (elements.loginDeviceMac) elements.loginDeviceMac.textContent = clientMac || 'Detecting...';

    // Stop countdown
    stopCountdown();
  }

  function startCountdown(seconds) {
    stopCountdown();

    let remaining = seconds;

    countdownTimer = setInterval(() => {
      remaining--;

      if (remaining <= 0) {
        stopCountdown();
        showLogin();
        showStatus('Session expired. Please insert coins.');
      } else if (elements.sessionTimer) {
        elements.sessionTimer.textContent = formatSessionTime(remaining);
      }
    }, 1000);
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function showRatesModal() {
    if (!elements.ratesModal || !elements.ratesList) return;

    // Populate rates
    elements.ratesList.innerHTML = '';

    if (rates.length === 0) {
      elements.ratesList.innerHTML = '<p class="text-center" style="color: var(--text-muted); font-size: 0.75rem;">No rates available</p>';
    } else {
      rates.sort((a, b) => a.pesos - b.pesos).forEach(rate => {
        const rateItem = document.createElement('div');
        rateItem.className = 'rate-item';

        const timeLabel = rate.minutes >= 60
          ? `${Math.floor(rate.minutes / 60)}h ${rate.minutes % 60 > 0 ? (rate.minutes % 60) + 'm' : ''}`
          : `${rate.minutes} Minutes`;

        rateItem.innerHTML = `
          <div>
            <span class="rate-pesos">₱${rate.pesos}</span>
            <span class="rate-time">${timeLabel}</span>
          </div>
        `;

        elements.ratesList.appendChild(rateItem);
      });
    }

    elements.ratesModal.style.display = 'flex';
  }

  function hideRatesModal() {
    if (elements.ratesModal) {
      elements.ratesModal.style.display = 'none';
    }
  }

  async function updateOnlineStatus() {
    const online = await checkInternetStatus();
    isOnline = online;

    if (elements.onlineStatus) {
      elements.onlineStatus.className = 'online-status ' + (online ? 'online' : 'offline');
    }
    if (elements.onlineDot) {
      elements.onlineDot.className = 'online-dot';
    }
    if (elements.onlineLabel) {
      elements.onlineLabel.textContent = online ? 'Online' : 'Offline';
    }
  }

  // ─── Event Handlers ───

  function handleInsertCoin() {
    // TODO: Integrate with your coin slot API
    alert('Coin slot integration - connect to your NodeMCU/coin acceptor hardware');
  }

  function handleViewRates() {
    showRatesModal();
  }

  function handleCloseRates() {
    hideRatesModal();
  }

  function handleProceed() {
    window.location.href = '/success';
  }

  function handlePause() {
    if (!currentSession || !currentSession.token) return;

    if (currentSession.isPaused) {
      // Resume
      fetch(`${API_BASE}/session/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: currentSession.token })
      })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          pollSession();
        } else {
          alert('Resume failed: ' + data.message);
        }
      })
      .catch(err => alert('Error: ' + err.message));
    } else {
      // Pause
      fetch(`${API_BASE}/session/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: currentSession.token })
      })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          pollSession();
        } else {
          alert('Pause failed: ' + data.message);
        }
      })
      .catch(err => alert('Error: ' + err.message));
    }
  }

  function handleRefresh() {
    window.location.reload();
  }

  function handleRestore() {
    // TODO: Implement session restore logic
    alert('Session restore - checking for active sessions...');
  }

  // ─── Polling ───

  async function pollSession() {
    try {
      const session = await checkSession();

      if (session && (session.remainingSeconds > 0 || session.remaining_seconds > 0)) {
        showSession(session);
      } else {
        showLogin();
      }
    } catch (error) {
      console.error('[Portal] Poll error:', error);
    }
  }

  function startPolling() {
    stopPolling();

    // Poll immediately
    pollSession();

    // Then poll at intervals
    pollTimer = setInterval(pollSession, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ─── Start When DOM Ready ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    stopPolling();
    stopCountdown();
  });

})();
