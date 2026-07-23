const express = require("express");
const { connectToDatabase, toId } = require("../utils/db");
const { searchFoods, lookupFoods } = require("../utils/usda");
const { analyze } = require("../utils/llm");
const { parseFromLLM } = require("json-llm-repair");
const { processText } = require("../utils/pipeline");


const router = express.Router();

router.get("/", async (req, res) => {
    return res.render("index", {
        "csrfToken": req.csrfToken()
    });
});


router.post("/", async (req, res) => {
    const text = req.body.text;

    const items = await processText(text);

    return res.json(items);
});


router.post("/old", async (req, res) => {
    // get text from form and submit it to Cerebras
    const text = req.body.text;
    req.session.rawText = text;

    console.log(text);
    try {
        const rawResponse = await analyze(text);
        console.log(rawResponse);
        const content = rawResponse.choices[0].message.content;
        console.log(content);
        const processed = parseFromLLM(content, {"mode": "repair"});
        processed.raw = text;
        req.session.processed = processed;
        return res.redirect("/processed");
    } catch (error) {
        if (err.status === 429) {
            console.error(err);
            return res.redirect(`/?retry=true`);
        } else {
            console.error(err);
            return res.redirect("/");
        }
    }
});

router.get("/processed", async (req, res) => {
    return res.render("index", {
        "processed": req.session.processed,
        "rawText": req.session.rawText,
        "csrfToken": req.csrfToken()
    });
});

router.post("/lookup", async (req, res) => {
    const processed = req.session.processed;
    const lookup = [];

    for (component of processed.components) {
        const data = await searchFoods(component.query, ["Foundation", "SR Legacy", "Branded"], 5);
        lookup.push(
            data.foods.map((food) => {
                return {
                    "selected": false,
                    "fdcId": food.fdcId,
                    "description": food.description
                }
            })
        );
        // add an option for none
        lookup.at(-1).push({
            "selected": false,
            "fdcId": "none",
            "description": "leave it out"
        });
        // select the first one initially
        lookup.at(-1)[0].selected = true;
    }

    req.session.lookup = lookup;

    return res.render("index", {
        "lookup": req.session.lookup,
        "processed": req.session.processed,
        "rawText": req.session.rawText,
        "csrfToken": req.csrfToken()
    });
});

router.post("/analyze", async (req, res) => {
    // get list of food Ids from the form
    console.log(req.body);
    // update selected in lookup
    for ([ii, component] of req.session.lookup.entries()) {
        for (food of component) {
            food.selected = (req.body[`food_${ii}`] === `${food.fdcId}`);
        }
    }

    // get stats from USDA
    const selectedFoodIds = Object.entries(req.body).filter(([key, value]) => {
        return key.includes("food") && value !== "none";
    }).map(([key, value]) => {
        return parseInt(value);
    });
    const data = await lookupFoods(selectedFoodIds);
    console.log(data);

    return res.render("index", {
        "lookup": req.session.lookup,
        "processed": req.session.processed,
        "rawText": req.session.rawText,
        "csrfToken": req.csrfToken()
    });
});


module.exports = router;
