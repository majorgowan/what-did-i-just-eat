const { connectToDatabase, toId } = require("./db");
const { searchFoods, lookupFoods } = require("./usda");
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
    // TODO: do separate queries for ["Foundation", "SR Legacy"] (up to 5 items) and "Branded" (up to 5 items) and concatenate results
    const lookup = [];
    for (component of queryList.components) {
        const data = await searchFoods(component.query, ["Foundation", "SR Legacy", "Branded"], 8);
        lookup.push(
            data.foods.map((food) => {
                return {
                    "fdcId": food.fdcId,
                    "description": food.description,
                    "category": food.foodCategory,
                    "dataType": food.dataType,
                }
            })
        );
    }

    return lookup;
}


async function refineLookup(text, queryList, lookup) {
    // select appropriate entries and quantities from USDA query results

    // flatten the lookup results into a single array of objects
    const flatLookup = [];
    for (let ii = 0; ii < queryList.components.length; ii++) {
        for (const item of lookup[ii]) {
            flatLookup.push({
                ...item,
                "query": queryList.components[ii].query
            });
        }
    }

    try {
        const rawResponse = await select(text, flatLookup, false);
        const content = rawResponse.choices[0].message.content;
        const refined = parseFromLLM(content, {"mode": "repair"});
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


async function fetchNutrition(items) {
    // fetch data from USDA bzw. local cached values
    const fdcIdList = items.map((item) => item.fdcId);
    const nutrition = await lookupFoods(fdcIdList);
    return nutrition;
}


async function processText(text) {
    const queryList = await parseInput(text);
    console.log(queryList);
    const lookup = await lookupQueries(queryList);
    console.log(lookup);
    const refined = await refineLookup(text, queryList, lookup);
    console.log(refined);
    const nutrition = await fetchNutrition(refined.fdcItems);
    console.log(nutrition);

    return nutrition;
}

module.exports = { processText };