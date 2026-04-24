package com.ajcpisowifi.phonerental.admin

import android.app.AlertDialog
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.ajcpisowifi.phonerental.BuildConfig
import com.ajcpisowifi.phonerental.R
import com.ajcpisowifi.phonerental.network.RentalApiClient
import com.ajcpisowifi.phonerental.ui.SetupActivity
import com.ajcpisowifi.phonerental.util.AppUpdater
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Admin Activity - accessible via long-press on the main screen
 * Allows the admin to:
 * 1. Select which apps are allowed during rental
 * 2. Configure admin password
 * 3. Configure server URL
 * 4. View device info
 * 5. Test rental restrictions
 */
class AdminActivity : AppCompatActivity() {

    private lateinit var appManager: AppManager
    private lateinit var apiClient: RentalApiClient
    private val scope = CoroutineScope(Dispatchers.Main)

    private lateinit var tabCommon: Button
    private lateinit var tabAll: Button
    private lateinit var tabSettings: Button
    private lateinit var appRecyclerView: RecyclerView
    private lateinit var settingsContainer: LinearLayout
    private lateinit var passwordInput: EditText
    private lateinit var serverUrlInput: EditText
    private lateinit var savePasswordBtn: Button
    private lateinit var saveServerBtn: Button
    private lateinit var testRestrictionsBtn: Button
    private lateinit var removeRestrictionsBtn: Button
    private lateinit var logoutAccountsBtn: Button
    private lateinit var logoutKioskBtn: Button
    private lateinit var setupBtn: Button
    private lateinit var backBtn: Button
    private lateinit var deviceOwnerStatus: TextView
    private lateinit var allowedCountLabel: TextView
    // Update UI
    private lateinit var checkUpdateBtn: Button
    private lateinit var appVersionLabel: TextView
    private lateinit var updateStatusLabel: TextView

