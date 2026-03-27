# 🛍️ BatyGeekStore — E‑commerce MVP con Admin embebido + publicación global (Vercel + Upstash)

[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel&logoColor=white)](https://vercel.com/)
![Stack](https://img.shields.io/badge/Stack-HTML%20%7C%20CSS%20%7C%20Vanilla%20JS-0b0b0e)
![API](https://img.shields.io/badge/API-Vercel%20Functions-1f6feb)
![DB](https://img.shields.io/badge/DB-Upstash%20Redis%20(REST)-d82c20?logo=redis&logoColor=white)
![Images](https://img.shields.io/badge/Media-Cloudinary-3448c5?logo=cloudinary&logoColor=white)

E‑commerce “sin framework” (SPA por hash) pensado para **vender rápido**: catálogo personalizable + “Diseños de la casa” (carrusel), carrito, checkout y generación de pedido por WhatsApp. Incluye un **panel Admin dentro de la misma web** para cargar diseños y precios y **publicarlos globalmente** con Vercel + Upstash (Redis REST).

---

## 📌 Tabla de contenidos

- [El problema](#-el-problema)
- [La solución](#-la-solución)
- [Demo y capturas](#-demo-y-capturas)
- [Arquitectura](#-arquitectura)
- [Instalación](#-instalación)
- [Uso](#-uso)
- [Configuración](#-configuración)
- [Rendimiento](#-rendimiento)
- [Roadmap](#-roadmap)
- [Contribuir](#-contribuir)
- [Créditos](#-créditos)

---

## ❓ El problema

Muchos MVPs de e‑commerce fallan por lo mismo:

- 🧩 Dependen de un backend grande “para arrancar”.
- 🧠 El dueño necesita cargar diseños/precios, pero no quiere tocar código.
- 🌍 Los cambios deben verse “para todos” (no solo en un navegador).
- 📩 El canal real de cierre suele ser WhatsApp, no un checkout con pago integrado.

**Objetivo**: un e‑commerce simple, publicable en Vercel, que permita vender ya y actualizar contenidos sin fricción.

---

## ✅ La solución

Este repo resuelve el problema con una arquitectura mínima:

- ⚡ SPA por hash: todo el flujo de compra en un solo frontend (HTML/CSS/JS).
- 🧑‍💼 Admin embebido: carga diseños + precios + delivery sin tocar código.
- 🌐 Publicación global: el Admin publica a `/api/store` para que los clientes vean lo mismo.
- 🖼️ Imágenes: subida directa a Cloudinary desde el Admin.
- 🧾 Pedido por WhatsApp: mensaje armado con datos completos (incluye ID del diseño de la casa).

---

## 🆕 Novedades de esta iteración (Marzo 2026)

Esta versión cierra una etapa completa de mejoras funcionales, seguridad y diseño visual.

### 1) Endurecimiento del backend (Fase 2)

- ✅ Validación estricta de payload en API de publicación.
- ✅ Límite de tamaño de body (1 MB) para evitar cargas excesivas.
- ✅ Límite de cantidad de diseños publicados (máximo 200).
- ✅ Sanitización de diseños y precios antes de guardar o devolver datos.
- ✅ Respuestas HTTP claras por tipo de error:
  - 400 para datos inválidos
  - 413 para payload demasiado grande

Resultado: publicación más segura y estable, con menor riesgo de datos corruptos.

### 2) Modularización y seguridad de admin (Fase 3)

- ✅ Se extrajeron constantes y datos del catálogo a un módulo dedicado.
- ✅ Se centralizó configuración en una sola fuente de verdad.
- ✅ El acceso admin dejó de depender de parámetros en URL.
- ✅ Se migró sesión admin a sessionStorage.
- ✅ Se eliminó fallback inseguro de clave en código.

Resultado: código más mantenible y modelo de acceso admin más seguro.

### 3) Refresh visual y branding

- ✅ Rebranding completo de BatyStore a BatyGeekStore.
- ✅ Fondo global artístico con imágenes Akira y transiciones suaves.
- ✅ Hero visual renovado con mejor contraste.
- ✅ Panels de resumen personalizados con alto impacto visual.
- ✅ Footer temático ajustado para desktop y mobile.

Resultado: estética más distintiva, coherente y con identidad de marca.

### 4) Ajustes responsive y experiencia mobile

- ✅ Correcciones de layout para evitar contenido amontonado.
- ✅ Mejoras de formularios en pantallas chicas (campos más usables al tacto).
- ✅ Ajustes de scroll al entrar a personalización para llevar al usuario al punto correcto.
- ✅ Ajustes iterativos de encuadre de fondo y footer para mejorar legibilidad.
- ✅ Footer anclado al pie para que no “flote” en páginas cortas.

Resultado: navegación más cómoda y predecible en celulares.

---

## 🧪 Problemas reales y cómo los resolvimos

### Problema: publicación con riesgo de datos inválidos

Cómo se resolvió:
- Se incorporaron funciones de sanitización por dominio (diseños, pricing, shipping).
- Se forzaron tipos y rangos válidos para cada campo.
- Se aplicaron límites de tamaño y cantidad.

### Problema: acceso admin expuesto o frágil

Cómo se resolvió:
- Se separó la clave real de entorno en Vercel.
- Se validó sesión local contra la clave configurada en el navegador.
- Se eliminó el uso de query params para autenticación.

### Problema: contraste y legibilidad sobre fondos artísticos

Cómo se resolvió:
- Se reforzó contraste con overlays y sombras de texto.
- Se hicieron ajustes finos por breakpoint.
- Se calibró el footer para que imagen y texto convivan sin perder lectura.

### Problema: saltos incómodos en mobile

Cómo se resolvió:
- Se ajustaron media queries en bloques críticos.
- Se mejoraron alineaciones, spacing y tamaño de targets táctiles.
- Se revisó el flujo visual entre personalización, resumen y checkout.

---

## 📦 Estado actual del proyecto

- ✅ Listo para deploy automático en Vercel desde GitHub.
- ✅ API preparada para publicar y leer estado global de tienda.
- ✅ UI web y mobile ajustada con foco en legibilidad y branding.
- ✅ Estructura modular preparada para próximas iteraciones.

---

## 🎥 Demo y capturas

- Demo (Vercel): `https://TU_DOMINIO`  
- Endpoint de datos publicados: `https://TU_DOMINIO/api/store`

Capturas sugeridas para este README:
- Home (hero + carrusel)
- Pantalla de “Diseño de la casa” (talle + color fijo)
- Producto personalizable (cambio de material modifica precio)
- Admin (diseños + precios + publicar)

Tip: guardá las imágenes en `docs/` y linkealas así:

```md
![Home](docs/home.png)
```

---

## 🧱 Arquitectura

### Componentes

- **Frontend**
  - `index.html`: shell (header/nav) + `<div id="app">`
  - `styles.css`: tema y componentes
  - `app.js`: lógica completa (router, vistas, handlers, carrito, checkout, admin)
  - `app-data.js`: configuración centralizada, catálogo, pricing base y constantes
- **Backend (Vercel Function)**
  - `api/store.js`: lectura/escritura global a Upstash Redis REST con validación y sanitización de payload

### Diagrama (alto nivel)

```mermaid
flowchart LR
  U[👤 Cliente] -->|Navega SPA #/| FE[🌐 Frontend (index.html + app.js)]
  A[🧑‍💼 Admin] -->|Publicar| FE
  FE -->|POST /api/store (x-admin-key)| API[⚙️ Vercel Function /api/store]
  FE -->|GET /api/store| API
  API -->|Upstash REST| KV[(🗄️ Upstash Redis)]
  FE -->|Upload| CLD[(🖼️ Cloudinary)]
  FE -->|Mensaje armado| WA[💬 WhatsApp]
```

### Archivos clave

| Archivo | Rol |
|---|---|
| `index.html` | Layout base, navegación, carga del módulo principal |
| `styles.css` | Tema (tokens) + UI (paneles, cards, carrusel, admin) |
| `app.js` | Router SPA + vistas + lógica de negocio |
| `api/store.js` | API de publicación global (GET/POST) a Upstash |

---

## 🧩 Desafíos técnicos resueltos

- 🗃️ **Publicación global sin backend complejo**: Upstash Redis REST vía Vercel Functions.
- 🔐 **Protección del Admin**: llave `ADMIN_KEY` en header `x-admin-key`.
- 🖼️ **Subida de imágenes sin servidor propio**: Cloudinary unsigned preset.
- 🧭 **SPA sin framework**: router por hash, render + attach handlers por vista.
- 🧮 **Precios dinámicos**:
  - Remera: precio base depende del material (peinado vs 100%).
  - Estampas: extra por ubicación/tamaño.
  - Delivery: etiqueta + costo configurable desde Admin.
- 🧷 **Carrusel usable**: drag con mouse, wheel, botones, auto-scroll (pausa por interacción y respeta “reducir movimiento”).

---

## 🛠️ Instalación

### Requisitos

- Cuenta de **Vercel**
- **Upstash for Redis** (vía Storage en Vercel)
- Cuenta de **Cloudinary** (para subir imágenes desde Admin)

### 1) Deploy en Vercel

1. Subí el repo a GitHub.
2. Vercel → New Project → importá el repo.
3. Deploy.

### 2) Crear y conectar Upstash Redis (Storage)

1. Vercel → Project → Storage
2. Crear **Upstash for Redis**
3. Conectar la DB al proyecto

### 3) Variables de entorno (Production)

Vercel → Project → Settings → Environment Variables (**Production**):

- `ADMIN_KEY` = tu clave
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Luego: **Redeploy**.

### 4) Verificación rápida

Abrí:

- `https://TU_DOMINIO/api/store`

Deberías ver `meta.kvConfigured = true`.

---

## ▶️ Uso

### Como cliente

1. Entrá a Home (`#/`)
2. Elegí:
   - 🏠 **Diseño de la casa** (carrusel) → elegís talle → se agrega al carrito
   - o ✨ **Personalizable** → elegís material/ubicación → se agrega al carrito
3. Carrito (`#/carrito`) → checkout (`#/checkout`)
4. Se genera el pedido y se arma el mensaje de WhatsApp

### Como admin

1. Configuración (`#/config`):
   - Cloudinary (cloud name + preset unsigned + folder)
   - Admin key (debe coincidir con `ADMIN_KEY` de Vercel)
2. Admin (`#/admin`) → cargar:
   - Diseños de la casa
   - Precios (remera por material, buzo, gorra)
   - Delivery y estampas
3. Click en **Publicar** (esto es lo que lo hace global)

---

## ⚙️ Configuración

### Cloudinary

Se requiere un **Upload Preset unsigned** para subir imágenes desde el navegador.

### Upstash / Vercel KV

La API `api/store.js` soporta estos nombres de env vars:
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (preferido)
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` (alternativo)

### Admin key

- En Vercel: `ADMIN_KEY`
- En la web: `#/config` (se guarda en el navegador)
- Para publicar: header `x-admin-key` debe coincidir

---

## 🚀 Rendimiento

Este repo está pensado para ser liviano (sin bundlers ni dependencias).

Cómo medir (recomendado):

- Lighthouse (Chrome DevTools) en el deploy de Vercel:
  - Performance
  - Accessibility
  - Best Practices
- Verificar:
  - Lazy loading de imágenes en carrusel
  - Videos con `preload="metadata"` y control por visibilidad

---

## 🧭 Roadmap

- [ ] Persistir pedidos en backend (hoy viven en localStorage del cliente)
- [ ] Autenticación real para Admin (hoy es key + header)
- [ ] Inventario/stock y variantes avanzadas
- [ ] Integración de pagos (Mercado Pago / Stripe)
- [ ] Export/Panel de pedidos para el negocio
- [ ] SEO avanzado (migración a framework si se necesita)

---

## 🤝 Contribuir

Contribuciones son bienvenidas.

1. Fork del repo
2. Branch: `feat/mi-cambio`
3. PR con descripción clara y capturas si aplica

Guías:
- Mantener estilo “vanilla” (sin dependencias salvo necesidad real).
- Evitar exponer secretos.
- Preferir cambios pequeños y comprobables.

---

## 🧾 Créditos

Laruzo (David Saboredo)

