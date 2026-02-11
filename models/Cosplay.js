const mongoose = require('mongoose');

const cosplaySchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true, 
        trim: true,
        index: true 
    },
    slug: { 
        type: String, 
        required: true, 
        unique: true, 
        lowercase: true,
        trim: true
    },
    cosplayer: { type: String, trim: true },
    character: { type: String, trim: true },
    game_anime: { type: String, trim: true },
    
    // Array URL Gambar untuk Galeri
    gallery: [{ type: String }],
    
    // Links Download
    downloads: {
        mediafire: String,
        telegram: String,
        sorafolder: String,
        gofile: String
    },
    
    description: String,
    password_zip: String,
    video_embed: String, // Jika ada video preview
    
    tags: [String],
    categories: [String],
    
    views: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Cosplay', cosplaySchema);