const searchUrl = `${process.env.USDA_API_URL}foods/search?api_key=${process.env.USDA_API_KEY}`;
const foodsUrl = `${process.env.USDA_API_URL}foods/?api_key=${process.env.USDA_API_KEY}`;

async function searchFoods(query, dataType=["Foundation"], number=3) {
    try {

        const reqBody = JSON.stringify({
            "query": query,
            "dataType": dataType,
            "pageSize": number
        });
        console.log(reqBody);

        const stream = await fetch(searchUrl, {
            "method": "POST",
            "headers": {
                "Content-Type": "application/json",
            },
            "body": reqBody
        });

        return await stream.json();

    } catch (error) {
        console.error("Fetch error:", error);
    }
}

async function lookupFoods(fdcIds) {

    const nutrients = [
        "208", // energy (kcal)
        "203", // protein (g)
        "204", // total fat (g)
        "606", // total saturated fat (g)
        "605", // trans fat (g)
        "601", // cholesterol (mg)
        "956", // carbohydrates (g)
        "291", // total dietary fibre (g)
        "269", // total sugar (g)
        "209", // starch (g)
        "301", // calcium (mg)
        "303", // iron (mg)
        "306", // potassium (mg)
        "307", // sodium (mg)
        "401" // Vitamin C (mg)
    ];

    try {
        const reqBody = JSON.stringify({
           "fdcIds": fdcIds,
           "nutrients": nutrients,
           "format": "abridged"
        });
        console.log(reqBody);

        const stream = await fetch(foodsUrl, {
            "method": "POST",
            "headers": {
                "Content-Type": "application/json"
            },
            "body": reqBody
        });

        return await stream.json();

    } catch (error) {
        console.error("Fetch error:", error);
    }
}


module.exports = { searchFoods, lookupFoods };