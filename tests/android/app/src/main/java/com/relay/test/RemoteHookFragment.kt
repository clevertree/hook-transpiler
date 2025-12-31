package com.relay.test

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.TextView
import androidx.fragment.app.Fragment
import com.clevertree.hooktranspiler.render.HookRenderer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

/**
 * Remote Hook Fragment
 * Uses HookRenderer to fetch+transpile remote hook, then JSCManager to execute
 * When URL is known, skips OPTIONS and fetches directly
 */
class RemoteHookFragment : Fragment() {
    private lateinit var hookRenderer: HookRenderer
    private lateinit var urlInput: EditText
    private lateinit var loadButton: Button
    private lateinit var statusView: TextView
    private lateinit var containerView: FrameLayout
    private val scope = CoroutineScope(Dispatchers.Main + Job())

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_remote_hook, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        urlInput = view.findViewById(R.id.et_hook_url)
        loadButton = view.findViewById(R.id.btn_load_remote)
        statusView = view.findViewById(R.id.tv_status)
        containerView = view.findViewById(R.id.remote_js_container)

        // Initialize HookRenderer
        hookRenderer = HookRenderer(requireContext())
        containerView.addView(hookRenderer, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        hookRenderer.onLoading = { logStatus("Loading hook...") }
        hookRenderer.onReady = { logStatus("Hook ready and rendered") }
        hookRenderer.onError = { error -> logStatus("Error: ${error.message}") }

        loadButton.setOnClickListener {
            val url = urlInput.text.toString()
            if (url.isEmpty()) {
                logStatus("Error: URL is empty")
                return@setOnClickListener
            }
            loadAndRenderHook(url)
        }

        // Auto-load default URL
        view.postDelayed({ loadAndRenderHook(urlInput.text.toString()) }, 300)
    }

    private fun loadAndRenderHook(url: String) {
        logStatus("Loading: $url")
        hookRenderer.loadHook(url)
    }

    private fun logStatus(message: String) {
        val timestamp = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        val currentText = statusView.text.toString()
        statusView.text = "[$timestamp] $message\n$currentText"
    }

    override fun onDestroyView() {
        super.onDestroyView()
        scope.coroutineContext[Job]?.cancel()
    }
}
