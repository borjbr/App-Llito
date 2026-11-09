-- Datos: citas médicas de Carmen (octubre-noviembre 2026) y un plan de prueba para el 10 de noviembre.
-- Solo se insertan en el hogar que tiene una hija llamada Carmen y no se duplican si ya existen.
-- Se crean como no sincronizadas: suben a Google Calendar en la siguiente sincronización de la agenda.
INSERT INTO evento (id, hogar_id, tipo, titulo, fecha, todo_el_dia, hora_inicio, inicio, repeticion, ubicacion, notas, hijo_id, recordatorios, sincronizado)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-a' || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))), h.hogar_id, 'cita_medica', 'Neurología', '2026-10-15', 0, '11:30', 1792056600000, 'ninguna', 'Pozuelo', NULL, h.id, '', 0
FROM hijo h
WHERE lower(h.nombre) = 'carmen'
  AND NOT EXISTS (SELECT 1 FROM evento e WHERE e.hogar_id = h.hogar_id AND e.fecha = '2026-10-15' AND e.hora_inicio = '11:30' AND e.titulo = 'Neurología');
--> statement-breakpoint
INSERT INTO evento (id, hogar_id, tipo, titulo, fecha, todo_el_dia, hora_inicio, inicio, repeticion, ubicacion, notas, hijo_id, recordatorios, sincronizado)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-a' || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))), h.hogar_id, 'vacuna', 'Vacuna bronquiolitis', '2026-10-15', 0, '17:24', 1792077840000, 'ninguna', 'Hospital La Paz', NULL, h.id, '', 0
FROM hijo h
WHERE lower(h.nombre) = 'carmen'
  AND NOT EXISTS (SELECT 1 FROM evento e WHERE e.hogar_id = h.hogar_id AND e.fecha = '2026-10-15' AND e.hora_inicio = '17:24' AND e.titulo = 'Vacuna bronquiolitis');
--> statement-breakpoint
INSERT INTO evento (id, hogar_id, tipo, titulo, fecha, todo_el_dia, hora_inicio, inicio, repeticion, ubicacion, notas, hijo_id, recordatorios, sincronizado)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-a' || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))), h.hogar_id, 'cita_medica', 'Pediatra', '2026-10-19', 0, '17:40', 1792424400000, 'ninguna', 'Pozuelo', NULL, h.id, '', 0
FROM hijo h
WHERE lower(h.nombre) = 'carmen'
  AND NOT EXISTS (SELECT 1 FROM evento e WHERE e.hogar_id = h.hogar_id AND e.fecha = '2026-10-19' AND e.hora_inicio = '17:40' AND e.titulo = 'Pediatra');
--> statement-breakpoint
INSERT INTO evento (id, hogar_id, tipo, titulo, fecha, todo_el_dia, hora_inicio, inicio, repeticion, ubicacion, notas, hijo_id, recordatorios, sincronizado)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-a' || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))), h.hogar_id, 'cita_medica', 'Neurología', '2026-10-23', 0, '14:00', 1792756800000, 'ninguna', 'Hospital Virgen del Mar', NULL, h.id, '', 0
FROM hijo h
WHERE lower(h.nombre) = 'carmen'
  AND NOT EXISTS (SELECT 1 FROM evento e WHERE e.hogar_id = h.hogar_id AND e.fecha = '2026-10-23' AND e.hora_inicio = '14:00' AND e.titulo = 'Neurología');
--> statement-breakpoint
INSERT INTO evento (id, hogar_id, tipo, titulo, fecha, todo_el_dia, hora_inicio, inicio, repeticion, ubicacion, notas, hijo_id, recordatorios, sincronizado)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-a' || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))), h.hogar_id, 'cita_medica', 'Neurocirugía', '2026-10-29', 0, '09:00', 1793260800000, 'ninguna', 'Hospital 12 de Octubre', NULL, h.id, '', 0
FROM hijo h
WHERE lower(h.nombre) = 'carmen'
  AND NOT EXISTS (SELECT 1 FROM evento e WHERE e.hogar_id = h.hogar_id AND e.fecha = '2026-10-29' AND e.hora_inicio = '09:00' AND e.titulo = 'Neurocirugía');
--> statement-breakpoint
INSERT INTO evento (id, hogar_id, tipo, titulo, fecha, todo_el_dia, hora_inicio, inicio, repeticion, ubicacion, notas, hijo_id, recordatorios, sincronizado)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-a' || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))), h.hogar_id, 'vacuna', 'Vacunas de los 6 meses', '2026-11-03', 0, '16:45', 1793720700000, 'ninguna', 'CS CEA', NULL, h.id, '', 0
FROM hijo h
WHERE lower(h.nombre) = 'carmen'
  AND NOT EXISTS (SELECT 1 FROM evento e WHERE e.hogar_id = h.hogar_id AND e.fecha = '2026-11-03' AND e.hora_inicio = '16:45' AND e.titulo = 'Vacunas de los 6 meses');
--> statement-breakpoint
INSERT INTO evento (id, hogar_id, tipo, titulo, fecha, todo_el_dia, hora_inicio, inicio, repeticion, ubicacion, notas, hijo_id, recordatorios, sincronizado)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-a' || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))), h.hogar_id, 'cita_medica', 'Pediatra: revisión de los 6 meses', '2026-11-04', 0, '09:30', 1793781000000, 'ninguna', 'CS CEA', 'Comprar vacunas', h.id, '', 0
FROM hijo h
WHERE lower(h.nombre) = 'carmen'
  AND NOT EXISTS (SELECT 1 FROM evento e WHERE e.hogar_id = h.hogar_id AND e.fecha = '2026-11-04' AND e.hora_inicio = '09:30' AND e.titulo = 'Pediatra: revisión de los 6 meses');
--> statement-breakpoint
INSERT INTO evento (id, hogar_id, tipo, titulo, fecha, todo_el_dia, hora_inicio, inicio, repeticion, ubicacion, notas, hijo_id, recordatorios, sincronizado)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-a' || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))), h.hogar_id, 'cita_medica', 'Neurología', '2026-11-17', 0, '11:00', 1794909600000, 'ninguna', 'Quirón', NULL, h.id, '1440,60', 0
FROM hijo h
WHERE lower(h.nombre) = 'carmen'
  AND NOT EXISTS (SELECT 1 FROM evento e WHERE e.hogar_id = h.hogar_id AND e.fecha = '2026-11-17' AND e.hora_inicio = '11:00' AND e.titulo = 'Neurología');
--> statement-breakpoint
INSERT INTO evento (id, hogar_id, tipo, titulo, fecha, todo_el_dia, hora_inicio, inicio, repeticion, ubicacion, notas, hijo_id, recordatorios, sincronizado)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-a' || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))), h.hogar_id, 'evento', 'Plan de prueba: paseo por el Retiro', '2026-11-10', 0, '18:00', 1794330000000, 'ninguna', 'Parque del Retiro', 'Evento de prueba para ver el aviso en Inicio. Puedes borrarlo.', NULL, '60', 0
FROM hijo h
WHERE lower(h.nombre) = 'carmen'
  AND NOT EXISTS (SELECT 1 FROM evento e WHERE e.hogar_id = h.hogar_id AND e.fecha = '2026-11-10' AND e.hora_inicio = '18:00' AND e.titulo = 'Plan de prueba: paseo por el Retiro');
