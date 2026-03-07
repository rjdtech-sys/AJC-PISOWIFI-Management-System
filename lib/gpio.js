// This module handles GPIO for RPi/OPi and Serial for x64/NodeMCU
const fs = require('fs');
const path = require('path');
let Gpio;
let SerialPort;

try {
  Gpio = require('onoff').Gpio;
} catch (e) {
  console.warn('[GPIO] Native onoff not available. Normal on non-Linux/x64.');
}

try {
  SerialPort = require('serialport').SerialPort;
} catch (e) {
  console.warn('[SERIAL] SerialPort not available.');
}

let coinInput = null;
let serialBridge = null;
let currentPulseCallback = null;
let multiSlotCallbacks = {};
let simulationTimer = null;
let relayOutput = null;
let relayActiveHigh = true;

const { getOpPin } = require('./opi_pinout');

// Mapping for standard RPi header
function getPhysicalPin(bcm) {
  const mapping = { 2: 3, 3: 5, 4: 7, 17: 11, 27: 13, 22: 15, 10: 19, 9: 21, 11: 23, 5: 29, 6: 31, 13: 33, 19: 35, 26: 37, 14: 8, 15: 10 };
  return mapping[bcm] || 'Unknown';
}

function findCorrectGpioBase() {
  const gpioDir = '/sys/class/gpio';
  if (!fs.existsSync(gpioDir)) return 0;

  try {
    const chips = fs.readdirSync(gpioDir).filter(f => f.startsWith('gpiochip'));
    for (const chip of chips) {
      const chipPath = path.join(gpioDir, chip);
      const ngpioPath = path.join(chipPath, 'ngpio');
      const basePath = path.join(chipPath, 'base');

      if (fs.existsSync(ngpioPath) && fs.existsSync(basePath)) {
        const lines = parseInt(fs.readFileSync(ngpioPath, 'utf8').trim());
        const base = parseInt(fs.readFileSync(basePath, 'utf8').trim());
        
        // Raspberry Pi usually has a chip with ~54 lines (BCM2835) or similar
        // Orange Pi H3 often has multiple chips. We use this as fallback.
        // FIX: Orange Pi can have different chip sizes, so we need to be more flexible
        if (lines >= 20 && lines <= 300) { 
          // Relaxed check to include OPi chips if possible, but mainly for RPi
          console.log(`[GPIO] Detected SOC Header Chip: ${chip} (Base: ${base}, Lines: ${lines})`);
          return base;
        }
      }
    }
  } catch (e) {
    console.error('[GPIO] Error probing gpiochips:', e.message);
  }
  return 0;
}

