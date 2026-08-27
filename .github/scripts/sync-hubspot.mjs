// Crea un Contacto en HubSpot para cada prospecto que llegó a etapa de "cliente potencial"
// (Reunión agendada en adelante), o que tenga hubspot_solicitud_manual: true (botón "Crear
// en HubSpot ahora" del dashboard) — y todavía no tenga hubspot_contact_id.
// Se ejecuta automáticamente vía GitHub Actions en cada push a data/prospectos.json.

import { readFileSync, writeFileSync } from "node:fs";

const TOKEN = process.env.HUBSPOT_TOKEN;
const DATA_PATH = "data/prospectos.json";
const HS_API = "https://api.hubapi.com";

// Etapas del embudo Xsell/PACS que cuentan como "cliente potencial" para HubSpot.
const SYNC_STAGES = ["Reunión agendada", "Reunión realizada", "Propuesta", "Ganado"];

if (!TOKEN) {
  console.error("Falta el secret HUBSPOT_TOKEN en el repositorio (Settings → Secrets and variables → Actions).");
  process.exit(1);
}

function splitName(nombre) {
  const parts = (nombre || "").trim().split(/\s+/);
  return { firstname: parts[0] || "", lastname: parts.slice(1).join(" ") || "" };
}

async function hsFetch(path, options = {}) {
  const res = await fetch(HS_API + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HubSpot ${options.method || "GET"} ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function findExistingContact(p) {
  const filters = p.email
    ? [{ propertyName: "email", operator: "EQ", value: p.email }]
    : null;
  if (!filters) return null;
  const result = await hsFetch("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({ filterGroups: [{ filters }], limit: 1 }),
  });
  return result?.results?.[0]?.id || null;
}

async function createContact(p) {
  const { firstname, lastname } = splitName(p.nombre);
  const properties = {
    firstname,
    lastname,
    company: p.empresa || "",
    jobtitle: p.cargo || "",
    lifecyclestage: "opportunity",
  };
  if (p.email) properties.email = p.email;
  const created = await hsFetch("/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties }),
  });
  return created.id;
}

async function addNote(contactId, p) {
  const lines = [
    `Prospecto creado automáticamente desde el Embudo de Prospección LinkedIn (Xsell — método PACS).`,
    p.linkedin_url ? `LinkedIn: ${p.linkedin_url}` : null,
    p.dolor_detectado ? `Dolor detectado: ${p.dolor_detectado}` : null,
    p.senales?.length ? `Señales: ${p.senales.join(", ")}` : null,
    p.proxima_accion ? `Próxima acción: ${p.proxima_accion}` : null,
    p.cuenta ? `Cuenta que lo está trabajando: ${p.cuenta}` : null,
    p.mensaje_borrador ? `Último mensaje: ${p.mensaje_borrador}` : null,
  ].filter(Boolean);

  const note = await hsFetch("/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_timestamp: Date.now(),
        hs_note_body: lines.join("\n"),
      },
    }),
  });
  // Asociación por defecto nota→contacto (HubSpot resuelve el tipo de asociación correcto).
  await hsFetch(`/crm/v4/objects/notes/${note.id}/associations/default/contacts/${contactId}`, {
    method: "PUT",
  });
  return note?.id;
}

async function main() {
  const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  const prospectos = data.prospectos || [];
  let changed = false;

  for (const p of prospectos) {
    const manual = !!p.hubspot_solicitud_manual;
    if (!SYNC_STAGES.includes(p.etapa) && !manual) continue;
    if (p.hubspot_contact_id) continue; // ya sincronizado

    console.log(`→ Sincronizando a ${p.nombre} (${p.etapa}${manual ? ", pedido manual" : ""})…`);
    try {
      let contactId = await findExistingContact(p);
      let isNew = false;
      if (contactId) {
        console.log(`  ya existía en HubSpot como contacto ${contactId}`);
      } else {
        contactId = await createContact(p);
        isNew = true;
        console.log(`  contacto creado: ${contactId}`);
      }
      p.hubspot_contact_id = contactId;
      p.hubspot_synced_at = new Date().toISOString().slice(0, 10);
      if (manual) delete p.hubspot_solicitud_manual;
      changed = true;

      if (isNew) {
        try {
          await addNote(contactId, p);
        } catch (noteErr) {
          console.error(`  el contacto se creó pero la nota falló: ${noteErr.message}`);
        }
      }
    } catch (err) {
      console.error(`  error al sincronizar a ${p.nombre}: ${err.message}`);
      // sigue con el resto — no se detiene todo el batch por un prospecto
    }
  }

  if (changed) {
    writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n");
    console.log("data/prospectos.json actualizado con los IDs de HubSpot.");
  } else {
    console.log("Nada nuevo que sincronizar.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
