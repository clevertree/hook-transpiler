# Proguard rules for Hook Transpiler for Android

# Keep Hook Transpiler classes
-keep class com.clevertree.hooktranspiler.** { *; }

# Keep annotations
-keep interface com.clevertree.hooktranspiler.** { *; }

# Keep JNI native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep data classes
-keepclassmembers class * {
    *** component*(..);
    *** copy(..);
}

# Keep Kotlin metadata
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.jvm.internal.**
-dontwarn kotlin.jvm.functions.**

# Keep Coroutines
-keep class kotlinx.coroutines.** { *; }
-keep interface kotlinx.coroutines.** { *; }

# Optimization settings
-optimizations !code/simplification/arithmetic
-optimizations !code/simplification/cast
-optimizations !field/*
-optimizations !class/merging/*

# Log optimization/obfuscation info
-verbose
-printconfiguration
