require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const csrf = require('@dr.pogodin/csurf');
const cookieParser = require("cookie-parser");
const routes = require("./routes/routes");
const { connectToDatabase } = require("./utils/db");
const { handleGlobalError, handleCsrfError, handleMongoError } = require("./routes/errors");

const app = express();

const csrfProtection = csrf({ cookie: true });

app.set("view engine", "ejs");

// parse cookies
app.use(cookieParser(process.env.COOKIE_SECRET));

// wrap startup in IIFE:
(async () => {

    // database instance for session storage
    const {client} = await connectToDatabase(process.env.DB_NAME);

    // Use session-based authentication
    if (process.env.NODE_ENV === "production" || process.env.USE_PROXY === "true") {
        app.set("trust proxy", 1);
    }

    const isSecure = app.get("trust_proxy") === 1;

    app.use(session({
        secret: process.env.COOKIE_SECRET,
        resave: false,
        saveUninitialized: true,
        rolling: true,
        cookie: {
            secure: isSecure,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: true,        // ✅ Highly Recommended (prevents XSS)
            sameSite: "lax"        // ✅ Highly Recommended (prevents CSRF)
        },
        store: MongoStore.create({
            client: client,
            dbName: process.env.DB_NAME,
            collectionName: "sessions",
        })
    }));

    // Parse JSON bodies
    app.use(express.json());

    // Parse form data
    app.use(express.urlencoded({extended: false}));

    // CSRF protection
    app.use(csrfProtection);

    // Expose static files in public folder
    app.use(express.static("public"));

    // Routes
    app.use("/", routes);

    // Error handlers
    app.use(handleCsrfError);
    app.use(handleMongoError);
    app.use(handleGlobalError);

    // Start server
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });

})();
