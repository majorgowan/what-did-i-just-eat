const { searchFoods, lookupFoods, nutrients } = require("./usda");
const { cacheFoods, fetchFoods } = require("./utils");
const { analyze, select } = require("./llm");
const { parseFromLLM } = require("json-llm-repair");


async function parseInput(text) {
    // parse free text and generate series of USDA queries
    console.log(text);
    try {
        const rawResponse = await analyze(text);
        const content = rawResponse.choices[0].message.content;
        const components = parseFromLLM(content, {"mode": "repair"});
        return components;
    } catch (err) {
        if (err.status === 429) {
            console.error(err);
        } else {
            console.error(err);
        }
        return null;
    }
}


async function lookupQueries(queryList) {
    // search USDA database using supplied queries
    // an array of query-result groups
    const groups = []
    for (component of queryList.components) {
        const group = {
            "query": component.query,
            "fdcIds": []
        }
        const dataType = component.branded ? "Branded" : "SR Legacy";
        const data = await searchFoods(component.query, [dataType], component.foodCategory, 10);
        const subLookup = data.foods.map((food) => {
            return {
                "fdcId": food.fdcId,
                "description": food.description,
                "foodCategory": food.foodCategory,
                "dataType": food.dataType,
                "query": component.query
            }
        });
        group.fdcIds = data.foods.map((food) => [food.fdcId, food.description]);
        group.lookup = subLookup;
        groups.push(group);
    }

    return groups;
}


async function refineLookup(text, queryGroups) {
    // select appropriate entries and quantities from USDA query results
    try {
        const rawResponse = await select(text, queryGroups, false);
        const content = rawResponse.choices[0].message.content;
        const refined = parseFromLLM(content, {"mode": "repair"});

        // convert fdcIds string to array of numbers
        for (let ii = 0; ii < refined.fdcItems.length; ii++) {
            refined.fdcItems[ii].fdcIds = refined.fdcItems[ii].fdcIds.split(",").map(Number);
        }

        return refined;

    } catch (err) {
        if (err.status === 429) {
            console.error(err);
        } else {
            console.error(err);
        }
        return null;
    }
}


async function fetchNutrition(fdcIdList) {
    // fetch data from USDA bzw. local cached values
    let nutrition;

    // check local cache
    const { fdcIds: localFdcIds, foods: localFoods } = await fetchFoods(fdcIdList);
    console.log(`Found ${localFdcIds.length} foods locally: ${localFdcIds}`);

    // if there are any not cached, fetch from USDA
    const remainingFdcIds = fdcIdList.filter(item => !(localFdcIds.includes(item)));
    console.log(`Fetching remaining ${remainingFdcIds.length} foods: ${remainingFdcIds}`);
    if (remainingFdcIds.length > 0) {
        const foods = await lookupFoods(remainingFdcIds);
        // cache results in local MongoDB
        const cacheResult = await cacheFoods(foods);
        console.log(cacheResult);
        nutrition = [...localFoods, ...foods];
    } else {
        nutrition = localFoods;
    }
    console.log(`Expected ${fdcIdList.length} items, found ${nutrition.length} items`);

    // sort results by same order as fdcIdList
    return nutrition.sort((a, b) => fdcIdList.indexOf(a.fdcId) - fdcIdList.indexOf(b.fdcId));
}


function summarize(nutrition, items) {
    // scale the nutrients by the portion sizes and produce summary
    const summary = {
        "itemized": [],
        "totals": {}
    };

    for (let ii = 0; ii < items.length; ii++) {
        const portionSize = Number(items[ii].amount_in_grams);
        // get nutrition for this item
        const fdcId = Number(items[ii].fdcIds[0]);
        const nutritionData = nutrition.find(nutritionItem => nutritionItem.fdcId === fdcId);
        const foodNutrientMap = Object.fromEntries(
            nutritionData.foodNutrients.map(({ number, amount }) => {
                // Explicitly use 'amount' which is already per 100g for derived values
                // Do NOT divide by servingSize or multiply by anything
                return [number, amount];
            })
        );
        const itemNutrition = {
            "description": nutritionData.description,
            "amount_in_grams": items[ii].amount_in_grams,
            "fdcId": fdcId
        };
        for (const [nutrientId, nutrient] of Object.entries(nutrients)) {
            if (nutrientId in foodNutrientMap) {
                itemNutrition[nutrientId] = {
                    "name": nutrient.name,
                    "amount": foodNutrientMap[nutrientId],
                    "portionAmount": (portionSize / 100 * foodNutrientMap[nutrientId])
                        .toFixed(nutrient.scale)
                };

                const cleanValue = Number(portionSize / 100 * foodNutrientMap[nutrientId]);
                if (nutrientId in summary.totals) {
                    summary.totals[nutrientId] += cleanValue;
                } else {
                    summary.totals[nutrientId] = cleanValue;
                }
            }
        }
        summary.itemized.push(itemNutrition);
    }

    for (nutrientId in summary.totals) {
        summary.totals[nutrientId] = (summary.totals[nutrientId]).toFixed(nutrients[nutrientId].scale);
    }

    return summary;

}


async function processText(text) {
    const queryList = await parseInput(text);
    // console.log(queryList);
    const queryGroups = await lookupQueries(queryList);
    // console.log(queryGroups);
    const refined = await refineLookup(text, queryGroups);
    // console.log(refined);
    // get list of fdcIds from refined:
    const fdcIdList = refined.fdcItems.flatMap(item => item.fdcIds);
    const nutrition = await fetchNutrition(fdcIdList);
    // console.log(nutrition);
    // TODO: for Foundation foods, formulas for calculating derived quantities like carbs, fibre, etc.

    // restrict queryGroups to the fdcIds in the refined lists
    // console.log(JSON.stringify(queryGroups, null, 2));
    // console.log(fdcIdList);
    const refinedQueryGroups = queryGroups.map(item => ({
        "query": item.query,
        "fdcIds": item.fdcIds.filter(fdcId => fdcIdList.includes(fdcId[0])),
        "lookup": item.lookup.filter(item0 => fdcIdList.includes(item0.fdcId))
    }));

    return {
        "refined": refined,
        "queryGroups": refinedQueryGroups,
        "nutrition": nutrition
    }
}

module.exports = { processText, refineLookup, summarize };