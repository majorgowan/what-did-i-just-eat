// catch CSRF errors
const handleCsrfError = (error, req, res, next) => {
    if (error.code === "EBADCSRFTOKEN") {
        // For AJAX requests, send JSON
        if (req.xhr || req.headers.accept?.includes("application/json")) {
            return res.status(403).json(
                {
                    "error": "CSRF token expired",
                    "message": "Please refresh the page"
                }
            );
        }
        // For regular form submissions, render an error or redirect
        console.log(error);
        req.session.savedForm = req.body;
        return res.redirect(req.get("Referrer") || "/");
    }
    // Pass other errors to the default handler
    next(error);
};

const handleMongoError = (error, req, res, next) => {
    if (error.name === "MongoNetworkError") {
        return res.status(503).send("Database is currently unavailable.");
    }
    next(error);
};

const handleGlobalError = (error, req, res, next) => {
    console.error(error);
    const returnTo = req.get("Referrer") || "/";
    res.redirect(returnTo);
};

module.exports = { handleCsrfError, handleMongoError, handleGlobalError };
