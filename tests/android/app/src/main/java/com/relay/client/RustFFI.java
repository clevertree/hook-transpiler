package com.relay.client;

import com.sun.jna.Library;
import com.sun.jna.Native;
import com.sun.jna.Pointer;

public interface RustFFI extends Library {
    RustFFI INSTANCE = Native.load("relay_hook_transpiler", RustFFI.class);

    String hook_transpiler_version();
    Pointer hook_transpile_jsx(String code, String filename, boolean isTypescript);
    void hook_transpiler_free_string(Pointer s);
}
