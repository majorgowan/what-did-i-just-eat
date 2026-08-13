const Cerebras = require("@cerebras/cerebras_cloud_sdk");
const { Groq } = require("groq-sdk");
const jsonToMarkdown = require("json-to-markdown-table");
const { foodCategories } = require("./usda");

let llmClient;
let llmModel;
if (process.env.AI_PLATFORM === "groq") {
    llmClient = new Groq({
        "apiKey": process.env.GROQ_API_KEY,
    });
    llmModel = process.env.GROQ_MODEL;
} else {
    llmClient = new Cerebras({
        "apiKey": process.env.CEREBRAS_API_KEY,
        "maxRetries": 8
    });
    llmModel = process.env.CEREBRAS_MODEL;
}


async function askLlm(content, response_format = null, temperature = 0.1, max_completion_tokens = 2048) {
    try {
        const response = await llmClient.chat.completions.create({
            model: llmModel,
            max_completion_tokens: max_completion_tokens,
            temperature: temperature,
            stream: false,
            response_format: response_format,
            reasoning_effort: "medium",
            messages: [
                {
                    role: "user",
                    content: content
                }
            ]
        });

        return response;

    } catch (error) {
        console.error("Error: ", error.status, error.name, error.message);
        throw error;
    }
}


async function analyze(text, verbose=false) {
    // generate the content for asking cerebras

    const prompt = `
        Please process the following text representing a MEAL or DRINK OR SNACK:
        
        ==================
        ${text}
        ==================
        
        Convert the text into a LIST OF QUERY STRINGS designed to submit to the USDA FoodData Central API
        to retrieve nutritional information about the meal.
        
        For each query specify a FOOD CATEGORY from the following list: ${foodCategories}.
        
        For each query specify and AMOUNT in the most natural or typical UNIT for that item
        - the unit must be one of: ['g', 'ml', 'pieces']
        
        For each query specify whether it describes a BRANDED item (like "Kellogg's Corn Flakes").
        
        The USDA API will return foods matching words in the query even if the words only represent ingredients or
        non-essential elements of the food, so please be very explicit: specify characteristics 
        of the most likely item even if not mentioned in the text.
        
        If a word is absolutely essential to the query put a '+' before the word (without a space) to guarantee the USDA API will match it.
        Use the '+' for the defining word in the query (like 'apple' or 'bread' or 'oats') but not to descriptors (e.g. 'granny smith +apple').
        
        Note that each query is INDEPENDENT, so include all useful information in each query, for example: 
        a meal of 'beef hot dog on white roll' might be broken down into 'beef frankfurter sausage' and 'white bread hot dog roll or bun'
        
        The response must strictly follow the provided JSON schema.  
        
    `;

    const response_format = {
        "type": "json_schema",
        "json_schema": {
            "name": "querylist",
            "schema": {
                "type": "object",
                "properties": {
                    "components": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "amount": {
                                    "type": "number"
                                },
                                "unit": {
                                    "type": "string",
                                    "enum": ["g", "ml", "pieces"]
                                },
                                "query": {
                                    "type": "string"
                                },
                                "foodCategory": {
                                    "type": "string",
                                    "enum": foodCategories
                                },
                                "branded": {
                                    "type": "boolean"
                                }
                            },
                            "required": ["amount", "unit", "query", "foodCategory", "branded"],
                            "additionalProperties": false
                        },
                    },
                },
                "required": ["components"],
                "additionalProperties": false
            },
            "strict": true
        }
    };

    if (verbose) console.log(prompt);

    return await askLlm(prompt, response_format);
}


async function select(text, queryGroups, verbose=false) {
    // process the USDA query results

    let lookupTablesString = "";
    for (const queryGroup of queryGroups) {
       lookupTablesString += jsonToMarkdown(queryGroup.lookup, Object.keys(queryGroup.lookup[0]));
       lookupTablesString += "\n\n";
    }
    console.log(lookupTablesString);

    const prompt = `
        The following is a text describing a MEAL or DRINK or SNACK:
        
        ==================
        ${text}
        ==================
        
        The text was used to generate a LIST OF QUERY STRINGS designed to submit to the USDA FoodData Central API.
        
        The following tables summarize the query results from the USDA API:
        
        ${lookupTablesString}
        
        The first column in each table represents the item id (fdcId) for the corresponding item.
        
        For each table, provide a COMMA-DELIMITED LIST of (up to) 3 of the item ids (fdcIds)
        for the 3 ITEMS MOST LIKELY TO MATCH THE FOOD DESCRIBED IN THE ORIGINAL TEXT.
        
        The list of fdcIds should be IN ORDER FROM THE MOST LIKELY TO THE LEAST LIKELY MATCH.
        
        Also, for each distinct query, estimate the AMOUNT IN GRAMS of the described food item.
        
        The response must follow the provided JSON schema.  Include the original query string from the table.
    `;

    const response_format = {
        "type": "json_schema",
        "json_schema": {
            "name": "selected",
            "schema": {
                "type": "object",
                "properties": {
                    "fdcItems": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "fdcIds": {
                                    "type": "string"
                                },
                                "query": {
                                    "type": "string"
                                },
                                "amount_in_grams": {
                                    "type": "number"
                                }
                            },
                            "required": ["fdcIds", "query", "amount_in_grams"],
                            "additionalProperties": false
                        },
                    },
                },
                "required": ["fdcItems"],
                "additionalProperties": false
            },
            "strict": true
        }
    };

    if (verbose) console.log(prompt);

    return await askLlm(prompt, response_format, 0.1, 4096);
}


module.exports = { analyze, select };
