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

  // ─── Coin Modal State ───
  let socket = null;
  let coinTimeout = null;
  let coinTotal = 0;
  let coinMinutes = 0;
  let coinMode = 'internet'; // 'internet' or 'credit'
  let coinCountdownTimer = null;
  let coinCountdownSeconds = 60;
  let insertCoinAudio = null;

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
    btnActionCoin: document.getElementById('btn-action-coin'),
    btnModeInternet: document.getElementById('btn-mode-internet'),
    btnModeCredit: document.getElementById('btn-mode-credit'),
    coinModalSubtitle: document.getElementById('coin-modal-subtitle'),
    coinTotalAmount: document.getElementById('coin-total-amount'),
    coinTotalTime: document.getElementById('coin-total-time'),
    coinTimeBox: document.getElementById('coin-time-box'),
    coinCountdown: document.getElementById('coin-countdown'),
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

  async function heartbeatCoinSlot(slot, lockId) {
    try {
      await fetch(`${API_BASE}/coinslot/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, lockId })
      });
    } catch (error) {
      console.error('[Portal] Heartbeat error:', error);
    }
  }

  async function addCredit(pesos, minutes) {
    try {
      const payload = { pesos };
      if (typeof minutes === 'number') payload.minutes = minutes;
      const response = await fetch(`${API_BASE}/credits/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (error) {
      console.error('[Portal] Add credit error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async function startInternetSession(minutes, pesos, slot, lockId) {
    try {
      const response = await fetch(`${API_BASE}/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes, pesos, slot, lockId })
      });
      return await response.json();
    } catch (error) {
      console.error('[Portal] Start session error:', error);
      return { error: 'Network error' };
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

  // ── UI Functions ───

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

  function calculateMinutes(totalPesos, rateList) {
    if (!rateList || rateList.length === 0) return totalPesos * 10; // fallback

    let remainingPesos = totalPesos;
    let totalMinutes = 0;
    const sortedRates = [...rateList].sort((a, b) => b.pesos - a.pesos);

    for (const rate of sortedRates) {
      if (rate.pesos <= 0) continue;
      if (remainingPesos >= rate.pesos) {
        const times = Math.floor(remainingPesos / rate.pesos);
        totalMinutes += times * rate.minutes;
        remainingPesos -= times * rate.pesos;
      }
    }

    // Handle remainder
    if (remainingPesos > 0) {
      const smallestRate = sortedRates[sortedRates.length - 1];
      if (smallestRate && smallestRate.pesos > 0) {
        totalMinutes += Math.floor((remainingPesos / smallestRate.pesos) * smallestRate.minutes);
      } else {
        totalMinutes += remainingPesos * 10; // last resort fallback
      }
    }

    return totalMinutes;
  }

  function formatCoinTime(totalMinutes) {
    const totalSeconds = Math.floor(totalMinutes * 60);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);

    return parts.join(' ');
  }

  function updateCoinModalDisplay() {
    if (elements.coinTotalAmount) {
      elements.coinTotalAmount.textContent = `₱${coinTotal}`;
    }
    if (elements.coinTotalTime) {
      elements.coinTotalTime.textContent = formatCoinTime(coinMinutes);
    }
    if (elements.coinTimeBox) {
      elements.coinTimeBox.style.display = coinMode === 'internet' ? 'block' : 'none';
    }
    if (elements.btnActionCoin) {
      elements.btnActionCoin.innerHTML = coinMode === 'internet'
        ? '<span>🚀</span> START SURFING'
        : '<span>💰</span> CONFIRM CREDIT';
    }
    if (elements.btnModeInternet && elements.btnModeCredit) {
      elements.btnModeInternet.classList.toggle('active', coinMode === 'internet');
      elements.btnModeCredit.classList.toggle('active', coinMode === 'credit');
    }
    if (elements.coinModalSubtitle) {
      elements.coinModalSubtitle.textContent = reservedSlot === 'main' ? 'Main Machine' : 'Remote Vendo';
    }
  }

  function startCoinCountdown() {
    stopCoinCountdown();
    coinCountdownSeconds = 60;

    coinCountdownTimer = setInterval(() => {
      coinCountdownSeconds--;

      if (elements.coinCountdown) {
        elements.coinCountdown.textContent = coinTotal > 0
          ? `Confirm in ${coinCountdownSeconds}s or coins will be saved as credit`
          : `Waiting for coins... ${coinCountdownSeconds}s`;
      }

      if (coinCountdownSeconds <= 0) {
        stopCoinCountdown();
        if (coinTotal === 0) {
          closeCoinModal();
        } else {
          handleConfirmCoin();
        }
      }
    }, 1000);
  }

  function stopCoinCountdown() {
    if (coinCountdownTimer) {
      clearInterval(coinCountdownTimer);
      coinCountdownTimer = null;
    }
  }

  function stopInsertCoinAudio() {
    if (insertCoinAudio) {
      insertCoinAudio.pause();
      insertCoinAudio.currentTime = 0;
      insertCoinAudio = null;
    }
  }

  function handleCoinPulse(data) {
    const pesos = typeof data === 'object' ? (data.pesos || 0) : (data || 0);
    if (!pesos || pesos <= 0) return;

    console.log(`[COIN] Received Pulse: ₱${pesos}`);

    coinTotal += pesos;
    coinMinutes = calculateMinutes(coinTotal, rates);

    updateCoinModalDisplay();

    // Reset countdown on every coin drop
    coinCountdownSeconds = 60;

    // Play coin drop audio
    if (elements.audioCoinDrop && elements.audioCoinDrop.src) {
      const dropAudio = new Audio(elements.audioCoinDrop.src);
      dropAudio.play().catch(e => console.log('Coin drop audio play failed', e));
    }

    // Heartbeat coin slot
    if (reservedSlot && coinSlotLockId) {
      heartbeatCoinSlot(reservedSlot, coinSlotLockId);
    }
  }

  function handleNodeMCUPulse(data) {
    if (!data || data.macAddress !== selectedSlot) return;
    handleCoinPulse({ pesos: data.denomination || 0 });
  }

  function startCoinDetection() {
    // Reset state
    coinTotal = 0;
    coinMinutes = 0;
    coinMode = 'internet';
    coinCountdownSeconds = 60;
    updateCoinModalDisplay();

    // Connect Socket.IO
    try {
      socket = io();

      socket.on('connect', () => {
        console.log('[COIN] Socket Connected to Gateway');
      });

      socket.on('disconnect', () => {
        console.warn('[COIN] Socket Disconnected');
      });

      socket.on('coin-pulse', handleCoinPulse);
      socket.on('nodemcu-pulse', handleNodeMCUPulse);
    } catch (error) {
      console.error('[COIN] Socket connection error:', error);
    }

    // Start countdown
    startCoinCountdown();

    // Play insert coin audio loop
    if (portalConfig && portalConfig.insertCoinAudio) {
      try {
        insertCoinAudio = new Audio(portalConfig.insertCoinAudio);
        insertCoinAudio.loop = true;
        insertCoinAudio.volume = 0.5;
        insertCoinAudio.play().catch(e => console.log('Insert coin audio play failed', e));
      } catch (e) {
        console.error(e);
      }
    }

    // Heartbeat coin slot immediately
    if (reservedSlot && coinSlotLockId) {
      heartbeatCoinSlot(reservedSlot, coinSlotLockId);
    }
  }

  function stopCoinDetection() {
    stopCoinCountdown();
    stopInsertCoinAudio();

    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }

  function showCoinModal() {
    if (!elements.coinModal) return;

    elements.coinModal.style.display = 'flex';
    startCoinDetection();
  }

  function hideCoinModal() {
    if (elements.coinModal) {
      elements.coinModal.style.display = 'none';
    }

    stopCoinDetection();

    // Release coin slot if reserved
    if (reservedSlot && coinSlotLockId) {
      releaseCoinSlot(reservedSlot, coinSlotLockId);
      reservedSlot = null;
      coinSlotLockId = null;
    }
  }

  async function onCoinSuccess(pesos, minutes, mode) {
    if (mode === 'internet') {
      const slot = reservedSlot || selectedSlot;
      const lockId = coinSlotLockId;
      if (!slot || !lockId) {
        showError('Coinslot reservation expired. Please try again.');
        hideCoinModal();
        return;
      }

      const result = await startInternetSession(minutes, pesos, slot, lockId);

      if (result.error) {
        showError(result.error || 'Failed to start session. Please try again.');
        return;
      }

      // Release lock is handled by server on successful session start
      reservedSlot = null;
      coinSlotLockId = null;

      // Play connected audio
      if (elements.audioConnected && elements.audioConnected.src) {
        elements.audioConnected.play().catch(() => {});
      }

      hideCoinModal();
      showStatus('Session started! Enjoy your internet.');
      pollSession();
    } else {
      // Credit mode
      const result = await addCredit(pesos);

      if (result.success) {
        creditPesos += pesos;
      }

      if (reservedSlot && coinSlotLockId) {
        releaseCoinSlot(reservedSlot, coinSlotLockId);
        reservedSlot = null;
        coinSlotLockId = null;
      }

      hideCoinModal();
      showStatus(result.success ? 'Credit saved successfully!' : (result.error || 'Failed to save credit.'));
      pollSession();
    }
  }

  function setCoinMode(mode) {
    coinMode = mode;
    updateCoinModalDisplay();
  }

  async function handleConfirmCoin() {
    if (coinTotal <= 0) {
      showError('Insert coins first');
      return;
    }

    await onCoinSuccess(coinTotal, coinMinutes, coinMode);
  }

  async function handleCancelCoin() {
    if (coinTotal > 0) {
      // Auto-save as credit on cancel
      const result = await addCredit(coinTotal, coinMinutes);
      if (result.success) {
        creditPesos += coinTotal;
        creditMinutes += coinMinutes;
      }
      showStatus(result.success ? 'Coins saved as credit.' : (result.error || 'Failed to save credit.'));
    }
    hideCoinModal();
  }

  function closeCoinModal() {
    hideCoinModal();
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

  function handleCloseVoucher() {
    hideVoucherModal();
  }

  // ─── Polling ──

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

  // ── Initialization ───

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

    if (elements.btnActionCoin) {
      elements.btnActionCoin.addEventListener('click', handleConfirmCoin);
    }

    if (elements.btnModeInternet) {
      elements.btnModeInternet.addEventListener('click', () => setCoinMode('internet'));
    }

    if (elements.btnModeCredit) {
      elements.btnModeCredit.addEventListener('click', () => setCoinMode('credit'));
    }

    if (elements.btnActivateVoucher) {
      elements.btnActivateVoucher.addEventListener('click', handleActivateVoucher);
    }

    if (elements.btnCloseVoucher) {
      elements.btnCloseVoucher.addEventListener('click', handleCloseVoucher);
    }

    // Close modals on overlay click
    if (elements.ratesModal) {
      elements.ratesModal.addEventListener('click', (e) => {
        if (e.target === elements.ratesModal) hideRatesModal();
      });
    }

    if (elements.coinModal) {
      elements.coinModal.addEventListener('click', (e) => {
        if (e.target === elements.coinModal) handleCancelCoin();
      });
    }

    if (elements.voucherModal) {
      elements.voucherModal.addEventListener('click', (e) => {
        if (e.target === elements.voucherModal) hideVoucherModal();
      });
    }

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

    // Release coin slot if reserved
    if (reservedSlot && coinSlotLockId) {
      releaseCoinSlot(reservedSlot, coinSlotLockId);
    }
  });

})();
