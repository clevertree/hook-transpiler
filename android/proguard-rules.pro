# Keep hook transpiler JNI class methods
-keep class com.clevertree.hooktranspiler.jni.** {
    native <methods>;
    public <methods>;
}

# Keep hook renderer and app classes
-keep class com.clevertree.hooktranspiler.render.** { public *; }
-keep class com.clevertree.hooktranspiler.app.** { public *; }

# Keep model classes
-keep class com.clevertree.hooktranspiler.model.** { public *; }

# Keep error classes
-keep class com.clevertree.hooktranspiler.error.** { public *; }

# Keep styling registry
-keep class com.clevertree.hooktranspiler.styling.** { public *; }

# Keep data classes (Kotlin)
-keep class com.clevertree.hooktranspiler.**$* { public *; }

# Don't obfuscate native methods
-keepattributes Signature,InnerClasses,EnclosingMethod
