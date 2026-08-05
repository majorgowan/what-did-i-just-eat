const { connectToDatabase, toId } = require("./db");


function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}


async function cacheFoods(foods) {
    // foods is an array of documents
    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);
    const foodsCollection = dbInstance.collection("foods");

    try {

        const result = await foodsCollection.insertMany(
            foods.map(food => ({"_id": food.fdcId, ...food})),
            {
                "ordered": false
            }
        );

        return {
            success: true, // Considered success because valid docs were saved
            insertedCount: result.insertedCount,
            duplicates: 0
        };

    } catch (err) {

        // Check if the error is specifically a duplicate key error
        if (err.code === 11000 || (err.writeErrors && err.writeErrors.every(e => e.code === 11000))) {
            const inserted = err.result ? err.result.insertedCount : 0;
            const duplicates = err.writeErrors ? err.writeErrors.length : 0;

            console.log(`⚠️ Partial Success: Inserted ${inserted} new documents, skipped ${duplicates} duplicates.`);
            // Do NOT re-throw the error if duplicates are expected
            return {
                success: true, // Considered success because valid docs were saved
                insertedCount: inserted,
                duplicates: duplicates
            };
        } else {
            // If it's a network error or something else, re-throw it
            console.error("❌ Critical error:", err.message);
            throw err;
        }

    }
}

async function fetchFoods(fdcIds) {
    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);
    const foodsCollection = dbInstance.collection("foods");

    const foundFoodsArray = await foodsCollection.find(
        {
            "_id": {
                "$in": fdcIds
            }
        }
    ).toArray();

    const foundIds = foundFoodsArray.map(food => food._id);

    return {
        "fdcIds": foundIds,
        "foods": foundFoodsArray
    };
}


module.exports = { fetchFoods, cacheFoods, chunkArray };