    private var currentTab = "common"
    private var isAuthenticated = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_admin)

        appManager = AppManager(this)
        apiClient = RentalApiClient(this)

        // Ask for admin password first
        if (!isAuthenticated) {
            showPasswordDialog()
            return
        }

        initViews()
    }

    private fun showPasswordDialog() {
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
            hint = "Enter Admin PIN"
            setPadding(40, 20, 40, 20)
        }

        AlertDialog.Builder(this)
            .setTitle("Admin Access")
            .setView(input)
            .setPositiveButton("Enter") { _, _ ->
                val entered = input.text.toString()
                if (entered == appManager.adminPassword) {
                    isAuthenticated = true
                    initViews()
                } else {
                    Toast.makeText(this, "Wrong PIN", Toast.LENGTH_SHORT).show()
                    finish()
                }
            }
            .setNegativeButton("Cancel") { _, _ -> finish() }
            .setCancelable(false)
            .show()
    }

    private fun initViews() {
        setContentView(R.layout.activity_admin)

        tabCommon = findViewById(R.id.tabCommon)
        tabAll = findViewById(R.id.tabAll)
        tabSettings = findViewById(R.id.tabSettings)
        appRecyclerView = findViewById(R.id.appRecyclerView)
        settingsContainer = findViewById(R.id.settingsContainer)
        passwordInput = findViewById(R.id.passwordInput)
        serverUrlInput = findViewById(R.id.serverUrlInput)
        savePasswordBtn = findViewById(R.id.savePasswordBtn)
        saveServerBtn = findViewById(R.id.saveServerBtn)
        testRestrictionsBtn = findViewById(R.id.testRestrictionsBtn)
        removeRestrictionsBtn = findViewById(R.id.removeRestrictionsBtn)
        logoutAccountsBtn = findViewById(R.id.logoutAccountsBtn)
        logoutKioskBtn = findViewById(R.id.logoutKioskBtn)
        setupBtn = findViewById(R.id.setupBtn)
        backBtn = findViewById(R.id.backBtn)
        deviceOwnerStatus = findViewById(R.id.deviceOwnerStatus)
        allowedCountLabel = findViewById(R.id.allowedCountLabel)
        // Update UI
        checkUpdateBtn = findViewById(R.id.checkUpdateBtn)
        appVersionLabel = findViewById(R.id.appVersionLabel)
        updateStatusLabel = findViewById(R.id.updateStatusLabel)

        // Setup
        serverUrlInput.setText(apiClient.serverUrl)
        passwordInput.setText(appManager.adminPassword)
        deviceOwnerStatus.text = if (appManager.isDeviceOwner()) "Device Owner: YES (advanced kiosk)" else "Device Owner: NO (standard mode - OK)"
        updateAllowedCount()

        // Show current app version
        appVersionLabel.text = "Current version: v${BuildConfig.VERSION_NAME} (code ${BuildConfig.VERSION_CODE})"

        // Tabs
        tabCommon.setOnClickListener { switchTab("common") }
        tabAll.setOnClickListener { switchTab("all") }
        tabSettings.setOnClickListener { switchTab("settings") }

        // Settings
        savePasswordBtn.setOnClickListener {
            val newPin = passwordInput.text.toString()
            if (newPin.length >= 4) {
                appManager.adminPassword = newPin
                Toast.makeText(this, "PIN updated", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "PIN must be at least 4 digits", Toast.LENGTH_SHORT).show()
            }
        }

        saveServerBtn.setOnClickListener {
            apiClient.serverUrl = serverUrlInput.text.toString().trimEnd('/')
            Toast.makeText(this, "Server URL saved", Toast.LENGTH_SHORT).show()
        }

        testRestrictionsBtn.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Apply Restrictions?")
                .setMessage("This will suspend all non-allowed apps. Only continue if testing.")
                .setPositiveButton("Apply") { _, _ ->
                    CoroutineScope(Dispatchers.IO).launch {
                        appManager.applyRentalAppRestrictions()
                    }
                    Toast.makeText(this@AdminActivity, "Restrictions applied!", Toast.LENGTH_SHORT).show()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        removeRestrictionsBtn.setOnClickListener {
            CoroutineScope(Dispatchers.IO).launch {
                appManager.removeRentalAppRestrictions()
            }
            Toast.makeText(this, "All restrictions removed", Toast.LENGTH_LONG).show()
        }

        logoutAccountsBtn.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Log Out All Accounts?")
                .setMessage("This will clear data for Facebook, Messenger, games, etc. All accounts will be signed out.")
                .setPositiveButton("Log Out All") { _, _ ->
                    appManager.logoutAllAccounts()
                    Toast.makeText(this@AdminActivity, "All accounts logged out", Toast.LENGTH_LONG).show()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        logoutKioskBtn.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Logout Kiosk Mode?")
                .setMessage("This will stop kiosk mode and return you to the normal phone home screen. The rental timer will keep running in the background. You can reopen the app from the app drawer.")
                .setPositiveButton("Logout") { _, _ ->
                    // Exit kiosk mode properly
                    try {
                        // Method 1: Stop lock task mode (for lock task pinned apps)
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as android.app.admin.DevicePolicyManager
                            val componentName = android.content.ComponentName(this, KioskDeviceAdmin::class.java)
                            
                            if (dpm.isDeviceOwnerApp(packageName)) {
                                // Device Owner mode: Remove from lock task packages
                                dpm.setLockTaskPackages(componentName, emptyArray())
                                Log.d("AdminActivity", "Removed lock task packages via Device Owner")
                            }
                        }
                        
                        // Method 2: Stop lock task (standard method)
                        try {
                            stopLockTask()
                            Log.d("AdminActivity", "Stopped lock task mode")
                        } catch (e: Exception) {
                            Log.w("AdminActivity", "stopLockTask failed: ${e.message}")
                        }
                    } catch (e: Exception) {
                        Log.e("AdminActivity", "Error exiting kiosk mode: ${e.message}", e)
                    }

                    // Stop timer service foreground (keep running in background)
                    val stopIntent = Intent(this, com.ajcpisowifi.phonerental.service.TimerService::class.java).apply {
                        action = com.ajcpisowifi.phonerental.service.TimerService.ACTION_STOP
                    }
                    startService(stopIntent)

                    // Go to home screen
                    val homeIntent = Intent(Intent.ACTION_MAIN)
                    homeIntent.addCategory(Intent.CATEGORY_HOME)
                    homeIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    startActivity(homeIntent)
                    
                    Toast.makeText(this, "Kiosk mode exited. Timer still running.", Toast.LENGTH_LONG).show()
                    
                    // Finish admin activity
                    finish()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        setupBtn.setOnClickListener {
            startActivity(Intent(this, SetupActivity::class.java))
        }

        // Check for app updates (optional/interactive)
        checkUpdateBtn.setOnClickListener {
            checkUpdateBtn.isEnabled = false
            updateStatusLabel.text = "Checking for updates…"
            updateStatusLabel.setTextColor(0xFF808080.toInt())
            val updater = AppUpdater(this, apiClient.serverUrl)
            scope.launch {
                updater.checkAndPrompt(
                    activity = this@AdminActivity,
                    onStatusMessage = { msg ->
                        updateStatusLabel.text = msg
                        val color = when {
                            msg.startsWith("✅") -> 0xFF4CAF50.toInt()
                            msg.startsWith("❌") -> 0xFFf44336.toInt()
                            else -> 0xFF808080.toInt()
                        }
                        updateStatusLabel.setTextColor(color)
                    }
                )
                checkUpdateBtn.isEnabled = true
            }
        }

        backBtn.setOnClickListener { finish() }

        // Show common apps by default
        switchTab("common")
    }

    private fun switchTab(tab: String) {
        currentTab = tab

        tabCommon.setBackgroundColor(if (tab == "common") 0xFF0f3460.toInt() else 0xFF333333.toInt())
        tabAll.setBackgroundColor(if (tab == "all") 0xFF0f3460.toInt() else 0xFF333333.toInt())
        tabSettings.setBackgroundColor(if (tab == "settings") 0xFF0f3460.toInt() else 0xFF333333.toInt())

        if (tab == "settings") {
            appRecyclerView.visibility = View.GONE
            settingsContainer.visibility = View.VISIBLE
        } else {
            appRecyclerView.visibility = View.VISIBLE
            settingsContainer.visibility = View.GONE
            loadApps(tab)
        }
    }

    private fun loadApps(tab: String) {
        scope.launch {
            // Always sync from server first when loading apps
            withContext(Dispatchers.IO) {
                appManager.syncAllowedAppsFromServer()
            }
            updateAllowedCount()

            val apps = withContext(Dispatchers.IO) {
                if (tab == "common") appManager.getCommonApps()
                else appManager.getInstalledApps()
            }

            val adapter = AppListAdapter(apps) { packageName ->
                val isNowAllowed = appManager.toggleAllowedApp(packageName)
                updateAllowedCount()
                // Refresh the list
                loadApps(tab)
            }

            appRecyclerView.layoutManager = LinearLayoutManager(this@AdminActivity)
            appRecyclerView.adapter = adapter
        }
    }

    private fun updateAllowedCount() {
        val count = appManager.getAllowedAppPackages().size
        allowedCountLabel.text = "$count apps allowed for rental"
    }

    /**
     * RecyclerView Adapter for app list
     */
    inner class AppListAdapter(
        private val apps: List<AppInfo>,
        private val onToggle: (String) -> Unit
    ) : RecyclerView.Adapter<AppListAdapter.ViewHolder>() {

        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val appIcon: TextView = view.findViewById(R.id.appIcon)
            val appLabel: TextView = view.findViewById(R.id.appLabel)
            val appPackage: TextView = view.findViewById(R.id.appPackage)
            val toggleSwitch: Switch = view.findViewById(R.id.appSwitch)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_app, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val app = apps[position]
            holder.appLabel.text = app.label
            holder.appPackage.text = app.packageName
            holder.appIcon.text = app.label.take(2).uppercase()
            holder.toggleSwitch.setOnCheckedChangeListener(null)
            holder.toggleSwitch.isChecked = app.isAllowed
            holder.toggleSwitch.setOnCheckedChangeListener { _, _ ->
                onToggle(app.packageName)
            }
        }

        override fun getItemCount() = apps.size
    }
}
