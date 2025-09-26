const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  try {
    // Crear conexión a la base de datos
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kinocsmy_intelichat',
      multipleStatements: true
    });

    console.log('Conectado a la base de datos');

    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, 'migrations', '001_create_forms_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Ejecutando migración...');
    
    // Ejecutar la migración
    await connection.execute(migrationSQL);
    
    console.log('Migración ejecutada exitosamente');
    
    // Verificar que las tablas se crearon
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE '%form%'
    `, [process.env.DB_NAME || 'kinocsmy_intelichat']);
    
    console.log('Tablas de formularios creadas:');
    tables.forEach(table => {
      console.log(`- ${table.TABLE_NAME}`);
    });
    
    // Verificar datos de prueba
    const [forms] = await connection.execute('SELECT id, nombre, descripcion FROM cfg_form');
    console.log('\nFormularios de prueba creados:');
    forms.forEach(form => {
      console.log(`- ID: ${form.id}, Nombre: ${form.nombre}, Descripción: ${form.descripcion}`);
    });
    
    await connection.end();
    console.log('\nMigración completada exitosamente');
    
  } catch (error) {
    console.error('Error ejecutando migración:', error.message);
    process.exit(1);
  }
}

runMigration();