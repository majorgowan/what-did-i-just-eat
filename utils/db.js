const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const MONGO_USER = process.env.MONGO_USER;
const MONGO_PASS = process.env.MONGO_PASS;
const MONGO_SRV = process.env.MONGO_SRV;
const MONGO_APP = process.env.MONGO_APP;
const mongo_uri = `mongodb+srv://${MONGO_USER}:${MONGO_PASS}@${MONGO_SRV}/?appName=${MONGO_APP}`;

// Ensure crypto is available globally
if (!global.crypto) {
    global.crypto = require("crypto");
}
let dbInstance = null;
let client = null;

// function to connect to database
async function connectToDatabase(dbname) {
    if (client && dbInstance) {
        return { client, dbInstance }
    }

    try {
        client = new MongoClient(mongo_uri, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            },
            family: 4,
            connectTimeoutMS: 60000,
            serverSelectionTimeoutMS: 60000
        });
        await client.connect();
        dbInstance = client.db(dbname);
        console.log(`Connected to Database: ${dbname}`);

        // Register shutdown handler only once
        if (!global.isShutDownRegistered) {
            global.isShutDownRegistered = true;

            const shutdown = async (signal) => {
                console.log(`\n${signal} received, closing MongoDB...`);
                try {
                    await client.close();
                    console.log("MongoDB connection closed.");
                } catch (err) {
                    console.error("Error closing MongoDB connection.", err);
                } finally {
                    process.exit(0);
                }
            };
            process.once("SIGINT", () => shutdown("SIGINT"));
            process.once("SIGTERM", () => shutdown("SIGTERM"));

        }

        return { client, dbInstance }

    } catch (err) {
        console.error('Database connection failed:', error);
        process.exit(1);
    }
}

async function closeConnection() {
    if (client) {
        await client.close();
    }
}

function toId(s) {
    return new ObjectId(s);
}

module.exports = { connectToDatabase, closeConnection, toId };
