/**
* index.js
* This is your main app entry point
* Editted by Wong Zheng Jie
*/

// Set up express, bodyparser and EJS
const express = require('express');
const app = express();
const port = 3000;
const path = require('path');
const session = require('express-session');
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs'); // set the app to use ejs for rendering
app.use(express.static(__dirname + '/public')); // set location of static files

// Set up SQLite
// Items in the global namespace are accessible throughout the node application
const sqlite3 = require('sqlite3').verbose();
global.db = new sqlite3.Database('./database.db', function(err) {
    if (err) {
        console.error(err);
        process.exit(1); // bail out we can't connect to the DB
    } else {
        console.log("Database connected");
        global.db.run("PRAGMA foreign_keys=ON"); // tell SQLite to pay attention to foreign key constraints
    }
});

// Session management
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Handle requests to the home page 
app.get('/', (req, res) => {
    const userLoggedIn = req.session.userId ? true : false;
    res.render('home', { userLoggedIn });
});

// Author Routes
const authorRoutes = require('./routes/author');
app.use('/author', authorRoutes);

// Reader Routes
const readerRoutes = require('./routes/readers');
app.use('/reader', readerRoutes);

// Add all the route handlers in usersRoutes to the app under the path /users
const usersRoutes = require('./routes/users');
app.use('/users', usersRoutes);

// Authentication Routes
const authRoutes = require('./routes/authentication');
app.use('/authentication', authRoutes);

// Make the web application listen for HTTP requests
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
