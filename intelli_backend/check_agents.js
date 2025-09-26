const Database = require('./src/database');

async function checkAgents() {
  try {
    // Inicializar la base de datos
    await Database.initialize();
    
    const rows = await Database.query('SELECT id, nombre, color, descripcion FROM cfg_agente WHERE chatbot_id = 2 AND is_active = 1');
    console.log('Agentes encontrados:');
    rows.forEach(row => {
      console.log(`ID: ${row.id}, Nombre: ${row.nombre}, Color: ${row.color || 'SIN COLOR'}, Descripción: ${row.descripcion}`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkAgents();