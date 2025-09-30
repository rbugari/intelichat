const db = require('./src/database');

async function queryAgents() {
  try {
    // Inicializar la base de datos
    await db.initialize();
    
    const query = `
      SELECT id, nombre, descripcion, 
             SUBSTRING(system_prompt_es, 1, 200) as prompt_preview
      FROM cfg_agente 
      WHERE is_active = 1 AND idioma = 'es'
      ORDER BY id
      LIMIT 5
    `;
    const agents = await db.query(query);
    console.log('=== AGENTES DISPONIBLES ===');
    agents.forEach(agent => {
      console.log(`ID: ${agent.id}`);
      console.log(`Nombre: ${agent.nombre}`);
      console.log(`Descripción: ${agent.descripcion || 'Sin descripción'}`);
      console.log(`Prompt (preview): ${agent.prompt_preview}...`);
      console.log('---');
    });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

queryAgents();