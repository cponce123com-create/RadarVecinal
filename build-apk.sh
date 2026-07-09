#!/bin/bash
set -e

echo "🚀 Generando APK de Radar Vecinal..."
echo ""

# Paso 1: Construir web app
echo "📦 [1/3] Compilando web app..."
cd /home/user/almacen/artifacts/radar-vecinal
pnpm build

# Paso 2: Sincronizar Capacitor
echo "🔗 [2/3] Sincronizando con Capacitor..."
cd /home/user/almacen
npx cap sync

# Paso 3: Generar APK
echo "📱 [3/3] Generando APK..."
export JAVA_HOME=/nix/store/ggwpsfi1mzfc610a30k54q4k2isz7013-openjdk-21.0.9+10/lib/openjdk
export ANDROID_HOME=/nix/store/nibdn1wppjp3gqw1z3y14s291r8r9rhn-androidsdk/libexec/android-sdk
cd /home/user/almacen/android
./gradlew assembleDebug

echo ""
echo "✅ APK generado en:"
echo "   /home/user/almacen/android/app/build/outputs/apk/debug/app-debug.apk"
