#!/usr/bin/env bash
#
# build-apk.sh — genera el APK de depuración de Radar Vecinal (Capacitor).
#
# Requisitos en la máquina donde se ejecuta:
#   - Node + pnpm
#   - JDK 17+ (java en el PATH o JAVA_HOME)
#   - Android SDK con ANDROID_HOME/ANDROID_SDK_ROOT apuntando a él
#     (instálalo con Android Studio o el command-line tools de Android)
#
# NOTA: no puede correr en entornos sin acceso a los servidores de Google
# (dl.google.com / maven.google.com), que es de donde se descargan el SDK y el
# plugin de Gradle de Android. Para eso usa el workflow de GitHub Actions
# (.github/workflows/android.yml), que compila el APK en la nube.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "📦 [1/4] Compilando la web app…"
( cd artifacts/radar-vecinal && pnpm exec vite build )

echo "📱 [2/4] Preparando la plataforma Android…"
if [ ! -d android ]; then
  npx cap add android
fi

echo "🔗 [3/4] Sincronizando Capacitor…"
npx cap sync android

echo "🤖 [4/4] Generando el APK (assembleDebug)…"
: "${ANDROID_HOME:=${ANDROID_SDK_ROOT:-}}"
if [ -z "${ANDROID_HOME}" ]; then
  echo "❌ Falta el Android SDK: define ANDROID_HOME (o ANDROID_SDK_ROOT)." >&2
  echo "   Instala Android Studio o el command-line tools, o usa el workflow de CI." >&2
  exit 1
fi
export ANDROID_HOME ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
( cd android && ./gradlew assembleDebug --no-daemon )

APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "✅ APK generado en:"
echo "   $APK"
