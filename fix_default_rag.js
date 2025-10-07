const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

(async () => {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('Verificando campo por_defecto en cfg_rag_cartucho:');
        const [rows] = await connection.execute('SELECT id, nombre, por_defecto FROM cfg_rag_cartucho WHERE cliente_id = 1');
        console.table(rows);

        console.log('\nActualizando Qdrant Production como por defecto:');
        await connection.execute('UPDATE cfg_rag_cartucho SET por_defecto = 0 WHERE cliente_id = 1');
        await connection.execute('UPDATE cfg_rag_cartucho SET por_defecto = 1 WHERE id = 10 AND cliente_id = 1');

        console.log('\nVerificando después de la actualización:');
        const [updatedRows] = await connection.execute('SELECT id, nombre, por_defecto FROM cfg_rag_cartucho WHERE cliente_id = 1');
        console.table(updatedRows);

        await connection.end();
        console.log('\n✅ Actualización completada');
    } catch (error) {
        console.error('❌ Error:', error);
    }
})();