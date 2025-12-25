package com.relay.test

import android.os.Bundle
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.viewpager2.widget.ViewPager2
import com.google.android.material.tabs.TabLayout
import com.google.android.material.tabs.TabLayoutMediator
import com.relay.client.*

class MainActivity : AppCompatActivity() {
    var quickJSManager: QuickJSManager? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize AndroidRenderer with a temporary container (fragments will use their own)
        val tempContainer = FrameLayout(this)
        AndroidRenderer.initialize(this, tempContainer)
        
        // Create and initialize the QuickJS manager
        quickJSManager = QuickJSManager(this)
        quickJSManager?.initialize()

        // Setup ViewPager2 with fragments
        val viewPager = findViewById<ViewPager2>(R.id.view_pager)
        val tabLayout = findViewById<TabLayout>(R.id.tab_layout)
        
        viewPager.adapter = HookFragmentAdapter(this)
        
        TabLayoutMediator(tabLayout, viewPager) { tab, position ->
            tab.text = when (position) {
                0 -> "Local Hook Test"
                1 -> "Remote Hook"
                else -> "Unknown"
            }
        }.attach()
    }
}
