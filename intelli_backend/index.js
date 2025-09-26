

// ====================================================================
// INICIO: CAPTURA GLOBAL DE ERRORES
// Poner esto al principio de todo para atrapar cualquier error síncrono o asíncrono durante el arranque.
// ====================================================================
process.on('uncaughtException', (err, origin) => {
    console.error('\n\x1b[31m[FATAL] UNCAUGHT EXCEPTION! El proceso se cerrará.\x1b[0m');
    console.error(`Error: ${err.message}`);
    console.error(`Origen: ${origin}`);
    console.error('Stack: ', err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('\n\x1b[31m[FATAL] UNHANDLED REJECTION! El proceso se cerrará.\x1b[0m');
    console.error('Razón: ', reason);
    // console.error('Promesa: ', promise);
    process.exit(1);
});

// ====================================================================
// FIN: CAPTURA GLOBAL DE ERRORES
// ====================================================================

const { app } = require('./src/app');
const Database = require('./src/database');

const PORT = process.env.PORT || 3000;

console.log(`DEBUG: index.js - PORT set to: ${PORT}`);

// Solo iniciar el servidor si no estamos en modo test
if (process.env.NODE_ENV !== 'test') {
    const server = app.listen(PORT, () => {
        console.log(`\x1b[32m✅ Kargho Chatbot Backend listening on port ${PORT}\x1b[0m`);
        console.log("DEBUG: index.js - Server started and listening.");
    });

    const gracefulShutdown = (signal) => {
        console.log(`\nDEBUG: ${signal} received, shutting down gracefully...`);
        server.close(() => {
            console.log('DEBUG: HTTP server closed.');
            Database.close().then(() => {
                console.log('DEBUG: Database connection closed.');
                process.exit(0);
            }).catch(err => {
                console.error('DEBUG: Error closing database connection:', err);
                process.exit(1);
            });
        });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
