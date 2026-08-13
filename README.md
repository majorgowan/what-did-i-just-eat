## What did I just eat??

AI-powered nutritional analyzer

- enter meal description using natural language
- fetch nutritional information from USDA FoodData Central API

#### Tools and services used

- `Node.js` with `express.js` web server framework
- `MongoDB` for database back-end (session and query caching)
- `EJS` for html templating
- [`groq`](https://groq.com/) for generative AI

#### Deployment

- Requires API keys configured in `.env` file for `USDA` and `groq`.

Deployed at https://what-did-i-just-eat-8d7be02f4ff9.herokuapp.com/

###### by Mark Fruman `mark@fruman.ca`
