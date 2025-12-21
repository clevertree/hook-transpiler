package com.relay.test

import android.os.Bundle
import android.widget.Button
import android.widget.RadioButton
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.relay.client.*
import com.sun.jna.Pointer

class MainActivity : AppCompatActivity() {
    private lateinit var tvOutput: TextView
    private lateinit var radioJni: RadioButton

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvOutput = findViewById(R.id.tv_output)
        radioJni = findViewById(R.id.radio_jni)

        findViewById<Button>(R.id.btn_test_transpile).setOnClickListener {
            testTranspile()
        }

        findViewById<Button>(R.id.btn_test_styler).setOnClickListener {
            testStyler()
        }

        tvOutput.postDelayed({
            radioJni.isChecked = true
            testTranspile()
        }, 1000)

        tvOutput.postDelayed({
            findViewById<RadioButton>(R.id.radio_ffi).isChecked = true
            testTranspile()
        }, 3000)

        tvOutput.postDelayed({
            radioJni.isChecked = true
            testStyler()
        }, 5000)

        tvOutput.postDelayed({
            findViewById<RadioButton>(R.id.radio_ffi).isChecked = true
            testStyler()
        }, 7000)
    }

    private fun testTranspile() {
        val code = "const App = () => <div className='p-4'>Hello Android</div>;"
        val filename = "App.tsx"
        
        if (radioJni.isChecked) {
            try {
                android.util.Log.d("RustTranspiler", "Testing JNI...")
                val version = RustTranspilerModule.nativeGetVersion()
                val result = RustTranspilerModule.nativeTranspile(code, filename)
                android.util.Log.d("RustTranspiler", "JNI Result: $result")
                tvOutput.text = "JNI (v$version):\n$result"
            } catch (e: Exception) {
                android.util.Log.e("RustTranspiler", "JNI Error", e)
                tvOutput.text = "JNI Error: ${e.message}"
            }
        } else {
            try {
                android.util.Log.d("RustTranspiler", "Testing FFI...")
                val version = RustFFI.INSTANCE.hook_transpiler_version()
                val ptr = RustFFI.INSTANCE.hook_transpile_jsx(code, filename)
                if (ptr != null) {
                    val result = ptr.getString(0)
                    RustFFI.INSTANCE.hook_transpiler_free_string(ptr)
                    android.util.Log.d("RustTranspiler", "FFI Result: $result")
                    tvOutput.text = "FFI (v$version):\n$result"
                } else {
                    android.util.Log.e("RustTranspiler", "FFI Error: Transpilation returned null")
                    tvOutput.text = "FFI Error: Transpilation returned null"
                }
            } catch (e: Exception) {
                android.util.Log.e("RustTranspiler", "FFI Error", e)
                tvOutput.text = "FFI Error: ${e.message}"
            }
        }
    }

    private fun testStyler() {
        val usageJson = "{\"selectors\":[\"div\"],\"classes\":[\"p-4\"]}"
        val themesJson = "{}"
        
        if (radioJni.isChecked) {
            try {
                android.util.Log.d("RustTranspiler", "Testing JNI Styler...")
                val version = ThemedStylerModule.nativeGetVersion()
                val result = ThemedStylerModule.nativeRenderCss(usageJson, themesJson)
                android.util.Log.d("RustTranspiler", "JNI Styler Result: $result")
                tvOutput.text = "JNI Styler (v$version):\n$result"
            } catch (e: Exception) {
                android.util.Log.e("RustTranspiler", "JNI Styler Error", e)
                tvOutput.text = "JNI Styler Error: ${e.message}"
            }
        } else {
            try {
                android.util.Log.d("RustTranspiler", "Testing FFI Styler...")
                val version = StylerFFI.INSTANCE.themed_styler_version()
                val ptr = StylerFFI.INSTANCE.themed_styler_render_css(usageJson, themesJson)
                if (ptr != null) {
                    val result = ptr.getString(0)
                    StylerFFI.INSTANCE.themed_styler_free_string(ptr)
                    android.util.Log.d("RustTranspiler", "FFI Styler Result: $result")
                    tvOutput.text = "FFI Styler (v$version):\n$result"
                } else {
                    android.util.Log.e("RustTranspiler", "FFI Styler Error: Render returned null")
                    tvOutput.text = "FFI Styler Error: Render returned null"
                }
            } catch (e: Exception) {
                android.util.Log.e("RustTranspiler", "FFI Styler Error", e)
                tvOutput.text = "FFI Styler Error: ${e.message}"
            }
        }
    }
}
