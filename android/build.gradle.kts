plugins {
    id("com.android.library")
    id("kotlin-android")
    id("maven-publish")
}

android {
    namespace = "com.clevertree.hooktranspiler"
    compileSdk = 34

    defaultConfig {
        minSdk = 24
        targetSdk = 34

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Configure NDK build
        externalNativeBuild {
            cmake {
                cppFlags += "-std=c++17"
                arguments += listOf(
                    "-DANDROID_PLATFORM=android-24",
                    "-DCMAKE_BUILD_TYPE=Release"
                )
            }
        }

        // Proguard rules
        proguardFiles("consumer-proguard-rules.pro")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = "11"
        freeCompilerArgs = listOf("-opt-in=kotlin.RequiresOptIn")
    }

    // Configure NDK build
    externalNativeBuild {
        cmake {
            path = "CMakeLists.txt"
        }
    }

    // Package native libraries
    packagingOptions {
        resources {
            excludes += listOf(
                "META-INF/MANIFEST.MF",
                "META-INF/*.properties"
            )
        }
        pickFirst("lib/arm64-v8a/libc++_shared.so")
        pickFirst("lib/armeabi-v7a/libc++_shared.so")
        pickFirst("lib/x86/libc++_shared.so")
        pickFirst("lib/x86_64/libc++_shared.so")
    }
}

dependencies {
    // Kotlin
    implementation("org.jetbrains.kotlin:kotlin-stdlib:1.9.20")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // Android
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlin:kotlin-test:1.9.20")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}

// Configure Maven publication
publishing {
    publications {
        register<MavenPublication>("release") {
            groupId = "com.clevertree"
            artifactId = "hook-transpiler-android"
            version = "1.3.9"

            afterEvaluate {
                from(components["release"])
            }

            pom {
                name.set("Hook Transpiler for Android")
                description.set("Native Android implementation of JSX hook transpiler and renderer")
                url.set("https://github.com/clevertree/hook-transpiler")

                licenses {
                    license {
                        name.set("MIT OR Apache-2.0")
                        url.set("https://github.com/clevertree/hook-transpiler/blob/main/LICENSE")
                    }
                }

                developers {
                    developer {
                        id.set("ari")
                        name.set("Ari Asulin")
                    }
                }

                scm {
                    connection.set("scm:git:https://github.com/clevertree/hook-transpiler.git")
                    developerConnection.set("scm:git:ssh://git@github.com/clevertree/hook-transpiler.git")
                    url.set("https://github.com/clevertree/hook-transpiler")
                }
            }
        }
    }

    repositories {
        maven {
            name = "Local"
            url = uri(layout.buildDirectory.dir("repo"))
        }
    }
}

// Task to build and publish locally
tasks.register("publishLocal") {
    dependsOn("publishReleasePublicationToLocalRepository")
}
