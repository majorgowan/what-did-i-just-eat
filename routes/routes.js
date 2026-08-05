const express = require("express");
const { nutrients, nutrientOrder } = require("../utils/usda");
const { processText } = require("../utils/pipeline");


const router = express.Router();

router.get("/", async (req, res) => {
    return res.render("index", {
        "csrfToken": req.csrfToken()
    });
});

router.post("/", async (req, res) => {
    const text = req.body.text;

    const summary = await processText(text);

    return res.render("index", {
        "csrfToken": req.csrfToken(),
        "rawText": text,
        "summary": summary,
        "nutrients": nutrients,
        "nutrientOrder": nutrientOrder
    })
    return res.json(summary);
});

module.exports = router;
