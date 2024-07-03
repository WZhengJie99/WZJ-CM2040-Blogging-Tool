const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const db = global.db;

router.get('/', (req, res) => {
    res.render('author-auth');
});

// Function to hash passwords
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { salt, hash };
}

// Function to validate passwords
function validatePassword(password, hash, salt) {
    const hashVerify = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === hashVerify;
}

// Registration route
router.post('/register', [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { username, password } = req.body;
    const { salt, hash } = hashPassword(password);

    db.run(`INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)`, [username, hash, salt], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(200).json({ message: 'User registered successfully' });
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
