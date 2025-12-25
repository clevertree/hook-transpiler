package com.relay.test

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.TextView
import androidx.fragment.app.Fragment
import java.text.SimpleDateFormat
import java.util.*

class LocalHookFragment : Fragment() {
    private lateinit var quickJSManager: QuickJSManager
    private lateinit var outputView: TextView
    private lateinit var containerView: FrameLayout
    private lateinit var modeGroup: RadioGroup
    private lateinit var rendererModeGroup: RadioGroup

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_local_hook, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Get QuickJSManager from MainActivity
        quickJSManager = (activity as? MainActivity)?.quickJSManager ?: return

        outputView = view.findViewById(R.id.tv_output)
        containerView = view.findViewById(R.id.js_container)
        modeGroup = view.findViewById(R.id.mode_group)
        rendererModeGroup = view.findViewById(R.id.renderer_mode_group)

        // Setup mode selection listeners
        modeGroup.setOnCheckedChangeListener { _, checkedId ->
            val mode = when (checkedId) {
                R.id.radio_jni -> "JNI"
                R.id.radio_ffi -> "FFI"
                else -> "JNI"
            }
            logOutput("Switched to $mode transpiler backend")
            renderUI()
        }

        rendererModeGroup.setOnCheckedChangeListener { _, checkedId ->
            val rendererMode = when (checkedId) {
                R.id.radio_react -> "react"
                R.id.radio_act -> "act"
                else -> "react"
            }
            logOutput("Switched to $rendererMode renderer mode")
            renderUI()
        }

        // Initial render
        renderUI()
    }

    private fun renderUI() {
        try {
            val rendererMode = when (rendererModeGroup.checkedRadioButtonId) {
                R.id.radio_react -> "react"
                R.id.radio_act -> "act"
                else -> "react"
            }
            quickJSManager.setRendererMode(rendererMode)
            quickJSManager.renderHook("test-hook.jsx", containerView)
            logOutput("Rendering complete")
        } catch (e: Exception) {
            logOutput("Error: ${e.message}")
            e.printStackTrace()
        }
    }

    private fun logOutput(message: String) {
        val timestamp = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        val currentText = outputView.text.toString()
        outputView.text = "[$timestamp] $message\n$currentText"
    }
}
