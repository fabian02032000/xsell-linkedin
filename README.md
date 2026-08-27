# Xsell — Prospección LinkedIn (método PACS)

Dashboard en vivo de prospectos y calendario de contenido para la prospección en LinkedIn de Xsell. Se publica automáticamente con GitHub Pages.

## Cómo funciona

- **`data/prospectos.json`** — la lista de prospectos: datos de contacto, señales de intención, dolor detectado, etapa PACS, mensaje borrador y cuenta asignada (Fabián / Ingrid).
- **`data/calendario.json`** — el calendario de contenido de LinkedIn.
- **`index.html`** — la página del dashboard. Lee esos dos archivos JSON directamente (no hay base de datos ni backend) y muestra también el historial real de cambios del repositorio (commits).

Cada vez que se guarda un cambio en cualquiera de los dos archivos JSON, la página se actualiza sola la próxima vez que alguien la abra.

## Cómo editar

**Opción 1 — directo en GitHub (recomendado para cambios rápidos):**
1. Entra al archivo (`data/prospectos.json` o `data/calendario.json`) en este repositorio.
2. Clic en el ícono de lápiz (Edit) arriba a la derecha.
3. Modifica el JSON (respeta las comillas y comas — si algo queda mal formado, GitHub avisa antes de dejarte guardar).
4. Guarda el cambio ("Commit changes…") — eso queda registrado con tu nombre y la hora en el historial de cambios de la página.

**Opción 2 — pidiéndoselo a Claude:**
Dile en el chat qué prospecto agregar, qué mensaje redactar, o qué etapa cambiar, y Claude sube el cambio directo al repositorio.

## Campos de un prospecto

| Campo | Qué es |
|---|---|
| `nombre`, `cargo`, `empresa` | Datos del prospecto |
| `linkedin_url` | Link a su perfil |
| `ultima_publicacion` | Fecha y resumen de su última publicación relevante |
| `publica_activamente` | `true`/`false` — si postea seguido |
| `senales` | Lista de señales de intención (ej. "Búsqueda de personal") |
| `dolor_detectado` | El problema específico que parece tener |
| `etapa` | Etapa del embudo PACS (ver lista abajo) |
| `cuenta` | Qué cuenta va a escribirle — "Fabián" o "Ingrid" |
| `origen` | Quién lo encontró — "Fabián", "Ingrid" o "Claude" |
| `mensaje_borrador` | Borrador del mensaje, editable hasta que se apruebe |
| `listo_para_enviar` | `true`/`false` — marca que el mensaje ya está aprobado para enviarse |
| `proxima_accion` | Qué toca hacer ahora |
| `notas` | Cualquier detalle extra |
| `email` | Correo del prospecto, si se consigue — se usa para no duplicarlo en HubSpot |
| `hubspot_contact_id` / `hubspot_synced_at` | Los llena solo el Action de HubSpot — no editar a mano |

**Etapas posibles:** Identificado → Precalentamiento → Conexión enviada → Mensaje 1 → Conversación → Seguimiento → Reunión agendada → Reunión realizada → Propuesta → Ganado / Perdido / No contactar.

## Calendario de contenido y "Publicaciones subidas"

Cada publicación del calendario (`data/calendario.json`) tiene además:

| Campo | Qué es |
|---|---|
| `publicado_por` | `"Fabián"`, `"Ingrid"` o `null` — quién subió el post a LinkedIn |
| `link_publicacion` | Link al post ya publicado |

**Cruce automático:** en cuanto se marca quién publicó un post (con el lápiz ✎ de esa fila), el `estado` pasa solo a `"Publicado"` y se pinta en verde — no hace falta cambiar el estado a mano también. El bloque "Publicaciones subidas" arriba del calendario resume, por persona, cuántos posts subió cada quien y con qué link.

## Sincronización automática con HubSpot

Cuando un prospecto llega a **"Reunión agendada"** (o una etapa posterior: Reunión realizada, Propuesta, Ganado), un GitHub Action (`.github/workflows/sync-hubspot.yml`) crea automáticamente el Contacto en HubSpot — sin que nadie tenga que hacerlo a mano.

**Qué hace exactamente** (`.github/scripts/sync-hubspot.mjs`):
1. Se dispara solo con cada cambio guardado en `data/prospectos.json`.
2. Busca prospectos en esas etapas que todavía no tengan `hubspot_contact_id`.
3. Crea el Contacto en HubSpot (nombre, empresa, cargo) y una Nota con el link de LinkedIn, el dolor detectado, las señales y el próximo paso.
4. Guarda el `hubspot_contact_id` de vuelta en `data/prospectos.json`, para no duplicar el contacto la próxima vez.

**Para activarlo** (una sola vez):
1. En HubSpot: **Configuración → Integraciones → Apps privadas** → crear una nueva, con permisos `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.objects.notes.write`.
2. Copiar el token que genera.
3. En este repositorio de GitHub: **Settings → Secrets and variables → Actions → New repository secret**, nombre `HUBSPOT_TOKEN`, y pegar el token ahí (no en este archivo ni en el chat).

Si el secret no está configurado, el Action falla de forma visible en la pestaña "Actions" del repositorio — no falla en silencio.

## Importante — envío de mensajes

Este repositorio organiza y da seguimiento a los prospectos, pero **no envía mensajes por LinkedIn automáticamente** — eso viola los términos de uso de LinkedIn y arriesga la cuenta. Cuando un mensaje está `listo_para_enviar: true`, el envío real lo hace una persona (o Claude, usando el navegador, con aprobación explícita en el momento).
