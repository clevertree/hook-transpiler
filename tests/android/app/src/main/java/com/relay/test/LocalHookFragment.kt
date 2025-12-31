package com.relay.test

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView
import androidx.fragment.app.Fragment
import com.clevertree.hooktranspiler.render.HookRenderer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.io.InputStreamReader
import java.text.SimpleDateFormat
import java.util.*

/**
 * Local Hook Fragment
 * Uses HookRenderer to transpile local asset, then JSCManager to execute
 */
class LocalHookFragment : Fragment() {
    private lateinit var hookRenderer: HookRenderer
    private lateinit var outputView: TextView
    private lateinit var containerView: FrameLayout
    private lateinit var loadButton: Button
    private var rendererMode = com.clevertree.hooktranspiler.model.RendererMode.ACT
    private val scope = CoroutineScope(Dispatchers.Main + Job())

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_local_hook, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        outputView = view.findViewById(R.id.tv_output)
        containerView = view.findViewById(R.id.js_container)
        loadButton = view.findViewById(R.id.btn_load_local)
        
        val btnRendererAct = view.findViewById<Button>(R.id.btn_renderer_act)
        val btnRendererReact = view.findViewById<Button>(R.id.btn_renderer_react)

        // Initialize HookRenderer
        hookRenderer = HookRenderer(requireContext())
        containerView.addView(hookRenderer, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        hookRenderer.onLoading = { logOutput("Loading hook...") }
        hookRenderer.onReady = { viewCount -> logOutput("Hook ready and rendered ($viewCount native views)") }
        hookRenderer.onError = { error -> logOutput("Error: ${error.message}") }

        loadButton.setOnClickListener {
            loadLocalHook()
        }
        
        btnRendererAct.setOnClickListener {
            rendererMode = com.clevertree.hooktranspiler.model.RendererMode.ACT
            hookRenderer.setRendererMode(rendererMode)
            logOutput("Switched to Act renderer")
            updateRendererButtons(btnRendererAct, btnRendererReact)
        }
        
        btnRendererReact.setOnClickListener {
            rendererMode = com.clevertree.hooktranspiler.model.RendererMode.REACT_NATIVE
            hookRenderer.setRendererMode(rendererMode)
            logOutput("Switched to React Native renderer (for testing)")
            updateRendererButtons(btnRendererAct, btnRendererReact)
        }
        
        updateRendererButtons(btnRendererAct, btnRendererReact)

        // Auto-load on start
        view.postDelayed({ loadLocalHook() }, 300)
    }
    
    private fun updateRendererButtons(btnAct: Button, btnReact: Button) {
        btnAct.isEnabled = rendererMode != com.clevertree.hooktranspiler.model.RendererMode.ACT
        btnReact.isEnabled = rendererMode != com.clevertree.hooktranspiler.model.RendererMode.REACT_NATIVE
    }

    private fun loadLocalHook() {
        logOutput("Loading test-hook.jsx from assets...")
        hookRenderer.loadHook("test-hook.jsx")
    }

    private fun logOutput(message: String) {
        val timestamp = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        val currentText = outputView.text.toString()
        outputView.text = "[$timestamp] $message\n$currentText"
    }

    override fun onDestroyView() {
        super.onDestroyView()
        scope.coroutineContext[Job]?.cancel()
    }
}