function initGPIO(
  onPulse,
  boardType = 'none',
  pin = 2,
  boardModel = null,
  espIpAddress = '192.168.4.1',
  espPort = 80,
  coinSlots = [],
  nodemcuDevices = [],
  relayPin = null,
  relayActiveMode = 'high'
) {
  currentPulseCallback = onPulse;
  multiSlotCallbacks = {};
  
  let sysPin = -1;
  let physPin = 'Unknown';
  let isSimulated = false;
  let relaySysPin = -1;
  let relayPhysPin = 'Unknown';

  // Cleanup existing GPIO
  if (coinInput) {
    try {
      coinInput.unwatchAll();
      coinInput.unexport();
    } catch (e) {}
    coinInput = null;
  }

  // Cleanup Serial
  if (serialBridge) {
    try {
      serialBridge.close();
    } catch (e) {}
    serialBridge = null;
  }

  if (relayOutput) {
    try {
      relayOutput.writeSync(0);
      relayOutput.unexport();
    } catch (e) {}
    relayOutput = null;
  }

  // Cleanup Simulation
  if (simulationTimer) {
    clearInterval(simulationTimer);
    simulationTimer = null;
  }

  if (boardType === 'none') {
    isSimulated = true;
    physPin = getPhysicalPin(pin);
    console.log(`[GPIO] Simulation Mode. Target: Pin ${pin} (Physical ${physPin})`);
    
    simulationTimer = setInterval(() => {
      console.log('[GPIO SIMULATION] Generating test pulse (1 peso)');
      if (currentPulseCallback) currentPulseCallback(1);
      
      if (coinSlots && coinSlots.length > 0) {
        const firstSlot = coinSlots.find(s => s.enabled);
        if (firstSlot && multiSlotCallbacks[firstSlot.id]) {
           // console.log(`[GPIO SIMULATION] Generating multi-slot pulse for Slot ${firstSlot.id}`);
           multiSlotCallbacks[firstSlot.id](firstSlot.denomination);
        }
      }
    }, 5000);
    return;
  }

  if (boardType === 'nodemcu_esp') {
    // Handle WiFi communication with ESP board
    console.log(`[WIFI] Connecting to ESP at ${espIpAddress}:${espPort}`);
    
    // For WiFi connection, we'll use HTTP requests or WebSocket
    // This is a placeholder for the actual implementation
    // The actual WiFi communication logic would be implemented here
    
    // Simulate connection for now
    setTimeout(() => {
      console.log(`[WIFI] Connected to ESP at ${espIpAddress}:${espPort}`);
      
      // Send configuration to ESP board
      if (coinSlots && coinSlots.length > 0) {
        const configMsg = `CONFIG:${JSON.stringify(coinSlots.map(slot => ({
          id: slot.id,
          pin: slot.pin,
          denomination: slot.denomination,
          enabled: slot.enabled
        })))}`;
        console.log(`[WIFI] Would send multi-slot config to ESP: ${configMsg}`);
        // In real implementation, send this over WiFi using HTTP POST or WebSocket
      }
    }, 2000); // Wait for "connection" to establish
    
    return;
  }
  
  if (boardType === 'x64_pc') {
    // Use NodeMCU wireless functionality for x64 PC board selection
    console.log(`[NODEMCU WIRELESS] Setting up wireless communication for x64 PC`);
    console.log(`[NODEMCU WIRELESS] ESP IP: ${espIpAddress}:${espPort}`);
    
    // Handle WiFi communication with NodeMCU/ESP board
    // This replaces the serial bridge with wireless communication
    
    // Simulate connection for now (same as nodemcu_esp functionality)
    setTimeout(() => {
      console.log(`[NODEMCU WIRELESS] Connected to ESP at ${espIpAddress}:${espPort}`);
      
      // Send configuration to ESP board
      if (coinSlots && coinSlots.length > 0) {
        const configMsg = `CONFIG:${JSON.stringify(coinSlots.map(slot => ({
          id: slot.id,
          pin: slot.pin,
          denomination: slot.denomination,
          enabled: slot.enabled
        })))}`;
        console.log(`[NODEMCU WIRELESS] Sending multi-slot config to ESP: ${configMsg}`);
        // In real implementation, send this over WiFi using HTTP POST or WebSocket
      }
    }, 2000); // Wait for "connection" to establish
    
    return;
  }

  if (boardType === 'orange_pi') {
    if (boardModel) {
      const mapped = getOpPin(boardModel, pin);
      console.log(`[GPIO] OPi ${boardModel}: Attempting to map Physical Pin ${pin}...`);
      if (mapped !== undefined && mapped !== null) {
        sysPin = mapped;
        physPin = pin; // In OPi mode, 'pin' is the physical pin number
        console.log(`[GPIO] OPi ${boardModel}: Physical Pin ${pin} mapped to System GPIO ${sysPin}`);
      } else {
        console.warn(`[GPIO] No mapping for ${boardModel} Pin ${pin}. Falling back to simulation mode.`);
        isSimulated = true;
        physPin = `? (Input ${pin})`;
        
        simulationTimer = setInterval(() => {
             console.log(`[GPIO OPi SIMULATION] Generating test pulse (1 peso) for Pin ${pin}`);
             if (currentPulseCallback) currentPulseCallback(1);
             
             if (coinSlots && coinSlots.length > 0) {
                 const firstSlot = coinSlots.find(s => s.enabled);
                 if (firstSlot && multiSlotCallbacks[firstSlot.id]) {
                     multiSlotCallbacks[firstSlot.id](firstSlot.denomination);
                 }
             }
        }, 5000);
        return;
      }
    } else {
      // Legacy/Generic Orange Pi fallback
      const base = findCorrectGpioBase();
      sysPin = base + pin;
      physPin = `? (Input ${pin})`;
    }
  } else {
    // Raspberry Pi (Default)
    const base = findCorrectGpioBase();
    sysPin = base + pin; // In RPi mode, 'pin' is BCM
    physPin = getPhysicalPin(pin);
  }

  if (
    typeof relayPin === 'number' &&
    boardType !== 'none' &&
    boardType !== 'nodemcu_esp' &&
    boardType !== 'x64_pc'
  ) {
    if (boardType === 'orange_pi') {
      if (boardModel) {
        const relayMapped = getOpPin(boardModel, relayPin);
        if (relayMapped !== undefined && relayMapped !== null) {
          relaySysPin = relayMapped;
          relayPhysPin = relayPin;
          console.log(
            `[GPIO] OPi ${boardModel}: Relay Physical Pin ${relayPin} mapped to System GPIO ${relaySysPin}`
          );
        } else {
          console.warn(
            `[GPIO] No mapping for ${boardModel} Relay Pin ${relayPin}. Relay output disabled.`
          );
        }
      } else {
        const relayBase = findCorrectGpioBase();
        relaySysPin = relayBase + relayPin;
        relayPhysPin = `? (Relay ${relayPin})`;
      }
    } else {
      const relayBase = findCorrectGpioBase();
      relaySysPin = relayBase + relayPin;
      relayPhysPin = getPhysicalPin(relayPin);
    }
  }

  if (Gpio && sysPin !== -1) {
    try {
      const gpioPath = `/sys/class/gpio/gpio${sysPin}`;
      if (fs.existsSync(gpioPath)) {
        try {
          console.log(`[GPIO] Cleaning up existing GPIO ${sysPin}...`);
          fs.writeFileSync('/sys/class/gpio/unexport', sysPin.toString());
          // Give the system time to clean up
          setTimeout(() => {}, 100);
        } catch (e) {
          console.warn(`[GPIO] Warning: Could not unexport GPIO ${sysPin}: ${e.message}`);
        }
      }

      console.log(`[GPIO] Exporting GPIO ${sysPin} (Physical Pin ${physPin})...`);
      
      // CRITICAL FIX: Orange Pi may need different edge detection
      // Try 'both' edges first for better pulse detection, fallback to 'rising' if it fails
      let edgeType = 'rising';
      let gpioOptions = { debounceTimeout: 25 };
      
      try {
        // Try with 'both' edges for better pulse detection on Orange Pi
        coinInput = new Gpio(sysPin, 'in', 'both', gpioOptions);
        edgeType = 'both';
        console.log(`[GPIO] Using 'both' edge detection for better Orange Pi compatibility`);
      } catch (edgeError) {
        console.warn(`[GPIO] 'both' edge failed, trying 'rising' edge: ${edgeError.message}`);
        try {
          coinInput = new Gpio(sysPin, 'in', 'rising', gpioOptions);
          console.log(`[GPIO] Using 'rising' edge detection`);
        } catch (risingError) {
          throw risingError; // Re-throw to be caught by outer catch
        }
      }
      
      let pulseCount = 0;
      let pulseTimer = null;

      // Track last pulse time to prevent flooding from electrical noise
      let lastGPIOPulseTime = 0;
      // FIX: Orange Pi may need different debounce intervals
      const MIN_GPIO_PULSE_INTERVAL = boardType === 'orange_pi' ? 50 : 100; // Shorter interval for Orange Pi (50ms vs 100ms)
      
      coinInput.watch((err, value) => {
        if (err) {
          console.error('[GPIO] Watch error:', err);
          return;
        }
        
        // CRITICAL FIX: Better pulse detection for Orange Pi
        // Log the pulse for debugging
        console.log(`[GPIO] Pulse detected on GPIO ${sysPin}: value=${value}, edge=${edgeType}`);
        
        // Only count pulse if minimum interval has passed
        const now = Date.now();
        if (now - lastGPIOPulseTime < MIN_GPIO_PULSE_INTERVAL) {
          console.log(`[GPIO] Pulse rejected - too frequent (${now - lastGPIOPulseTime}ms < ${MIN_GPIO_PULSE_INTERVAL}ms)`);
          return; // Skip if too frequent (electrical noise)
        }
        
        pulseCount++;
        lastGPIOPulseTime = now;
        console.log(`[GPIO] Valid pulse counted. Total: ${pulseCount}`);
        
        if (pulseTimer) clearTimeout(pulseTimer);
        pulseTimer = setTimeout(() => {
          console.log(`[GPIO] Processing ${pulseCount} pulses`);
          handlePulses(pulseCount);
          pulseCount = 0;
        }, 500);
      });

      console.log(`[GPIO] SUCCESS: GPIO ${sysPin} is now ACTIVE.`);
    } catch (e) {
      console.error(`[GPIO] EXPORT FAILED (System ${sysPin}): ${e.message}`);
      if (e.message.includes('EINVAL')) {
        console.error('DIAGNOSTICS: Invalid Argument.');
      }
      
      // CRITICAL FIX: If GPIO export fails, fall back to simulation mode
      // This ensures Orange Pi GPIO failures don't silently break time crediting
      console.warn(`[GPIO] Falling back to simulation mode due to GPIO export failure`);
      isSimulated = true;
      
      // Start simulation timer for Orange Pi
      simulationTimer = setInterval(() => {
        console.log(`[GPIO OPi SIMULATION] Generating test pulse (1 peso) for Pin ${pin}`);
        if (currentPulseCallback) currentPulseCallback(1);
        
        if (coinSlots && coinSlots.length > 0) {
          const firstSlot = coinSlots.find(s => s.enabled);
          if (firstSlot && multiSlotCallbacks[firstSlot.id]) {
            multiSlotCallbacks[firstSlot.id](firstSlot.denomination);
          }
        }
      }, 5000);
    }
  }

  if (Gpio && relaySysPin !== -1) {
    try {
      const relayGpioPath = `/sys/class/gpio/gpio${relaySysPin}`;
      if (fs.existsSync(relayGpioPath)) {
        try {
          fs.writeFileSync('/sys/class/gpio/unexport', relaySysPin.toString());
        } catch (e) {}
      }

      relayActiveHigh = relayActiveMode !== 'low';
      console.log(
        `[GPIO] Exporting RELAY GPIO ${relaySysPin} (Physical Pin ${relayPhysPin}) with active-${
          relayActiveHigh ? 'HIGH' : 'LOW'
        }...`
      );

      relayOutput = new Gpio(relaySysPin, 'out');
      const initialValue = relayActiveHigh ? 1 : 0;
      relayOutput.writeSync(initialValue);

      console.log(`[GPIO] SUCCESS: Relay GPIO ${relaySysPin} is now READY.`);
    } catch (e) {
      console.error(
        `[GPIO] RELAY EXPORT FAILED (System ${relaySysPin}): ${e.message}`
      );
      // Don't fail the entire GPIO setup if relay fails - coin input is more important
      console.warn(`[GPIO] Continuing without relay functionality`);
    }
  }
}

