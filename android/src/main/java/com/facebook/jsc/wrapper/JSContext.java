/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

package com.facebook.jsc.wrapper;

public class JSContext {
    private long nativeContext;

    static {
        // Load JNI bridge first (it links against libjsc)
        // libjsc.so is a C library, not a JNI library, so we let CMake handle loading
        // it
        System.loadLibrary("jscbridge");
    }

    public JSContext(long contextRef) {
        this.nativeContext = contextRef;
    }

    public static native long create();

    public native String evaluateScript(String script, String sourceURL);

    public native void setProperty(JSObject object, String propertyName, Object value);

    public native void setObjectForKey(String key, JavaScriptObject object);

    public JSObject getGlobalObject() {
        return new JSObject();
    }

    public JSObject createObject() {
        return new JSObject();
    }

    public void close() {
        if (nativeContext != 0) {
            nativeContext = 0;
        }
    }
}
