package com.relay.test

import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.viewpager2.widget.ViewPager2
import com.google.android.material.tabs.TabLayout
import com.google.android.material.tabs.TabLayoutMediator

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        android.util.Log.e("MainActivity", "onCreate started")
        setContentView(R.layout.activity_main)

        val tabLayout = findViewById<TabLayout>(R.id.tab_layout)
        val hookContainer = findViewById<android.widget.FrameLayout>(R.id.hook_container)

        // Local hook test - load from assets
        supportFragmentManager.beginTransaction()
            .replace(R.id.hook_container, LocalHookFragment())
            .commit()

        tabLayout.addTab(tabLayout.newTab().apply {
            text = getString(R.string.local_hook)
            tag = 0
        })
        tabLayout.addTab(tabLayout.newTab().apply {
            text = getString(R.string.remote_hook)
            tag = 1
        })

        tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab) {
                when (tab.position) {
                    0 -> supportFragmentManager.beginTransaction()
                        .replace(R.id.hook_container, LocalHookFragment())
                        .commit()
                    1 -> supportFragmentManager.beginTransaction()
                        .replace(R.id.hook_container, RemoteHookFragment())
                        .commit()
                }
            }

            override fun onTabUnselected(tab: TabLayout.Tab) {}
            override fun onTabReselected(tab: TabLayout.Tab) {}
        })
    }
}
