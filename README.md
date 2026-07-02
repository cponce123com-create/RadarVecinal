# Radar Vecinal 🚨

![MIT License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-0.0.1-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![PRs](https://img.shields.io/badge/PRs-welcome-orange)

> **Plataforma de seguridad ciudadana y reporte de incidencias para municipalidades.**  
> Vecinos reportan robos, peleas, cortes de agua, alertas de pánico y personas desaparecidas — en tiempo real. El municipio recibe, clasifica y da seguimiento.

![Screenshot](https://via.placeholder.com/800x400?text=Radar+Vecinal+-+Dashboard)

---

## ✨ Características principales

| Funcionalidad | Descripción |
|---------------|-------------|
| 📍 **Reporte ciudadano** | Reporta incidencias con geolocalización, categoría y fotos |
| 🆘 **Alerta de pánico** | Botón de pánico con geolocalización y notificaciones SSE/FCM |
| 👤 **Personas desaparecidas** | Registro y búsqueda de personas extraviadas |
| 📊 **Dashboard municipal** | Estadísticas en tiempo real por distrito |
| 🔔 **Notificaciones push** | Notificaciones FCM para Android |
| 🧑‍💼 **Roles y permisos** | Vecino, moderador, admin, super_admin |
| 🏙️ **Multi-tenant** | Aislamiento total por distrito/municipalidad |
| 📱 **App Android** | Capacitor + React Native |

## 📋 Requisitos

- **Node.js** ≥ 20.x
- **pnpm** ≥ 9.x
- **PostgreSQL** ≥ 15 (Neon recomendado)

## 🚀 Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/radar-vecinal.git
cd radar-vecinal

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con DATABASE_URL, JWT_SECRET, etc.

# 4. Ejecutar migraciones
pnpm --filter @workspace/db run migrate

# 5. Iniciar en desarrollo
pnpm --filter @workspace/api-server run dev
```

## 🔧 Variables de entorno

| Variable | Descripción | Obligatorio |
|----------|-------------|:---:|
| `DATABASE_URL` | Conexión PostgreSQL (Neon) | ✅ |
| `JWT_SECRET` | Secreto para JWT | ✅ |
| `PORT` | Puerto del servidor (3000) | ✅ |
| `NODE_ENV` | `development` o `production` | ✅ |
| `SEED_KEY` | Clave para seed manual en prod | ✅ |
| `REDIS_URL` | Conexión Redis (workers) | Para Tarea 6 |
| `CORS_ORIGIN` | Orígenes CORS permitidos | ❌ |
| `GCS_BUCKET_NAME` | Bucket Google Cloud Storage | ❌ |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | ❌ |

## 🗺️ Despliegue

### Render (recomendado)

1. Crea un servicio **Web Service** en Render
2. Conecta tu repositorio de GitHub
3. Configura:
   - **Build Command**: `./render-build.sh`
   - **Start Command**: `cd artifacts/api-server && node --enable-source-maps ./dist/index.mjs`
4. Añade las variables de entorno desde el panel
5. Usa **Neon** como base de datos PostgreSQL

### Manual

```bash
pnpm run build
NODE_ENV=production DATABASE_URL=... JWT_SECRET=... SEED_KEY=... 
  node --enable-source-maps ./artifacts/api-server/dist/index.mjs
```

## 🤝 Contribución

1. Haz fork del proyecto
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Haz tus cambios y escribe tests
4. Ejecuta `pnpm run typecheck` para verificar tipos
5. Envía un Pull Request

## 🏷️ Tópicos de GitHub sugeridos

> Agrega estos tópicos al repositorio en GitHub > "About" > "Topics":

`civic-tech`, `citizen-reporting`, `panic-alert`, `missing-persons`, `react`, `express`, `postgresql`, `drizzle-orm`, `typescript`, `monorepo`, `pnpm`, `peru`, `municipalidad`, `seguridad-ciudadana`

## 📄 Licencia

MIT