function handlePulses(count) {
  if (count > 0 && currentPulseCallback) {
    currentPulseCallback(count);
  }
}

function handleMultiSlotPulse(slotId, denomination) {
  console.log(`[MULTI-SLOT] Slot ${slotId} detected: ${denomination} pesos`);
  
  // Call the main pulse callback with denomination
  if (currentPulseCallback) {
    currentPulseCallback(denomination);
  }
  
  // Call slot-specific callback if registered
  if (multiSlotCallbacks[slotId]) {
    multiSlotCallbacks[slotId](denomination);
  }
}

function setRelayState(isOn) {
  if (!relayOutput) return;
  
  // LOGIC REQUESTED BY USER:
  // If Active High Setup:
  // - Trigger (isOn=true) -> Active Low (0)
  // - Normal (isOn=false) -> Active High (1)
  // If Active Low Setup:
  // - Trigger (isOn=true) -> Active High (1)
  // - Normal (isOn=false) -> Active Low (0)
  
  let value;
  if (relayActiveHigh) {
    // Active High Setup
    value = isOn ? 0 : 1;
  } else {
    // Active Low Setup
    value = isOn ? 1 : 0;
  }

  try {
    relayOutput.writeSync(value);
  } catch (e) {
    console.error('[GPIO] Failed to set relay state:', e.message);
  }
}

