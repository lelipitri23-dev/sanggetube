require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const slugify = require('slugify');
const NodeCache = require('node-cache');

// Import Model & Utils
const Video = require('./models/Video');
const Cosplay = require('./models/Cosplay');
const { isoToSeconds, formatDuration } = require('./utils/helpers'); 
const { uploadFromUrl } = require('./utils/r2Storage');

const app = express();
const myCache = new NodeCache({ stdTTL: 600 });

// ==========================================
// 1. DATABASE CONNECTION
// ==========================================
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/RumahBokep')
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ==========================================
// 2. CONFIGURATION & MIDDLEWARE
// ==========================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'SangeTube-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 } // 1 Jam
}));




// --- CACHE HELPER MIDDLEWARE ---
// Fungsi untuk mem-bypass database jika data ada di memori
const cacheMiddleware = (duration) => (req, res, next) => {
    // Skip cache jika user login (admin) atau bukan method GET
    if (req.session.isLoggedIn || req.method !== 'GET') {
        return next();
    }

    const key = '__express__' + req.originalUrl || req.url;
    const cachedBody = myCache.get(key);

    if (cachedBody) {
        return res.send(cachedBody);
    } else {
        res.sendResponse = res.send;
        res.send = (body) => {
            myCache.set(key, body, duration);
            res.sendResponse(body);
        };
        next();
    }
};

// ==========================================
// 3. GLOBAL SEO & VARIABLES MIDDLEWARE
// ==========================================
app.use((req, res, next) => {
    res.locals.worker_url = process.env.WORKER_URL || 'https://cosplay.gratisanwibu.workers.dev';
    const site_url = process.env.SITE_URL || 'http://localhost:3000';
    const site_name = "SangeTube";
    res.locals.site_url = site_url;
    res.locals.site_name = site_name;
    res.locals.logo_url = `${site_url}/uploads/logo.png`; // Fallback logo
    res.locals.favicon_url = `${site_url}/uploads/favicon.ico`;
    
    // Default SEO Values
    res.locals.current_title = `${site_name} - Streaming Video Bokep Terbaru`;
    res.locals.current_desc = `Nonton Bokep Terbaru 2025. SangeTube adalah situs Bokep, Bokep Indo, Bokep Jepang, bokep bocil, bokep viral terlengkap dan terupdate. ${site_name}.`;
    res.locals.current_image = `${site_url}/uploads/default-poster.jpg`;
    res.locals.current_url = `${site_url}${req.originalUrl}`;
    
    // Default Robots & OG
    res.locals.robots_meta = "index, follow";
    res.locals.og_type = "website";
    res.locals.formatDuration = (sec) => {
        if (!sec) return "00:00";
        const date = new Date(0);
        date.setSeconds(sec);
        return sec > 3600 ? date.toISOString().substr(11, 8) : date.toISOString().substr(14, 5);
    };

    next();
});

// ==========================================
// 4. LEGACY REDIRECTS (PHP & Uploads)
// ==========================================
app.use((req, res, next) => {
    const path = req.path;
    const query = req.query;
    if (path.startsWith('/uploads/')) {
        const r2Domain = process.env.R2_PUBLIC_URL;
        if (r2Domain) {
            const cleanPath = path.replace('/uploads', ''); 
            return res.redirect(301, `${r2Domain}${cleanPath}`);
        }
    }

    // 2. Redirect File PHP Lama
    if (path === '/rss.php') return res.redirect(301, '/rss');
    if (path === '/sitemap.php') return res.redirect(301, '/sitemap.xml');
    if (path === '/rss-sitemap.php') return res.redirect(301, '/sitemap-video.xml');
    if (path === '/index.php') {
        const q = query.page ? `?page=${query.page}` : '';
        return res.redirect(301, `/${q}`);
    }
    if (path === '/rss-by-category.php') {
        const slug = query.slug || query.category;
        if (slug) return res.redirect(301, `/rss/category/${slug.replace(/ /g, '-')}`);
        return res.redirect(301, '/rss');
    }

    next();
});

// Helper untuk aman dari karakter Regex seperti ( ) . + *
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// ==========================================
// 5. FRONTEND ROUTES (Cached)
// ==========================================

// --- HOME PAGE (Cache 5 Menit) ---
app.get('/', cacheMiddleware(300), async (req, res) => {
    try {
        const limit = 24;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;

        const videos = await Video.find().sort({ created_at: -1 }).skip(skip).limit(limit);
        const cosplays = await Cosplay.find().sort({ created_at: -1 }).limit(10);
        const totalVideos = await Video.countDocuments();
        const totalPages = Math.ceil(totalVideos / limit);
        const page_label = page > 1 ? ` - Halaman ${page}` : "";
        
        res.render('index', {
            videos,cosplays, currentPage: page, totalPages, totalVideos,
            current_title: `Streaming Video Bokep Terbaru${page_label} | ${res.locals.site_name}`,
            current_desc: `Nonton Bokep Terbaru 2026. SangeTube adalah situs Bokep Indo, Jepang, Viral terlengkap.${page_label}`,
            current_image: `${res.locals.site_url}/og-image.jpg`
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- SINGLE VIDEO (Cache 1 Jam) ---
app.get('/video/:slug', cacheMiddleware(3600), async (req, res) => {
    try {
        Video.updateOne({ slug: req.params.slug }, { $inc: { views: 1 } }).exec();

        const video = await Video.findOne({ slug: req.params.slug });
        if (!video) {
            return res.status(404).render('404', { 
                current_title: "Video Tidak Ditemukan",
                no_index: true 
            });
        }

        const related = await Video.aggregate([{ $sample: { size: 8 } }]);
        const embed_url_full = `https://round-wave-fbe6.gordon96376-f42.workers.dev/?url=https:${video.embed_url}`;
        const meta_image = video.thumbnail.startsWith('http') ? video.thumbnail : `${res.locals.site_url}/${video.thumbnail}`;

        // Format tanggal untuk SEO
        const uploadDate = new Date(video.upload_date);
        const formattedDate = uploadDate.toISOString().replace('Z', '+07:00');
        
        // Deskripsi dengan durasi
        const durationText = video.duration_sec ? `${video.duration_sec} detik` : '60 detik';
        const seoDescription = `Bokep Indo ${video.title} dengan durasi ${durationText}. Nonton videonya hanya disini.`;
        
        // Kategori untuk section
        const categories = video.categories && video.categories.length > 0 ? 
            video.categories : ['Bokep Terbaru'];
        
        // Tag untuk meta
        const seoTags = video.tags || [];
        
        // Section untuk schema (gabungkan kategori dengan defaults)
        const schemaSections = [...categories, 'Bokep Indo', 'Bokep Viral', 'Bokep Terbaru'];
        
        // Data lengkap untuk meta tags
        const seoData = {
            // Meta dasar
            seo_title: `${video.title} | ${res.locals.site_name}`,
            seo_description: seoDescription,
            seo_canonical: `${res.locals.site_url}/video/${video.slug}`,

            // Open Graph
            og_locale: "id_ID",
            og_type: "article",
            og_image: meta_image,
            og_image_width: 854,
            og_image_height: 480,
            og_date: formattedDate,

            // Twitter
            twitter_card: "summary_large_image",
            twitter_site: "@SangeTube",
            twitter_creator: "@SangeTube",
            twitter_image: meta_image,

            // Article tags
            article_tags: seoTags,
            article_section: categories[0] || 'Bokep Terbaru',

            // Schema.org
            schema_publisher_name: res.locals.site_name,
            schema_publisher_sameAs: ["https://twitter.com/SangeTube"],
            schema_author_name: res.locals.site_name,
            schema_author_url: `${res.locals.site_url}/author/${encodeURIComponent(res.locals.site_name)}/`,
            schema_author_image: "https://secure.gravatar.com/avatar/ab04442537d717b73fab19403a00c802db3e20af6389304690fb313b5c0ae3ba?s=96&d=mm&r=g",
            schema_sections: schemaSections,
            schema_date: formattedDate,

            // Data tambahan untuk header.ejs
            current_title: `${video.title} | ${res.locals.site_name}`,
            current_desc: seoDescription,
            current_image: meta_image,
            current_url: `${res.locals.site_url}/video/${video.slug}`,
            og_type: "article",
            twitter_card: "summary_large_image"
        };

        res.render('single', {
            video, 
            related, 
            embed_url_full,
            formatDuration: res.locals.formatDuration,
            ...seoData  // Spread semua data SEO ke template
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- SEARCH (Cache 10 Menit) ---
app.get('/search', cacheMiddleware(600), async (req, res) => {
    try {
        const q = req.query.q || '';
        
        // 1. Query untuk Video
        const videoQuery = {
            $or: [
                { title: { $regex: q, $options: 'i' } },
                { tags: { $regex: q, $options: 'i' } }
            ]
        };

        // 2. Query untuk Cosplay (Cari di Title, Character, Cosplayer, Tags)
        const cosplayQuery = {
            $or: [
                { title: { $regex: q, $options: 'i' } },
                { character: { $regex: q, $options: 'i' } },
                { cosplayer: { $regex: q, $options: 'i' } },
                { tags: { $regex: q, $options: 'i' } }
            ]
        };

        // Eksekusi Query
        const videos = await Video.find(videoQuery).sort({ created_at: -1 }).limit(24);
        const cosplays = await Cosplay.find(cosplayQuery).sort({ created_at: -1 }).limit(12);

        res.render('search', {
            videos, 
            cosplays, // Kirim data cosplay ke view
            q,
            current_title: `Pencarian: ${q} | ${res.locals.site_name}`,
            no_index: true
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});


// --- TAGS (Cache 30 Menit) ---
app.get('/tag/:tag', cacheMiddleware(1800), async (req, res) => {
    try {
        const tagSlug = req.params.tag;
        const display_tag = tagSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        
        const limit = 24;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;
        const page_label = page > 1 ? ` - Halaman ${page}` : "";

        // Query Regex (Case Insensitive)
        const query = { tags: { $regex: tagSlug.replace(/-/g, ' '), $options: 'i' } };

        // 1. Ambil Video
        const videos = await Video.find(query).sort({ created_at: -1 }).skip(skip).limit(limit);
        const totalVideos = await Video.countDocuments(query);
        const seoDescription = `Kumpulan video ${display_tag} dengan berbagai jenis adegan. Koleksi ${display_tag} terlengkap. Update terbaru setiap hari. Nonton video ${display_tag} gratis tanpa iklan di ${res.locals.site_name}.`;
        // 2. Ambil Cosplay (Limit 12, Terbaru)
        const cosplays = await Cosplay.find(query).sort({ created_at: -1 }).limit(12);

        const totalPages = Math.ceil(totalVideos / limit);
        
        
        
        res.render('tags', {
            videos, 
            cosplays, // Kirim data cosplay ke view
            display_tag, tagSlug, currentPage: page, totalPages, totalVideos,
            current_title: `${display_tag}${page_label} | ${res.locals.site_name}`,
            current_desc: seoDescription + page_label,
            seo_description: seoDescription
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- CATEGORY (Cache 30 Menit) ---
app.get('/category/:slug', cacheMiddleware(1800), async (req, res) => {
    try {
        const Cosplay = require('./models/Cosplay');
        const rawSlug = decodeURIComponent(req.params.slug);
        const display_cat = rawSlug.replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        
        const limit = 24;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;
        const page_label = page > 1 ? ` - Halaman ${page}` : "";
        const searchKeyword = rawSlug.replace(/-/g, ' '); 
        const safeKeyword = escapeRegex(searchKeyword); // Matikan fungsi ( )
        const query = { categories: { $regex: safeKeyword, $options: 'i' } };
        const videos = await Video.find(query).sort({ created_at: -1 }).skip(skip).limit(limit);
        const totalVideos = await Video.countDocuments(query);
        const cosplays = await Cosplay.find(query).sort({ created_at: -1 }).limit(12);
        const totalPages = Math.ceil(totalVideos / limit);
        
        const seoDescription = `Kumpulan video ${display_cat} dengan berbagai jenis adegan. Koleksi ${display_cat} terlengkap. Update terbaru setiap hari. Nonton video ${display_cat} gratis tanpa iklan di ${res.locals.site_name}.`;
        
        res.render('category', {
            videos, cosplays,
            display_cat, 
            categorySlug: rawSlug, // Kirim slug asli untuk link pagination
            currentPage: page, totalPages, totalVideos,
            rss_category_slug: rawSlug,
            current_title: `${display_cat}${page_label} | ${res.locals.site_name}`,
            current_desc: seoDescription + page_label,
            seo_description: seoDescription
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- COSPLAY PAGE (Cache 1 Jam) ---
app.get('/cosplay/:slug', cacheMiddleware(3600), async (req, res) => {
    try {
        const Cosplay = require('./models/Cosplay'); 
        await Cosplay.updateOne({ slug: req.params.slug }, { $inc: { views: 1 } });

        const cosplay = await Cosplay.findOne({ slug: req.params.slug });

        if (!cosplay) {
            return res.status(404).render('404', { 
                current_title: "Cosplay Tidak Ditemukan",
                no_index: true 
            });
        }
        
        const related = await Cosplay.aggregate([
            { $match: { categories: { $in: cosplay.categories || [] }, slug: { $ne: cosplay.slug } } },
            { $sample: { size: 4 } }
        ]);

        // --- KONFIGURASI SEO LENGKAP ---
        
        // 1. Gambar Utama (Ambil dari Gallery atau Default)
        const mainImage = cosplay.gallery && cosplay.gallery.length > 0 ? 
            cosplay.gallery[0] : `${res.locals.site_url}/uploads/default-cosplay.jpg`;
            
        // 2. Deskripsi SEO yang menarik
        const desc = `Download dan streaming koleksi foto cosplay ${cosplay.character} oleh cosplayer ${cosplay.cosplayer}. Tersedia ${cosplay.gallery.length} foto HD dan video eksklusif.`;
        
        // 3. Format Tanggal
        const uploadDate = new Date(cosplay.created_at);
        const formattedDate = uploadDate.toISOString().replace('Z', '+07:00');

        // 4. Tags & Categories (Pastikan formatnya Array of Strings)
        // Handle format lama (Object) maupun baru (String)
        const seoTags = (cosplay.tags || []).map(t => typeof t === 'object' ? t.name : t);
        const categories = cosplay.categories || ['Cosplay Terbaru'];
        const schemaSections = [...categories, 'Cosplay Viral', 'Cosplay Indo'];

        // 5. Data SEO Lengkap (Mirroring struktur Video)
        const seoData = {
            // Meta Dasar
            seo_title: `${cosplay.title} | ${res.locals.site_name}`,
            seo_description: desc,
            seo_canonical: `${res.locals.site_url}/cosplay/${cosplay.slug}`,

            // Open Graph (Facebook/WA)
            og_locale: "id_ID",
            og_type: "article",
            og_image: mainImage,
            og_image_width: 800, // Standar Portrait/Vertical biasanya lebih cocok untuk cosplay, tapi 800x600 aman
            og_image_height: 1200,
            og_date: formattedDate,
            og_site_name: res.locals.site_name,

            // Twitter Card
            twitter_card: "summary_large_image",
            twitter_site: "@SangeTube",
            twitter_creator: "@SangeTube",
            twitter_image: mainImage,

            // Article Specifics
            article_tags: seoTags,
            article_section: categories[0] || 'Cosplay',
            article_published_time: formattedDate,

            // Schema.org (Rich Snippets)
            schema_publisher_name: res.locals.site_name,
            schema_publisher_sameAs: ["https://twitter.com/SangeTube"],
            schema_author_name: res.locals.site_name,
            schema_author_url: `${res.locals.site_url}/author/${encodeURIComponent(res.locals.site_name)}/`,
            schema_author_image: "https://secure.gravatar.com/avatar/ab04442537d717b73fab19403a00c802db3e20af6389304690fb313b5c0ae3ba?s=96&d=mm&r=g",
            schema_sections: schemaSections,
            schema_date: formattedDate,

            // Kompatibilitas Header Lama
            current_title: `${cosplay.title} | ${res.locals.site_name}`,
            current_desc: desc,
            current_image: mainImage,
            current_url: `${res.locals.site_url}/cosplay/${cosplay.slug}`,
            
            // Override nilai res.locals
            og_type: "article",
            twitter_card: "summary_large_image"
        };

        res.render('cosplay', {
            cosplay,
            related,
            ...seoData // Spread semua data SEO agar bisa dibaca di header.ejs
        });

    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- COSPLAY INDEX / LIST PAGE (Cache 15 Menit) ---
app.get('/cosplay', cacheMiddleware(900), async (req, res) => {
    try {
        const Cosplay = require('./models/Cosplay'); // Pastikan model di-load
        
        const limit = 24; // Tampilkan 24 item per halaman
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;
        const page_label = page > 1 ? ` - Halaman ${page}` : "";

        // Query Database
        const cosplays = await Cosplay.find()
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit);
            
        const totalCosplays = await Cosplay.countDocuments();
        const totalPages = Math.ceil(totalCosplays / limit);

        // SEO Meta
        const seoDesc = `Koleksi foto cosplay terbaru dan terlengkap. Download pack cosplay viral resolusi tinggi gratis.${page_label}`;

        res.render('cosplay-list', {
            cosplays,
            currentPage: page,
            totalPages,
            totalCosplays,
            
            // SEO Variables
            current_title: `Koleksi Cosplay Terbaru${page_label} | ${res.locals.site_name}`,
            current_desc: seoDesc,
            current_url: `${res.locals.site_url}/cosplay`,
            current_image: `${res.locals.site_url}/uploads/default-cosplay.jpg`
        });

    } catch (err) {
        res.status(500).send(err.message);
    }
});




// ==========================================
// 7. SITEMAP & RSS FEED ROUTES (NO CACHE)
// ==========================================

// 1. Main RSS Feed (Video + Cosplay)
app.get('/rss', async (req, res) => {
    try {
        const site_url = process.env.SITE_URL || 'http://localhost:3000';
        
        // Ambil Video & Cosplay Terbaru
        const videos = await Video.find().sort({ created_at: -1 }).limit(30);
        const cosplays = await Cosplay.find().sort({ created_at: -1 }).limit(20);

        // Gabungkan dan Urutkan berdasarkan waktu
        const allItems = [...videos.map(v => ({...v.toObject(), type: 'video'})), ...cosplays.map(c => ({...c.toObject(), type: 'cosplay'}))]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const lastBuildDate = new Date().toUTCString();

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
    <channel>
        <title>SangeTube - Update Terbaru</title>
        <link>${site_url}</link>
        <description>Video viral dan koleksi cosplay terbaru di SangeTube</description>
        <language>id-ID</language>
        <lastBuildDate>${lastBuildDate}</lastBuildDate>
        <atom:link href="${site_url}/rss" rel="self" type="application/rss+xml" />`;

        allItems.forEach(item => {
            const isVideo = item.type === 'video';
            const itemUrl = isVideo ? `${site_url}/video/${item.slug}` : `${site_url}/cosplay/${item.slug}`;
            
            // Thumbnail Logic
            let thumbUrl = `${site_url}/uploads/default-poster.jpg`;
            const rawThumb = isVideo ? item.thumbnail : (item.gallery?.[0] || '');
            
            if (rawThumb) {
                thumbUrl = rawThumb.startsWith('http') ? rawThumb : `${site_url}/${rawThumb}`;
            }

            const descText = isVideo ? `Nonton video ${item.title}` : `Koleksi foto cosplay ${item.title}`;
            
            xml += `
        <item>
            <title><![CDATA[${item.title}]]></title>
            <link>${itemUrl}</link>
            <guid isPermaLink="true">${itemUrl}</guid>
            <description><![CDATA[
                <img src="${thumbUrl}" width="320" style="object-fit:cover;" /><br/>
                <p>${descText}</p>
                <p><strong>Type:</strong> ${isVideo ? 'Video' : 'Cosplay Album'}</p>
            ]]></description>
            <media:content url="${thumbUrl}" medium="image">
                <media:title type="plain"><![CDATA[${item.title}]]></media:title>
            </media:content>
            <pubDate>${new Date(item.created_at).toUTCString()}</pubDate>
        </item>`;
        });

        xml += `
    </channel>
</rss>`;

        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 2. RSS by Category (Support Cosplay)
app.get('/rss/category/:slug', async (req, res) => {
    try {
        const site_url = process.env.SITE_URL || 'http://localhost:3000';
        const rawSlug = decodeURIComponent(req.params.slug);
        const searchKeyword = escapeRegex(rawSlug.replace(/-/g, ' '));
        
        // Cari di Video & Cosplay
        const videos = await Video.find({ categories: { $regex: searchKeyword, $options: 'i' } }).sort({ created_at: -1 }).limit(20);
        const cosplays = await Cosplay.find({ categories: { $regex: searchKeyword, $options: 'i' } }).sort({ created_at: -1 }).limit(10);

        const allItems = [...videos.map(v => ({...v.toObject(), type: 'video'})), ...cosplays.map(c => ({...c.toObject(), type: 'cosplay'}))]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
        <title>Kategori: ${rawSlug}</title>
        <link>${site_url}</link>
        <description>Feed kategori ${rawSlug}</description>
        <language>id-ID</language>
        <atom:link href="${site_url}/rss/category/${req.params.slug}" rel="self" type="application/rss+xml" />`;

        allItems.forEach(item => {
            const isVideo = item.type === 'video';
            const itemUrl = isVideo ? `${site_url}/video/${item.slug}` : `${site_url}/cosplay/${item.slug}`;
            
            // Thumbnail Logic
            let thumbUrl = `${site_url}/uploads/default-poster.jpg`;
            const rawThumb = isVideo ? item.thumbnail : (item.gallery?.[0] || '');
            if (rawThumb) thumbUrl = rawThumb.startsWith('http') ? rawThumb : `${site_url}/${rawThumb}`;

            xml += `
        <item>
            <title><![CDATA[${item.title}]]></title>
            <link>${itemUrl}</link>
            <guid>${itemUrl}</guid>
            <description><![CDATA[
                <img src="${thumbUrl}" width="320" /><br/>
                ${item.title} (${isVideo ? 'Video' : 'Cosplay'})
            ]]></description>
            <pubDate>${new Date(item.created_at).toUTCString()}</pubDate>
        </item>`;
        });

        xml += `
    </channel>
</rss>`;

        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 3. Video Sitemap (Google) - HANYA VIDEO
app.get('/sitemap-video.xml', async (req, res) => {
    try {
        const site_url = process.env.SITE_URL || 'http://localhost:3000';
        const videos = await Video.find().select('title slug description thumbnail duration_sec tags created_at embed_url').sort({ created_at: -1 }).limit(1000);

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
    <url><loc>${site_url}/</loc><priority>1.0</priority></url>`;

        videos.forEach(vid => {
            const pageUrl = `${site_url}/video/${vid.slug}`;
            let thumbUrl = `${site_url}/uploads/default-poster.jpg`;
            if (vid.thumbnail) thumbUrl = vid.thumbnail.startsWith('http') ? vid.thumbnail : `${site_url}/${vid.thumbnail}`;
            const playerLoc = `https://round-wave-fbe6.gordon96376-f42.workers.dev/?url=${encodeURIComponent('https:'+vid.embed_url)}`;
            
            let videoTags = '';
            if (vid.tags && vid.tags.length > 0) {
                vid.tags.slice(0, 32).forEach(tag => videoTags += `<video:tag><![CDATA[${tag}]]></video:tag>`);
            }

            xml += `<url><loc>${pageUrl}</loc><video:video>
            <video:thumbnail_loc>${thumbUrl}</video:thumbnail_loc>
            <video:title><![CDATA[${vid.title}]]></video:title>
            <video:description><![CDATA[${(vid.description || '').substring(0, 2000)}]]></video:description>
            <video:player_loc allow_embed="yes" autoplay="ap=1">${playerLoc}</video:player_loc>
            <video:duration>${Math.round(vid.duration_sec || 0)}</video:duration>
            <video:publication_date>${new Date(vid.created_at).toISOString()}</video:publication_date>
            ${videoTags}
            </video:video></url>`;
        });
        xml += `</urlset>`;
        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) { res.status(500).send(err.message); }
});

// 4. General Sitemap (Video & Cosplay)
app.get('/sitemap.xml', async (req, res) => {
    try {
        const site_url = process.env.SITE_URL || 'http://localhost:3000';
        
        // Ambil Video & Cosplay
        const videos = await Video.find().select('slug upload_date title thumbnail tags created_at').sort({ created_at: -1 });
        const cosplays = await Cosplay.find().select('slug created_at title gallery tags').sort({ created_at: -1 });

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
    <url><loc>${site_url}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
    <url><loc>${site_url}/cosplay</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`;

        const uniqueTags = new Set();
        
        // --- Loop Video ---
        videos.forEach(vid => {
            const url = `${site_url}/video/${vid.slug}`;
            let thumb = `${site_url}/uploads/default-poster.jpg`;
            if (vid.thumbnail) thumb = vid.thumbnail.startsWith('http') ? vid.thumbnail : `${site_url}/${vid.thumbnail}`;
            
            if (vid.tags) vid.tags.forEach(t => uniqueTags.add(t.toLowerCase().trim().replace(/ /g, '-')));

            xml += `
    <url>
        <loc>${url}</loc>
        <lastmod>${new Date(vid.upload_date || vid.created_at).toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
        <image:image><image:loc>${thumb}</image:loc><image:title><![CDATA[${vid.title}]]></image:title></image:image>
    </url>`;
        });

        // --- Loop Cosplay ---
        cosplays.forEach(cos => {
            const url = `${site_url}/cosplay/${cos.slug}`;
            let thumb = `${site_url}/uploads/default-cosplay.jpg`;
            if (cos.gallery && cos.gallery.length > 0) thumb = cos.gallery[0];

            if (cos.tags) cos.tags.forEach(t => uniqueTags.add(t.toLowerCase().trim().replace(/ /g, '-')));

            xml += `
    <url>
        <loc>${url}</loc>
        <lastmod>${new Date(cos.created_at).toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
        <image:image><image:loc>${thumb}</image:loc><image:title><![CDATA[${cos.title}]]></image:title></image:image>
    </url>`;
        });

        // --- Loop Tags Pages ---
        uniqueTags.forEach(tagSlug => {
            if(tagSlug) xml += `<url><loc>${site_url}/tag/${tagSlug}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`;
        });

        xml += `</urlset>`;
        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) {
        res.status(500).send(err.message);
    }
});


// ==========================================
// 7. ADMIN & SCRAPER ROUTES (No Cache)
// ==========================================
app.get('/admin/login', (req, res) => res.render('login', { error: null }));
app.post('/admin/login', (req, res) => {
    if (req.body.password === process.env.ADMIN_PASSWORD) {
        req.session.isLoggedIn = true;
        return res.redirect('/admin');
    }
    res.render('login', { error: 'Password Salah!' });
});
app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});
app.get('/admin', (req, res) => {
    if (!req.session.isLoggedIn) return res.redirect('/admin/login');
    res.render('admin/admin'); // Sesuaikan path jika views/admin/admin.ejs
});

// API Scraper
app.post('/api/scrape', async (req, res) => {
    if (!req.session.isLoggedIn) return res.status(401).send('❌ Unauthorized');
    const { url } = req.body;
    if (!url) return res.send('❌ URL kosong!');

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
            }, timeout: 20000
        });

        const $ = cheerio.load(response.data);
        if ($('title').text().includes('Just a moment...')) return res.send('❌ Cloudflare Blocked');

        const title = $('meta[itemprop="name"]').attr('content') || $('title').text();
        if (!title) return res.send('❌ Judul Missing');

        const rawDuration = $('meta[itemprop="duration"]').attr('content') || 'PT0S';
        const durationSec = isoToSeconds(rawDuration);

        const existing = await Video.findOne({ title: title.trim() });
        if (existing) return res.send(`⚠️ Duplicate: ${title.substring(0, 20)}...`);

        const rawThumbnail = $('meta[itemprop="thumbnailUrl"]').attr('content');
        const slug = slugify(title, { lower: true, strict: true });
        const thumbUrl = await uploadFromUrl(rawThumbnail, slug);

        const newVideo = new Video({
            title: title.trim(), slug, 
            description: $('meta[itemprop="description"]').attr('content') || '',
            embed_url: $('meta[itemprop="embedURL"]').attr('content') || '',
            thumbnail: thumbUrl, duration: rawDuration, duration_sec: durationSec,
            tags: $('a[href*="/tag/"]').map((i, el) => $(el).text().trim()).get(),
            categories: $('a[href*="/category/"]').map((i, el) => $(el).text().trim()).get(),
            upload_date: new Date()
        });

        await newVideo.save();

        // INVALIDATE CACHE (Hapus cache Homepage agar video baru muncul)
        myCache.del('__express__/' + '/'); 
        myCache.del('__express__/' + '/rss');

        res.send(`✅ Success: ${title.substring(0, 40)}`);
    } catch (err) {
        console.error(err);
        res.send(`❌ Error: ${err.message}`);
    }
});

// ==========================================
// SCRAPER KHUSUS COSPLAY (cosplaytele.com)
// ==========================================
app.post('/api/scrape-cosplay', async (req, res) => {
    // 1. Cek Login
    if (!req.session.isLoggedIn) return res.status(401).send('❌ Unauthorized');
    
    // 2. Cek URL Input
    const { url } = req.body;
    if (!url) return res.send('❌ URL kosong!');

    try {
        // 3. Fetch Halaman Target
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
            }, 
            timeout: 30000
        });

        const $ = cheerio.load(response.data);
        
        // 4. Ambil Judul & Slug
        const title = $('h1.entry-title').text().trim();
        if (!title) return res.send('❌ Gagal: Judul tidak ditemukan');
        
        // Slugify: Pertahankan huruf jepang/mandarin, ganti spasi jadi -
        // Gunakan slugify library atau manual replace jika library menghapus karakter utf8
        const slug = slugify(title, { lower: true, strict: false, remove: /[*+~.()'"!:@]/g }); 
        
        // 5. Cek Duplikat di Database
        const existing = await Cosplay.findOne({ slug });
        if (existing) return res.send(`⚠️ Sudah ada: ${title.substring(0, 30)}...`);

        // 6. Ambil Meta Data (Cosplayer, Char, Game, Password)
        let cosplayer = '', character = '', game_anime = '', password_zip = '';
        
        $('blockquote p').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Cosplayer:')) cosplayer = $(el).find('a').text().trim();
            if (text.includes('Character:')) character = $(el).find('a').text().trim();
            if (text.includes('Appear In:')) game_anime = $(el).find('a').text().trim();
            if (text.includes('Unzip Password:')) password_zip = $(el).find('input').val() || '';
        });

        // 7. Ambil Link Download
        const downloads = {};
        $('.button.alert').each((i, el) => {
            const link = $(el).attr('href');
            const text = $(el).text().toLowerCase();
            if (link) {
                if (text.includes('mediafire')) downloads.mediafire = link;
                else if (text.includes('telegram')) downloads.telegram = link;
                else if (text.includes('sorafolder')) downloads.sorafolder = link;
                else if (text.includes('gofile')) downloads.gofile = link;
            }
        });

        // 8. Ambil Gallery Gambar (AUTO CDN REPLACE)
        const gallery = [];
        $('.gallery-item a').each((i, el) => {
            let imgUrl = $(el).attr('href');
            
            if (imgUrl) {
                // Hapus "https://" atau "http://" dari awal URL asli
                let cleanUrl = imgUrl.replace(/^https?:\/\//, '');
                
                // Gabungkan: CDN + URL Asli (tanpa https://)
                let cdnUrl = `https://cdn.manhwature.com/${cleanUrl}`;
                
                if (!gallery.includes(cdnUrl)) {
                    gallery.push(cdnUrl);
                }
            }
        });

        // 9. Video Embed
        let video_embed = '';
        $('iframe').each((i, el) => {
            const src = $(el).attr('src');
            if (src && (src.includes('embed') || src.includes('player') || src.includes('cossora'))) {
                video_embed = src;
                return false; // Break loop
            }
        });

        // 10. Tags & Categories
        let categories = [];
        $('.entry-category a').each((i, el) => {
            const cat = $(el).text().trim();
            if(cat) categories.push(cat);
        });
        
        let tags = [];
        $('.entry-meta a[rel="tag"]').each((i, el) => {
            const tag = $(el).text().trim();
            // Bersihkan tag dari simbol aneh jika perlu
            if(tag) tags.push(tag);
        });
        
        // Hapus duplikat
        tags = [...new Set(tags)];
        categories = [...new Set(categories)];

        // 11. Simpan ke Database
        const newCosplay = new Cosplay({
            title,
            slug,
            cosplayer,
            character,
            game_anime,
            gallery,     // Array URL (sudah CDN)
            downloads,
            password_zip,
            video_embed,
            tags,
            categories,
            description: `Cosplay ${character} oleh ${cosplayer} dari ${game_anime}. Download set lengkap.`
        });

        await newCosplay.save();
        
        // Invalidate Cache (Penting agar update muncul di frontend)
        myCache.del('__express__/' + '/'); 
        myCache.del('__express__/' + '/cosplay');
        
        res.send(`✅ Berhasil Scrape: ${title.substring(0, 40)}... (${gallery.length} Foto CDN)`);

    } catch (err) {
        console.error("Scrape Cosplay Error:", err.message);
        res.send(`❌ Error: ${err.message}`);
    }
});

// ==========================================
// 8. 404 HANDLER (Last Route)
// ==========================================
app.use(async (req, res) => {
    try {
        const randomVideos = await Video.aggregate([{ $sample: { size: 4 } }]);
        res.status(404).render('404', {
            videos: randomVideos,
            current_title: "Page Not Found",
            no_index: true
        });
    } catch (err) {
        res.status(404).render('404');
    }
});

// ==========================================
// 9. START SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
