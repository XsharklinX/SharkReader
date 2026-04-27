# Integración con IA

SharkReader incluye un asistente de IA accesible desde el lector mediante un panel lateral. El usuario puede elegir entre varios proveedores de modelos de lenguaje.

---

## Proveedores soportados

| Proveedor     | Modelo por defecto          | Clave de API         |
| ------------- | --------------------------- | -------------------- |
| Groq          | `llama-3.3-70b-versatile`   | `GROQ_API_KEY`       |
| Google Gemini | `gemini-2.0-flash`          | `GEMINI_API_KEY`     |
| OpenRouter    | Configurable por el usuario | `OPENROUTER_API_KEY` |
| xAI (Grok)    | `grok-3-mini`               | `XAI_API_KEY`        |

Las claves se almacenan en `localStorage` y nunca salen del dispositivo del usuario (las peticiones se hacen directamente desde el Renderer al endpoint del proveedor).

---

## Configuración de API

El usuario introduce su clave en Ajustes → IA. La clave se guarda en:

```
localStorage['sharkreader_ai_provider']  // proveedor seleccionado
localStorage['sharkreader_groq_key']
localStorage['sharkreader_gemini_key']
localStorage['sharkreader_openrouter_key']
localStorage['sharkreader_xai_key']
localStorage['sharkreader_openrouter_model']  // modelo custom para OpenRouter
```

---

## Casos de uso del asistente

El panel de IA acepta preguntas en lenguaje natural en el contexto del libro actual:

| Caso                    | Ejemplo de prompt                            |
| ----------------------- | -------------------------------------------- |
| Resumen del capítulo    | "Resume lo que acabo de leer"                |
| Explicación de término  | "¿Qué significa [término] en este contexto?" |
| Análisis de personaje   | "Describe la motivación de [personaje]"      |
| Traducción de fragmento | "Traduce este párrafo al español"            |
| Pregunta abierta        | "¿Cuál es el tema central del libro?"        |

El asistente recibe como contexto el texto visible actual del lector (el contenido renderizado en el iframe de epub.js capturado vía `contentWindow.document.body.innerText`).

---

## Flujo de una petición

```
Usuario escribe mensaje en panel IA
  │
  ├─ Se construye payload:
  │   { model, messages: [{ role: 'system', content: bookContext }, { role: 'user', content: userMsg }] }
  │
  ├─ fetch() al endpoint del proveedor seleccionado
  │   GET/POST con Authorization: Bearer {apiKey}
  │
  └─ Respuesta streamed o completa → renderizada en el panel
```

---

## Seguridad

- Las claves de API se almacenan en `localStorage`. Aunque `webSecurity: false` está activo en el `BrowserWindow` (necesario para cargar archivos locales), las claves nunca se envían a servidores propios de SharkReader.
- Las peticiones van directamente del cliente al proveedor de IA (sin proxy).
- Se recomienda usar claves con límite de uso configurado en el dashboard del proveedor.

---

## Addon futuro: Citas con IA (`smartQuotes`)

Cuando esté disponible, este addon analizará el texto en segundo plano e identificará frases con alto valor literario o emocional, proponiéndolas al usuario como subrayados. Usará el mismo sistema de proveedores descrito en esta sección.
