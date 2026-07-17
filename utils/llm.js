const Cerebras = require("@cerebras/cerebras_cloud_sdk");
const { Groq } = require("groq-sdk");

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
        
        Be very explicit with the query: specify characteristics of the most likely item (e.g. for butter, specify DAIRY and SALTED)
        
        The response should follow the provided JSON schema.  Specify the most natural or typical UNIT for each amount.
        
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
                                }
                            },
                            "required": ["amount", "unit", "query"],
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


module.exports = { analyze };
