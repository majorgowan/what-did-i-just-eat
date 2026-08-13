const { chuckArray, chunkArray} = require("./utils");


const searchUrl = `${process.env.USDA_API_URL}foods/search?api_key=${process.env.USDA_API_KEY}`;
const foodsUrl = `${process.env.USDA_API_URL}foods/?api_key=${process.env.USDA_API_KEY}`;


const nutrients = {
    "208": {"name": "kcal", "scale": 0, "detailLevel": 1}, // energy (kcal)
    "203": {"name": "protein (g)", "scale": 1, "detailLevel": 1}, // protein (g)
    "204": {"name": "fat (g)", "scale": 1, "detailLevel": 1}, // total fat (g)
    "291": {"name": "fibre (g)", "scale": 1, "detailLevel": 1}, // total dietary fibre (g)
    "205": {"name": "carbohydrates (g)", "scale": 0, "detailLevel": 1}, // carbohydrates (g)
    "269": {"name": "sugar (g)", "scale": 1, "detailLevel": 1}, // total sugar (g)
    "307": {"name": "sodium (mg)", "scale": 0, "detailLevel": 1}, // sodium (mg)
    "601": {"name": "cholesterol (mg)", "scale": 0, "detailLevel": 1}, // cholesterol (mg)
    "209": {"name": "starch (g)", "scale": 1, "detailLevel": 2}, // starch (g)
    "301": {"name": "calcium (mg)", "scale": 0, "detailLevel": 2}, // calcium (mg)
    "303": {"name": "iron (mg)", "scale": 1, "detailLevel": 2}, // iron (mg)
    "306": {"name": "potassium (mg)", "scale": 0, "detailLevel": 2}, // potassium (mg)
    "401": {"name": "Vitamin C (mg)", "scale": 1, "detailLevel": 2}, // Vitamin C (mg)
    "606": {"name": "saturated fat (g)", "scale": 1, "detailLevel": 2}, // total saturated fat (g)
    "605": {"name": "trans fat (g)", "scale": 1, "detailLevel": 2} // trans fat (g)
};

const foodCategories = [
    "Dairy and Egg Products",
    "Cereal Grains and Pasta",
    "Baked Products",
    "Legumes and Legume Products",
    "Beef Products",
    "Pork Products",
    "Poultry Products",
    "Lamb, Veal, and Game Products",
    "Finfish and Shellfish Products",
    "Fruits and Fruit Juices",
    "Vegetables and Vegetable Products",
    "Nut and Seed Products",
    "Sweets",
    "Fats and Oils",
    "Spices and Herbs",
    "Beverages",
    "Baby Foods",
    "Fast Foods",
    "Meals, Entrees, and Side Dishes",
    "Soups, Sauces, and Gravies",
    "American Indian/Alaska Native Foods"
]


const nutrientOrder = ["208", "203", "204", "291", "205", "269", "307", "601",
                               "209", "301", "303", "306", "401", "606", "605"];

async function searchFoods(query, dataType=["Foundation"], foodCategory=null, number=3) {
    try {

        const reqObj = {
            "query": query,
            "dataType": dataType,
            "pageSize": number
        };
        if (foodCategory !== null) {
            reqObj.foodCategory = foodCategory;
        }
        const reqBody = JSON.stringify(reqObj);

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

async function lookupBatch(fdcIds) {
    try {
        const reqBody = JSON.stringify({
            "fdcIds": fdcIds,
            "nutrients": Object.keys(nutrients),
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


async function lookupFoods(fdcIds) {
    // batch the fdcIds into groups of 18 (limit on USDA API is 20)
    const fdcIdBatches = chunkArray(fdcIds, 18);
    let data = [];

    for (const fdcIdBatch of fdcIdBatches) {
        const batch = await lookupBatch(fdcIdBatch);
        data = [...data, ...batch];
    }
    return data;
}


module.exports = { searchFoods, lookupFoods, foodCategories, nutrients, nutrientOrder };