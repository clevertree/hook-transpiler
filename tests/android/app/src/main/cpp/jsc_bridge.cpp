#include <jni.h>
#include <android/log.h>
#include "JavaScriptCore/JavaScript.h"
#include <map>
#include <string>
#include <memory>
#include <vector>

#define LOG_TAG "JSCBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

static JavaVM* g_jvm = nullptr;

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void* reserved) {
    g_jvm = vm;
    return JNI_VERSION_1_6;
}

static JNIEnv* getEnv() {
    JNIEnv* env = nullptr;
    if (g_jvm->GetEnv((void**)&env, JNI_VERSION_1_6) != JNI_OK) {
        g_jvm->AttachCurrentThread(&env, nullptr);
    }
    return env;
}

// Helper to convert JSValue to String
std::string jsValueToString(JSContextRef ctx, JSValueRef value) {
    if (!value) return "";
    JSStringRef jsStr = JSValueToStringCopy(ctx, value, nullptr);
    if (!jsStr) return "";
    size_t max = JSStringGetMaximumUTF8CStringSize(jsStr);
    std::vector<char> buf(max);
    JSStringGetUTF8CString(jsStr, buf.data(), max);
    JSStringRelease(jsStr);
    return std::string(buf.data());
}

// Generic callback for JavaScriptObject.call
static JSValueRef nativeCallback(JSContextRef ctx, JSObjectRef function, JSObjectRef thisObject, size_t argumentCount, const JSValueRef arguments[], JSValueRef* exception) {
    jobject javaCallback = static_cast<jobject>(JSObjectGetPrivate(function));
    if (!javaCallback) {
        LOGE("nativeCallback: No javaCallback private data");
        return JSValueMakeUndefined(ctx);
    }

    JNIEnv* env = getEnv();
    jclass cls = env->GetObjectClass(javaCallback);

    LOGI("nativeCallback: argumentCount=%zu", argumentCount);

    // We support a few overloads of 'call'
    if (argumentCount == 0) {
        jmethodID mid = env->GetMethodID(cls, "call", "()V");
        if (env->ExceptionCheck()) { env->ExceptionClear(); mid = nullptr; }
        if (mid) {
            env->CallVoidMethod(javaCallback, mid);
            return JSValueMakeUndefined(ctx);
        }
    } else if (argumentCount == 1) {
        // Try String -> String (callString)
        jmethodID mid = env->GetMethodID(cls, "callString", "(Ljava/lang/String;)Ljava/lang/String;");
        if (env->ExceptionCheck()) { env->ExceptionClear(); mid = nullptr; }
        if (mid) {
            std::string arg0 = jsValueToString(ctx, arguments[0]);
            LOGI("nativeCallback: calling callString(String) -> String with '%s'", arg0.c_str());
            jstring jarg0 = env->NewStringUTF(arg0.c_str());
            jstring jres = (jstring)env->CallObjectMethod(javaCallback, mid, jarg0);
            env->DeleteLocalRef(jarg0);
            
            if (jres) {
                const char* resC = env->GetStringUTFChars(jres, nullptr);
                JSStringRef resJS = JSStringCreateWithUTF8CString(resC);
                JSValueRef resVal = JSValueMakeString(ctx, resJS);
                JSStringRelease(resJS);
                env->ReleaseStringUTFChars(jres, resC);
                return resVal;
            }
            return JSValueMakeUndefined(ctx);
        }

        // Fallback to String -> void (call)
        mid = env->GetMethodID(cls, "call", "(Ljava/lang/String;)V");
        if (env->ExceptionCheck()) { env->ExceptionClear(); mid = nullptr; }
        if (mid) {
            std::string arg0 = jsValueToString(ctx, arguments[0]);
            LOGI("nativeCallback: calling call(String) with '%s'", arg0.c_str());
            jstring jarg0 = env->NewStringUTF(arg0.c_str());
            env->CallVoidMethod(javaCallback, mid, jarg0);
            env->DeleteLocalRef(jarg0);
            return JSValueMakeUndefined(ctx);
        } else {
            LOGE("nativeCallback: Could not find callString(String) or call(String) method");
        }
    } else if (argumentCount == 2) {
        // Try String, String -> String (callString)
        jmethodID mid = env->GetMethodID(cls, "callString", "(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;");
        if (env->ExceptionCheck()) { env->ExceptionClear(); mid = nullptr; }
        if (mid) {
            std::string arg0 = jsValueToString(ctx, arguments[0]);
            std::string arg1 = jsValueToString(ctx, arguments[1]);
            LOGI("nativeCallback: calling callString(String, String) with '%s', '%s'", arg0.c_str(), arg1.c_str());
            jstring jarg0 = env->NewStringUTF(arg0.c_str());
            jstring jarg1 = env->NewStringUTF(arg1.c_str());
            jstring jres = (jstring)env->CallObjectMethod(javaCallback, mid, jarg0, jarg1);
            env->DeleteLocalRef(jarg0);
            env->DeleteLocalRef(jarg1);
            
            if (jres) {
                const char* resC = env->GetStringUTFChars(jres, nullptr);
                JSStringRef resJS = JSStringCreateWithUTF8CString(resC);
                JSValueRef resVal = JSValueMakeString(ctx, resJS);
                JSStringRelease(resJS);
                env->ReleaseStringUTFChars(jres, resC);
                return resVal;
            }
            return JSValueMakeUndefined(ctx);
        }

        // Fallback to String, String -> void (call)
        mid = env->GetMethodID(cls, "call", "(Ljava/lang/String;Ljava/lang/String;)V");
        if (env->ExceptionCheck()) { env->ExceptionClear(); mid = nullptr; }
        if (mid) {
            std::string arg0 = jsValueToString(ctx, arguments[0]);
            std::string arg1 = jsValueToString(ctx, arguments[1]);
            LOGI("nativeCallback: calling call(String, String) with '%s', '%s'", arg0.c_str(), arg1.c_str());
            jstring jarg0 = env->NewStringUTF(arg0.c_str());
            jstring jarg1 = env->NewStringUTF(arg1.c_str());
            env->CallVoidMethod(javaCallback, mid, jarg0, jarg1);
            env->DeleteLocalRef(jarg0);
            env->DeleteLocalRef(jarg1);
            return JSValueMakeUndefined(ctx);
        }
    }

    return JSValueMakeUndefined(ctx);
}

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_facebook_jsc_wrapper_JSContext_create(JNIEnv* env, jclass clazz) {
    JSGlobalContextRef ctx = JSGlobalContextCreate(nullptr);
    LOGI("JSGlobalContext created: %p", ctx);
    return reinterpret_cast<jlong>(ctx);
}

