package com.relay.client;

public class RustTranspilerModule {
    static {
        System.loadLibrary("relay_hook_transpiler");
    }

    public static native String nativeTranspile(String code, String filename, boolean isTypescript);
    public static native String nativeGetVersion();
}
