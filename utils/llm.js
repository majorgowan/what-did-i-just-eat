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
        
        For each query also specify a FOOD CATEGORY from the following list: ${foodCategories}.
        
        Be very explicit with the query: specify characteristics of the most likely item (e.g. for butter, specify 'dairy' and 'salted)
        
        If a word is essential to the query put a '+' before the word (without a space) to guarantee the USDA API will match it.
        
        If a sequence of words must occur together for semantic reasons, enclose the sequence in double quotes ("rolled oats").
        
        Note that each query is INDEPENDENT, so include all useful information in each query, for example: 
        a meal of 'beef hot dog on white roll' might be broken down into 'beef frankfurter sausage' and 'white bread hot dog roll or bun'
        
        The response should follow the provided JSON schema.  Specify the most natural or typical UNIT for each amount (one of 'g', 'ml', 'pieces').
        
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
                                }
                            },
                            "required": ["amount", "unit", "query", "foodCategory"],
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


async function select(text, lookup, verbose=false) {
    // process the USDA query results

    let lookupTableString = jsonToMarkdown(lookup, Object.keys(lookup[0]));
    console.log(lookupTableString);

    const prompt = `
        The following is a text describing a MEAL or DRINK or SNACK:
        
        ==================
        ${text}
        ==================
        
        The text was used to generate a LIST OF QUERY STRINGS designed to submit to the USDA FoodData Central API.
        
        The following table summarizes the query results from the USDA API:
        
        ${lookupTableString}
        
        Please select from the query results a list of item ids (fdcId), descriptions (description), and amounts in grams that BEST REPRESENTS THE TEXT. 
        
        In general select one item for each query string but if there are redundancies in the search results, pick only the best match.
        
        All else being equal, prefer items with more complete nutritional data (numberOfNutrients) and more recent publication date.
        
        All else being equal, prefer generic items (e.g. with dataType 'SR Legacy') to branded items (dataType 'Branded') unless the query specified a brand name.
        
        Emphasize the nutritional characteristic of the item over the form, for example 'white bread' is more representative of a 'white bread roll' than a 'whole wheat roll'.
        
        The response should follow the provided JSON schema.  Include the original query string and description from the input table.
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
                                "fdcId": {
                                    "type": "number"
                                },
                                "query": {
                                    "type": "string"
                                },
                                "description": {
                                    "type": "string"
                                },
                                "amount_in_grams": {
                                    "type": "number"
                                }
                            },
                            "required": ["fdcId", "query", "description", "amount_in_grams"],
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

    return await askLlm(prompt, response_format);
}


module.exports = { analyze, select };