JNIEXPORT jstring JNICALL
Java_com_facebook_jsc_wrapper_JSContext_evaluateScript(JNIEnv* env, jobject thiz, jstring script, jstring sourceURL) {
    jclass cls = env->GetObjectClass(thiz);
    jfieldID fid = env->GetFieldID(cls, "nativeContext", "J");
    jlong ptr = env->GetLongField(thiz, fid);
    JSGlobalContextRef ctx = reinterpret_cast<JSGlobalContextRef>(ptr);
    if (!ctx) {
        LOGE("No JSGlobalContextRef available");
        return env->NewStringUTF("");
    }

    const char* code = script ? env->GetStringUTFChars(script, nullptr) : "";
    const char* src = sourceURL ? env->GetStringUTFChars(sourceURL, nullptr) : "script.js";

    JSStringRef codeStr = JSStringCreateWithUTF8CString(code);
    JSStringRef srcStr = JSStringCreateWithUTF8CString(src);

    JSValueRef exception = nullptr;
    JSValueRef result = JSEvaluateScript(ctx, codeStr, nullptr, srcStr, 0, &exception);

    JSStringRelease(codeStr);
    JSStringRelease(srcStr);

    if (script) env->ReleaseStringUTFChars(script, code);
    if (sourceURL) env->ReleaseStringUTFChars(sourceURL, src);

    if (exception) {
        JSStringRef exStr = JSValueToStringCopy(ctx, exception, nullptr);
        size_t len = JSStringGetMaximumUTF8CStringSize(exStr);
        char* exMsg = new char[len];
        JSStringGetUTF8CString(exStr, exMsg, len);
        JSStringRelease(exStr);
        LOGE("JS exception: %s", exMsg);
        jstring result = env->NewStringUTF(exMsg);
        delete[] exMsg;
        return result;
    }

    if (result) {
        JSStringRef resStr = JSValueToStringCopy(ctx, result, nullptr);
        size_t len = JSStringGetMaximumUTF8CStringSize(resStr);
        char* out = new char[len];
        JSStringGetUTF8CString(resStr, out, len);
        JSStringRelease(resStr);
        jstring jout = env->NewStringUTF(out);
        delete[] out;
        return jout;
    }

    return env->NewStringUTF("");
}

JNIEXPORT void JNICALL
Java_com_facebook_jsc_wrapper_JSContext_setObjectForKey(JNIEnv* env, jobject thiz, jstring keyStr, jobject callback) {
    jclass cls = env->GetObjectClass(thiz);
    jfieldID fid = env->GetFieldID(cls, "nativeContext", "J");
    jlong ptr = env->GetLongField(thiz, fid);
    JSGlobalContextRef ctx = reinterpret_cast<JSGlobalContextRef>(ptr);
    if (!ctx) {
        LOGE("No JSGlobalContextRef available for setObjectForKey");
        return;
    }

    const char* keyC = env->GetStringUTFChars(keyStr, nullptr);
    JSStringRef jsKey = JSStringCreateWithUTF8CString(keyC);
    
    // Create a JSC function that wraps the Java callback
    static JSClassRef callbackClass = nullptr;
    if (!callbackClass) {
        JSClassDefinition def = kJSClassDefinitionEmpty;
        def.callAsFunction = nativeCallback;
        callbackClass = JSClassCreate(&def);
    }

    jobject globalCallback = env->NewGlobalRef(callback);
    JSObjectRef func = JSObjectMake(ctx, callbackClass, globalCallback);
    
    JSObjectSetProperty(ctx, JSContextGetGlobalObject(ctx), jsKey, func, kJSPropertyAttributeNone, nullptr);
    JSStringRelease(jsKey);
    
    LOGI("setObjectForKey bound key: %s", keyC);
    env->ReleaseStringUTFChars(keyStr, keyC);
}

}
