package com.relay.test

import android.util.Log

object AndroidBridge {
    private const val TAG = "AndroidBridge"

    // Maps to store view references and event callbacks
    private val eventCallbacks = mutableMapOf<Int, MutableMap<String, (Map<String, Any>) -> Unit>>()

    fun createView(tag: Int, type: String, props: Map<String, Any>) {
        Log.d(TAG, "createView: tag=$tag, type=$type")
        AndroidRenderer.createView(tag, type, props)
    }

    fun updateProps(tag: Int, props: Map<String, Any>) {
        Log.d(TAG, "updateProps: tag=$tag")
        AndroidRenderer.updateProps(tag, props)
    }

    fun removeView(tag: Int) {
        Log.d(TAG, "removeView: tag=$tag")
        AndroidRenderer.removeView(tag)
    }

    fun addChild(parent: Int, child: Int, index: Int) {
        Log.d(TAG, "addChild: parent=$parent, child=$child, index=$index")
        AndroidRenderer.addChild(parent, child, index)
    }

    fun removeChild(parent: Int, child: Int) {
        Log.d(TAG, "removeChild: parent=$parent, child=$child")
        AndroidRenderer.removeChild(parent, child)
    }

    fun registerEventCallback(tag: Int, eventName: String, callback: (Map<String, Any>) -> Unit) {
        eventCallbacks.getOrPut(tag) { mutableMapOf() }[eventName] = callback
    }

    fun unregisterEventCallbacks(tag: Int) {
        eventCallbacks.remove(tag)
    }

    fun emitEvent(tag: Int, eventName: String, data: Map<String, Any>) {
        Log.d(TAG, "emitEvent: tag=$tag, eventName=$eventName")
        eventCallbacks[tag]?.get(eventName)?.invoke(data)
    }
}
