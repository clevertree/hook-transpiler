package com.relay.client;

import com.sun.jna.Library;
import com.sun.jna.Native;
import com.sun.jna.Pointer;

public interface StylerFFI extends Library {
    StylerFFI INSTANCE = Native.load("themed_styler", StylerFFI.class);

    String themed_styler_version();
    Pointer themed_styler_render_css(String usageJson, String themesJson);
    void themed_styler_free_string(Pointer s);
}
