const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function setDefaultRAG() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // Verificar si la columna por_defecto existe
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'cfg_rag_cartucho' 
      AND COLUMN_NAME = 'por_defecto'
    `);

    if (columns.length === 0) {
      console.log('Agregando columna por_defecto...');
      await connection.execute(`
        ALTER TABLE cfg_rag_cartucho 
        ADD COLUMN por_defecto TINYINT(1) NOT NULL DEFAULT 0 
        AFTER habilitado
      `);
      console.log('✅ Columna por_defecto agregada exitosamente');
    } else {
      console.log('✅ La columna por_defecto ya existe');
    }

    // Establecer Qdrant Production como por defecto
    await connection.execute(`
      UPDATE cfg_rag_cartucho 
      SET por_defecto = CASE 
        WHEN nombre = 'Qdrant Production' THEN 1 
        ELSE 0 
      END
      WHERE cliente_id = 1
    `);
    
    console.log('✅ Qdrant Production establecido como RAG por defecto');

    // Verificar el resultado
    const [cartuchos] = await connection.execute(`
      SELECT id, nombre, habilitado, por_defecto 
      FROM cfg_rag_cartucho 
      WHERE cliente_id = 1 
      ORDER BY nombre
    `);
    
    console.log('\nCartuchos RAG actualizados:');
    cartuchos.forEach(c => {
      const status = c.habilitado ? 'Activo' : 'Inactivo';
      const isDefault = c.por_defecto ? '⭐ (Por defecto)' : '';
      console.log(`- ${c.nombre}: ${status} ${isDefault}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

setDefaultRAG();