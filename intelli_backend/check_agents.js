const Database = require('./src/database');

async function checkAgents() {
  try {
    // Inicializar la base de datos
    await Database.initialize();
    
    const rows = await Database.query(`
      SELECT id, nombre, descripcion, 
             SUBSTR(system_prompt_es, 1, 400) as prompt_preview 
      FROM cfg_agente 
      WHERE is_active = 1 AND system_prompt_es IS NOT NULL 
      LIMIT 8
    `);
    
    console.log('=== AGENTES ACTIVOS EN ESPAÑOL ===\n');
    
    rows.forEach((row, i) => {
      console.log(`--- AGENTE ${i+1} ---`);
      console.log(`ID: ${row.id}`);
      console.log(`Nombre: ${row.nombre}`);
      console.log(`Descripción: ${row.descripcion || 'Sin descripción'}`);
      console.log(`Prompt (primeros 400 chars):`);
      console.log(`${row.prompt_preview}...`);
      console.log('---\n');
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkAgents();