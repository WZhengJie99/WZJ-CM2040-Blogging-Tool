const express = require('express');
const router = express.Router();

// Middleware to check if user is authenticated
function checkAuth(req, res, next) {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.redirect('/authentication');
    }
}

// Middleware to fetch author's articles and drafts
function fetchAuthorData(req, res, next) {
    const userId = req.session.userId;

    // Fetch articles and drafts
    db.all("SELECT * FROM articles WHERE author_id = ? ORDER BY created_at DESC", [userId], (err, articles) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        db.all("SELECT * FROM draft_articles WHERE author_id = ? ORDER BY created_at DESC", [userId], (err, draft_articles) => {
            if (err) {
                return res.status(500).send(err.message);
            }
            db.get("SELECT * FROM authors WHERE id = ?", [userId], (err, author) => {
                if (err) {
                    return res.status(500).send(err.message);
                }
                db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
                    if (err) {
                        return res.status(500).send(err.message);
                    }
                    req.articles = articles;
                    req.draft_articles = draft_articles;
                    req.author = author;
                    req.user = user; // Make sure to add user to the request object
                    next(); // Call next to proceed to the next middleware or route handler
                });
            });
        });
    });
}

// Routes requiring authentication
router.get('/', checkAuth, fetchAuthorData, (req, res) => {
    res.render('author-home', { articles: req.articles, draft_articles: req.draft_articles, author: req.author, user: req.user });
});

router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.redirect('/authentication'); // Redirect to the login or home page after logout
    });
});

// Settings Page
router.get('/settings', (req, res) => {
    db.get("SELECT * FROM authors WHERE id = ?", [req.session.userId], (err, author) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        res.render('settings', { author });
    });
});

router.post('/settings', (req, res) => {
    const { name, blog_title, blog_subtitle } = req.body;
    db.run("UPDATE authors SET name = ?, blog_title = ?, blog_subtitle = ? WHERE id = ?", [name, blog_title, blog_subtitle, req.session.userId], function (err) {
        if (err) {
            return res.status(500).send(err.message);
        }
        res.redirect('/author/settings');
    });
});

// Delete Article
router.post('/delete/:id', (req, res) => {
    const articleId = req.params.id;

    // Start a transaction
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // Delete comments associated with the article
        const deleteCommentsSql = "DELETE FROM comments WHERE article_id = ?";
        db.run(deleteCommentsSql, [articleId], (err) => {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ success: false, message: err.message });
            }

            // Delete the article
            const deleteArticleSql = "DELETE FROM articles WHERE id = ?";
            db.run(deleteArticleSql, [articleId], function (err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ success: false, message: err.message });
                }

                db.run("COMMIT");
                res.json({ success: true });
            });
        });
    });
});

// Create Draft Article
router.post('/draft-article', (req, res) => {
    const { title, subtitle, content } = req.body;
    const authorSql = "SELECT id FROM authors WHERE id = ?";
    db.get(authorSql, [req.session.userId], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }

        let author_id;
        if (row) {
            author_id = row.id;
        } else {
            const createAuthorSql = "INSERT INTO authors (name, blog_title, blog_subtitle) VALUES (?, ?, ?)";
            const defaultAuthor = [' ', ' ', ' '];
            db.run(createAuthorSql, defaultAuthor, function (err) {
                if (err) {
                    return res.status(500).json({ success: false, message: err.message });
                }
                author_id = this.lastID;
                insertDraftArticle();
            });
            return;
        }

        insertDraftArticle();
        function insertDraftArticle() {
            const sql = `
                INSERT INTO draft_articles (title, subtitle, content, author_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `;
            db.run(sql, [title, subtitle, content, author_id], function (err) {
                if (err) {
                    return res.status(500).json({ success: false, message: err.message });
                }
                const draft_article_id = this.lastID;
                res.redirect(`/author/draft-article/${draft_article_id}`);
            });
        }
    });
});


// Draft Article Page
router.get('/draft-article/:id', (req, res) => {
    const draftArticleId = req.params.id;

    db.get("SELECT * FROM draft_articles WHERE id = ?", [draftArticleId], (err, draft_article) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        if (!draft_article) {
            return res.status(404).send('Draft article not found');
        }
        res.render('draft-article', { draft_article });
    });
});

// Delete Draft Article
router.post('/delete-draft/:id', (req, res) => {
    const draftArticleId = req.params.id;

    db.run("DELETE FROM draft_articles WHERE id = ?", [draftArticleId], function (err) {
        if (err) {
            return res.status(500).send({ success: false, message: err.message });
        }
        res.send({ success: true });
    });
});

// Update Draft Articles - Save Changes
router.post('/edit-draft/:id', (req, res) => {
    const draftArticleId = req.params.id;
    const { title, subtitle, content } = req.body;
    const sql = `
        UPDATE draft_articles 
        SET title = ?, subtitle = ?, content = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `;
    db.run(sql, [title, subtitle, content, draftArticleId], function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        res.redirect(`/author/draft-article/${draftArticleId}`);
    });
});

// Publish Draft Article
router.post('/publish-draft/:id', (req, res) => {
    const draftArticleId = req.params.id;

    // Get the draft article details
    db.get("SELECT * FROM draft_articles WHERE id = ?", [draftArticleId], (err, draftArticle) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        if (!draftArticle) {
            return res.status(404).json({ success: false, message: 'Draft article not found' });
        }

        // Insert the draft article into the articles table
        const insertSql = `
            INSERT INTO articles (title, subtitle, content, created_at, updated_at, author_id, views, likes)
            VALUES (?, ?, ?, ?, ?, ?, 0, 0)
        `;
        db.run(insertSql, [
            draftArticle.title,
            draftArticle.subtitle,
            draftArticle.content,
            draftArticle.created_at,
            draftArticle.updated_at,
            draftArticle.author_id
        ], function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

            // Delete the draft article after publishing
            const deleteSql = "DELETE FROM draft_articles WHERE id = ?";
            db.run(deleteSql, [draftArticleId], function (err) {
                if (err) {
                    return res.status(500).json({ success: false, message: err.message });
                }
                res.json({ success: true });
            });
        });
    });
});

module.exports = router;