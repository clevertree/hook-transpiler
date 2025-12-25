package com.relay.test

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.TextView
import androidx.fragment.app.Fragment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*

class RemoteHookFragment : Fragment() {
    private lateinit var quickJSManager: QuickJSManager
    private lateinit var urlInput: EditText
    private lateinit var loadButton: Button
    private lateinit var useJniCheckBox: CheckBox
    private lateinit var statusView: TextView
    private lateinit var containerView: FrameLayout

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_remote_hook, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Get QuickJSManager from MainActivity
        quickJSManager = (activity as? MainActivity)?.quickJSManager ?: return

        urlInput = view.findViewById(R.id.et_hook_url)
        loadButton = view.findViewById(R.id.btn_load_remote)
        useJniCheckBox = view.findViewById(R.id.cb_use_jni)
        statusView = view.findViewById(R.id.tv_status)
        containerView = view.findViewById(R.id.remote_js_container)

        loadButton.setOnClickListener {
            val url = urlInput.text.toString()
            if (url.isEmpty()) {
                logStatus("Error: URL is empty")
                return@setOnClickListener
            }
            loadAndRenderHook(url)
        }
        
        // Auto-load the default URL on fragment creation
        val defaultUrl = urlInput.text.toString()
        if (defaultUrl.isNotEmpty()) {
            view.postDelayed({
                loadAndRenderHook(defaultUrl)
            }, 500)
        }
    }

    private fun loadAndRenderHook(url: String) {
        logStatus("Fetching hook from: $url")
        
        GlobalScope.launch(Dispatchers.Default) {
            try {
                logStatus("Downloading...")
                val hookSource = fetchHook(url)
                
                withContext(Dispatchers.Main) {
                    logStatus("Downloaded ${hookSource.length} bytes, transpiling...")
                    
                    // Set renderer mode
                    val rendererMode = if (useJniCheckBox.isChecked) "react" else "act"
                    quickJSManager.setRendererMode(rendererMode)
                    
                    // Transpile and render the remote hook
                    quickJSManager.renderRemoteHook(hookSource, containerView)
                    
                    logStatus("Remote hook rendered successfully")
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    logStatus("Error: ${e.message}")
                    e.printStackTrace()
                }
            }
        }
    }

    private fun fetchHook(urlString: String): String {
        return URL(urlString).readText(Charsets.UTF_8)
    }

    private fun logStatus(message: String) {
        val timestamp = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        val currentText = statusView.text.toString()
        statusView.text = "[$timestamp] $message\n$currentText"
    }
}
