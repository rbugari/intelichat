const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkRAGCartridges() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('=== CARTUCHOS RAG EN LA BASE DE DATOS ===');
    const [rows] = await connection.execute('SELECT id, nombre, dominio_tag, proveedor, habilitado FROM cfg_rag_cartucho ORDER BY nombre');
    
    rows.forEach(row => {
      console.log(`ID: ${row.id}, Nombre: ${row.nombre}, Dominio: ${row.dominio_tag}, Proveedor: ${row.proveedor}, Habilitado: ${row.habilitado}`);
    });
    
    console.log('\n=== ASOCIACIONES AGENTE-RAG ===');
    const [assoc] = await connection.execute(`
      SELECT arc.agente_id, rc.nombre, rc.habilitado 
      FROM cfg_agente_rag_cartucho arc 
      JOIN cfg_rag_cartucho rc ON arc.cartucho_id = rc.id 
      ORDER BY arc.agente_id, rc.nombre
    `);
    
    assoc.forEach(row => {
      console.log(`Agente: ${row.agente_id}, Cartucho: ${row.nombre}, Habilitado: ${row.habilitado}`);
    });
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkRAGCartridges();