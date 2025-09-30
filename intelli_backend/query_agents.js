const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

db.all('SELECT id, nombre, descripcion, system_prompt_es FROM cfg_agente WHERE is_active = 1 AND system_prompt_es IS NOT NULL LIMIT 10', (err, rows) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  console.log('=== AGENTES ACTIVOS EN ESPAÑOL ===');
  rows.forEach((row, index) => {
    console.log(`\n--- AGENTE ${index + 1} ---`);
    console.log(`ID: ${row.id}`);
    console.log(`Nombre: ${row.nombre}`);
    console.log(`Descripción: ${row.descripcion}`);
    console.log(`Prompt (primeros 500 chars):`);
    console.log(row.system_prompt_es.substring(0, 500) + '...');
    console.log('---');
  });
  
  db.close();
});