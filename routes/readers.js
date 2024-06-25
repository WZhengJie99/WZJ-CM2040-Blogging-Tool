const express = require('express');
const router = express.Router();

// Reader Home Page
router.get('/', (req, res) => {
    const articlesSql = "SELECT * FROM articles WHERE published_at IS NOT NULL ORDER BY published_at DESC";
    const authorSql = "SELECT * FROM authors LIMIT 1";

    // Use Promise to handle asynchronous operations
    Promise.all([
        new Promise((resolve, reject) => {
            db.all(articlesSql, [], (err, articles) => {
                if (err) reject(err);
                resolve(articles);
            });
        }),
        new Promise((resolve, reject) => {
            db.get(authorSql, (err, author) => {
                if (err) reject(err);
                resolve(author);
            });
        })
    ])
    .then(([articles, author]) => {
        res.render('reader-home', {
            articles,
            author: author || null
        });
    })
    .catch(err => {
        res.status(500).send(err.message);
    });
});

// Article Page
router.get('/article/:id', (req, res) => {
    const articleId = req.params.id;

    const incrementViewsSql = "UPDATE articles SET views = views + 1 WHERE id = ?";
    db.run(incrementViewsSql, [articleId], (err) => {
        if (err) {
            return res.status(500).send(err.message);
        }

        db.get("SELECT * FROM articles WHERE id = ?", [articleId], (err, article) => {
            if (err) {
                return res.status(500).send(err.message);
            }
            if (!article) {
                return res.status(404).send("Article not found");
            }

            db.all("SELECT * FROM comments WHERE article_id = ?", [articleId], (err, comments) => {
                if (err) {
                    return res.status(500).send(err.message);
                }
                res.render('reader-article', { article, comments });
            });
        });
    });
});

// Article Comments
router.post('/article/:id/comment', (req, res) => {
    const articleId = req.params.id;
    const { commenter_name, comment } = req.body;

    // if (!commenter_name || !comment) {
    //     return res.status(400).send('Name and comment are required');
    // }

    const sql = "INSERT INTO comments (article_id, commenter_name, comment, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)";
    db.run(sql, [articleId, commenter_name, comment], function(err) {
        if (err) {
            return res.status(500).send({ success: false, message: err.message });
        }
        res.redirect(`/reader/article/${articleId}`);
    });
});

router.get('/article/:id', (req, res) => {
    const articleId = req.params.id;

    db.get("SELECT * FROM articles WHERE id = ?", [articleId], (err, article) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        if (!article) {
            return res.status(404).send('Article not found');
        }

        db.all("SELECT * FROM comments WHERE article_id = ? ORDER BY created_at DESC", [articleId], (err, comments) => {
            if (err) {
                return res.status(500).send(err.message);
            }
            res.render('article', { article, comments });
        });
    });
});

// Like Article
router.post('/article/:id/like', (req, res) => {
    const articleId = req.params.id;

    const sql = "UPDATE articles SET likes = likes + 1 WHERE id = ?";
    db.run(sql, [articleId], function(err) {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }

        // Retrieve the updated like count
        db.get("SELECT likes FROM articles WHERE id = ?", [articleId], (err, article) => {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
            res.json({ success: true, likes: article.likes });
        });
    });
});

module.exports = router;