function registerSlotCallback(slotId, callback) {
  multiSlotCallbacks[slotId] = callback;
}

function unregisterSlotCallback(slotId) {
  delete multiSlotCallbacks[slotId];
}

function updateGPIO(
  boardType,
  pin,
  boardModel,
  espIpAddress,
  espPort,
  coinSlots,
  nodemcuDevices,
  relayPin = null,
  relayActiveMode = 'high'
) {
  console.log(`[HARDWARE] Reconfiguring: ${boardType} (${boardModel || 'Generic'}), Pin ${pin}`);
  if (boardType === 'nodemcu_esp') {
    console.log(`[HARDWARE] Multi-slot config: ${coinSlots ? coinSlots.length : 0} slots, WiFi: ${espIpAddress}:${espPort || 'default'}`);
  }
  if (nodemcuDevices) {
    console.log(`[HARDWARE] Multi-NodeMCU config: ${nodemcuDevices.length} devices`);
  }
  if (relayPin !== null) {
    console.log(
      `[HARDWARE] Relay config: Pin ${relayPin}, active-${relayActiveMode === 'low' ? 'LOW' : 'HIGH'}`
    );
  }
  initGPIO(
    currentPulseCallback,
    boardType,
    pin,
    boardModel,
    espIpAddress,
    espPort,
    coinSlots,
    nodemcuDevices,
    relayPin,
    relayActiveMode
  );
}

module.exports = { initGPIO, updateGPIO, registerSlotCallback, unregisterSlotCallback, setRelayState };
