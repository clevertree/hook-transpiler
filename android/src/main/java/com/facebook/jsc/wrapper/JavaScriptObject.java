/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

package com.facebook.jsc.wrapper;

public abstract class JavaScriptObject {
    // Override this method for single String argument with no return
    public void call(String arg) {
    }
    
    // Override this method for two String arguments returning String
    public String call(String arg1, String arg2) {
        return "";
    }
    
    // Override this method for String argument returning Int
    public int callWithReturn(String arg) {
        return 0;
    }
    
    // Override this method for int + String arguments with no return
    public void call(int arg1, String arg2) {
    }
    
    // Override this method for two int arguments with no return
    public void call(int arg1, int arg2) {
    }
    
    // Override this method for no arguments with no return
    public void call() {
    }
}
