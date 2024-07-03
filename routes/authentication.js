const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const sqlite3 = require('sqlite3').verbose();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { salt, hash };
}

function validatePassword(password, hash, salt) {
    const hashVerify = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === hashVerify;
}

const { salt, hash } = hashPassword('Admin1');
db.serialize(() => {
    // Check if 'Admin1' already exists
    db.get(`SELECT * FROM users WHERE username = 'Admin1'`, [], (err, existingUser) => {
        if (err) {
            return console.error(err.message);
        }
        // If 'Admin1' already exists, do nothing
        if (existingUser) {
            return;
        }
        // If 'Admin1' does not exist, insert the new user
        db.run(`INSERT INTO users (username, email, password_hash, salt) VALUES (?, ?, ?, ?)`, 
            ['Admin1', 'Admin1@gmail.com', hash, salt], function(err) {
            if (err) {
                return console.error(err.message);
            }
        });
    });
});

router.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/author');
    } else {
        res.render('author-auth');
    }
});

// Registration route
router.post('/register', [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { username, email, password } = req.body;

    // Check if the email or username already exists
    db.get(`SELECT * FROM users WHERE email = ? OR username = ?`, [email, username], (err, existingUser) => {
        if (err) {
            return res.status(500).json({ error: 'Database error 1' });
        }
        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            if (existingUser.username === username) {
                return res.status(400).json({ error: 'Username already exists' });
            }
        }

        // If email and username do not exist, proceed with user creation
        const { salt, hash } = hashPassword(password);
        db.run(`INSERT INTO users (username, email, password_hash, salt) VALUES (?, ?, ?, ?)`, 
            [username, email, hash, salt], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error 2' });
            }

            // Insert a blank author entry
            db.run(`INSERT INTO authors (name, blog_title, blog_subtitle) VALUES (?, ?, ?)`, 
                ['', '', ''], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Database error 3' });
                }
                res.status(200).json({ message: 'User registered successfully' });
            });
        });
    });
});

// Login route
router.post('/login', [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { username, password } = req.body;

    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }
        const isValid = validatePassword(password, user.password_hash, user.salt);
        if (!isValid) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }
        req.session.userId = user.id;
        res.status(200).json({ message: 'User logged in successfully', redirectUrl: '/author/home' });
    });
});

module.exports = router;
