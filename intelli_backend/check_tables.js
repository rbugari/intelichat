const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function checkTables() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ Conectado a la base de datos');

    // Verificar tablas existentes
    const [tables] = await connection.execute('SHOW TABLES LIKE "cfg_%"');
    console.log('📊 Tablas cfg_ existentes:');
    tables.forEach(t => console.log(' -', Object.values(t)[0]));

    // Verificar estructura de cfg_cliente
    try {
      const [clienteStructure] = await connection.execute('DESCRIBE cfg_cliente');
      console.log('\n🏢 Estructura cfg_cliente:');
      clienteStructure.forEach(col => console.log(` - ${col.Field}: ${col.Type}`));
    } catch (error) {
      console.log('\n❌ Error al describir cfg_cliente:', error.message);
    }

    // Verificar estructura de cfg_agente
    try {
      const [agenteStructure] = await connection.execute('DESCRIBE cfg_agente');
      console.log('\n🤖 Estructura cfg_agente:');
      agenteStructure.forEach(col => console.log(` - ${col.Field}: ${col.Type}`));
    } catch (error) {
      console.log('\n❌ Error al describir cfg_agente:', error.message);
    }

    // Verificar tablas ejec_
    const [execTables] = await connection.execute('SHOW TABLES LIKE "ejec_%"');
    console.log('\n💬 Tablas ejec_ existentes:');
    execTables.forEach(t => console.log(' -', Object.values(t)[0]));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

checkTables();