const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('Conexion a la base de datos exitosa');

    // Verificar estructura de la tabla
    const [structure] = await connection.execute('DESCRIBE cfg_rag_cartucho');
    console.log('Estructura de la tabla cfg_rag_cartucho:');
    structure.forEach(col => {
      console.log('  ' + col.Field + ': ' + col.Type + ' ' + (col.Null === 'YES' ? '(NULL)' : '(NOT NULL)') + ' ' + (col.Default !== null ? 'DEFAULT ' + col.Default : ''));
    });

    // Verificar datos actuales
    const [rows] = await connection.execute('SELECT * FROM cfg_rag_cartucho ORDER BY cliente_id, id');
    console.log('Datos actuales en cfg_rag_cartucho:');
    console.table(rows);

    // Verificar específicamente el campo por_defecto
    const [defaultCheck] = await connection.execute('SELECT id, nombre, cliente_id, por_defecto FROM cfg_rag_cartucho WHERE por_defecto = 1');
    console.log('Cartuchos marcados como por defecto:');
    console.table(defaultCheck);

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkDatabase();