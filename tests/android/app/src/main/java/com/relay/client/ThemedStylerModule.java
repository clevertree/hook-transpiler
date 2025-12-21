package com.relay.client;

public class ThemedStylerModule {
    static {
        System.loadLibrary("themed_styler");
    }

    public static native String nativeRenderCss(String usageJson, String themesJson);
    public static native String nativeGetRnStyles(String selector, String classesJson, String themesJson);
    public static native String nativeGetDefaultState();
    public static native String nativeGetVersion();
}
