const express = require("express");
const { nutrients, nutrientOrder } = require("../utils/usda");
const { processText, refineLookup, summarize } = require("../utils/pipeline");


const router = express.Router();

router.get("/", async (req, res) => {
    return res.render("index", {
        "csrfToken": req.csrfToken()
    });
});


router.post("/", async (req, res) => {
    const text = req.body.text;
    req.session.text = text;

    // get nutritional data for all alternative items
    const { refined, queryGroups, nutrition } = await processText(text);
    req.session.nutrition = nutrition;
    req.session.queryGroups = queryGroups;

    // console.log(queryGroups);

    // build data table for display (apply selection, scale nutrients by amounts)
    const summary = await summarize(nutrition, refined.fdcItems);
    // console.log(JSON.stringify(summary, null, 2));

    return res.render("index", {
        "csrfToken": req.csrfToken(),
        "rawText": text,
        "summary": summary,
        "queryGroups": queryGroups,
        "nutrients": nutrients,
        "nutrientOrder": nutrientOrder
    })
});


router.post("/refresh", async (req, res) => {
    const text = req.session.text;

    const foodRows = req.body.foodRows;

    console.log(foodRows);

    // get nutrition data from session
    const nutrition = req.session.nutrition;
    const queryGroups = req.session.queryGroups;

    // get selection from the form body
    const refined = {
        "fdcItems": foodRows.map(foodRow => ({
            "fdcIds": [Number(foodRow.select)],
            "amount_in_grams": Number(foodRow.amount)
        }))
    };

    // console.log(JSON.stringify(refined, null, 2));

    // build data table for display (apply selection, scale nutrients by amounts)
    const summary = await summarize(nutrition, refined.fdcItems);
    // console.log(JSON.stringify(summary, null, 2));

    return res.render("index", {
        "csrfToken": req.csrfToken(),
        "rawText": text,
        "summary": summary,
        "queryGroups": queryGroups,
        "nutrients": nutrients,
        "nutrientOrder": nutrientOrder
    })
});

module.exports = router;
