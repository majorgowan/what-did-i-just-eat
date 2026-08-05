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
    // return a flattened array of all results for all queries
    let lookup = [];
    for (component of queryList.components) {
        const subLookup = []
        for (const dataType of [["SR Legacy"], ["Branded"]]) {
            const number = (dataType === "Branded") ? 2 : 4;
            const data = await searchFoods(component.query, dataType, number);
            subLookup.push(
                data.foods.map((food) => {
                    return {
                        "fdcId": food.fdcId,
                        "description": food.description,
                        "category": food.foodCategory,
                        "dataType": food.dataType,
                        "query": component.query
                    }
                })
            );
        }
        lookup = [...lookup, ...subLookup.flat()];
    }

    return lookup;
}


async function refineLookup(text, lookup) {
    // select appropriate entries and quantities from USDA query results
    try {
        const rawResponse = await select(text, lookup, false);
        const content = rawResponse.choices[0].message.content;
        const refined = parseFromLLM(content, {"mode": "repair"});

        // add in alternates for each selected item
        refined.fdcItems = refined.fdcItems.map(item => ({
            ...item,
            "alternates": lookup
                .filter(lookupItem => lookupItem.query === item.query)
                .map(lookupItem => ({
                    "fdcId": lookupItem.fdcId,
                    "description": lookupItem.description
                }))
        }));

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
    const summary = {};

    for (let ii = 0; ii < items.length; ii++) {
        const portionSize = Number(items[ii].amount_in_grams);
        // get nutrition for this item
        const nutritionData = nutrition.find(nutritionItem => nutritionItem.fdcId === items[ii].fdcId);
        const foodNutrientMap = Object.fromEntries(
            nutritionData.foodNutrients.map(({ number, amount }) => {
                // Explicitly use 'amount' which is already per 100g for derived values
                // Do NOT divide by servingSize or multiply by anything
                return [number, amount];
            })
        );
        const itemNutrition = {
            "description": items[ii].description,
            "amount_in_grams": items[ii].amount_in_grams,
            "fdcId": items[ii].fdcId,
            "alternates": items[ii].alternates
        };
        for (const [nutrientId, nutrient] of Object.entries(nutrients)) {
            if (nutrientId in foodNutrientMap) {
                itemNutrition[nutrientId] = {
                    "name": nutrient.name,
                    "amount": foodNutrientMap[nutrientId],
                    "portionAmount": (portionSize / 100 * foodNutrientMap[nutrientId])
                        .toFixed(nutrient.scale)
                };
            }
        }
        summary[items[ii].fdcId] = itemNutrition;
    }

    return summary;

}


async function processText(text) {
    const queryList = await parseInput(text);
    console.log(queryList);
    const lookup = await lookupQueries(queryList);
    console.log(lookup);
    const nutrition = await fetchNutrition(lookup.map(item => item.fdcId));
    console.log(nutrition);
    // TODO: fetch nutrition for all candidates
    //       - extract long list of fdcIds (from array of arrays in "lookup")
    //       - refactor refineLookup so that groq uses more information to refine items list (such as completeness)
    //       - also will let user change the items interactively
    //       - remember the API can accept up to 20 fdcId values per request, so implement batching
    //       - and caching in mongo!!
    // TODO: for Foundation foods, formulas for calculating derived quantities like carbs, fibre, etc.
    // enhance lookup with some data from nutrition query
    const enhancedLookup = lookup.map((item, index) => ({
        ...item,
        "numberOfNutrients": nutrition[index].foodNutrients.length,
        "publicationDate": nutrition[index].publicationDate
    }));
    const refined = await refineLookup(text, enhancedLookup);
    console.log(JSON.stringify(refined, null, 2));
    const summary = await summarize(nutrition, refined.fdcItems);
    console.log(JSON.stringify(summary, null, 2));

    return summary;
}

module.exports = { processText };