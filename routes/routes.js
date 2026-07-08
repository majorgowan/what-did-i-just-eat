const express = require("express");
const { connectToDatabase, toId } = require("../utils/db");
const { parseFromLLM } = require("json-llm-repair");


const router = express.Router();

router.get("/", async (req, res) => {
    return res.render("index", {
        "method": "get",
        "csrfToken": req.csrfToken()
    });
});

router.post("/", async (req, res) => {
    return res.redirect("/analysis");
});

router.get("/analysis", async (req, res) => {
    return res.render("index", {
        "method": "get",
        "analysis": {"result": 10},
        "csrfToken": req.csrfToken()
    });
});


module.exports = router;
