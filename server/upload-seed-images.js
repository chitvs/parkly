require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET_NAME = 'garage-photos';

// We have 6 garages, each with 3 photos
const garagesImages = [
  {
    garageId: 1,
    urls: [
      'https://picsum.photos/seed/garage1a/1000/600',
      'https://picsum.photos/seed/garage1b/1000/600',
      'https://picsum.photos/seed/garage1c/1000/600'
    ]
  },
  {
    garageId: 2,
    urls: [
      'https://picsum.photos/seed/garage2a/1000/600',
      'https://picsum.photos/seed/garage2b/1000/600',
      'https://picsum.photos/seed/garage2c/1000/600'
    ]
  },
  {
    garageId: 3,
    urls: [
      'https://picsum.photos/seed/garage3a/1000/600',
      'https://picsum.photos/seed/garage3b/1000/600',
      'https://picsum.photos/seed/garage3c/1000/600'
    ]
  },
  {
    garageId: 4,
    urls: [
      'https://picsum.photos/seed/garage4a/1000/600',
      'https://picsum.photos/seed/garage4b/1000/600',
      'https://picsum.photos/seed/garage4c/1000/600'
    ]
  },
  {
    garageId: 5,
    urls: [
      'https://picsum.photos/seed/garage5a/1000/600',
      'https://picsum.photos/seed/garage5b/1000/600',
      'https://picsum.photos/seed/garage5c/1000/600'
    ]
  },
  {
    garageId: 6,
    urls: [
      'https://picsum.photos/seed/garage6a/1000/600',
      'https://picsum.photos/seed/garage6b/1000/600',
      'https://picsum.photos/seed/garage6c/1000/600'
    ]
  }
];

async function downloadAndUploadImage(url, filename) {
  console.log(`Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`Uploading ${filename} to Supabase...`);
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filename, buffer, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (error) {
    throw new Error(`Failed to upload ${filename}: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filename);

  return publicUrlData.publicUrl;
}

async function main() {
  const newMapping = [];

  for (const garage of garagesImages) {
    const newUrls = [];
    let idx = 1;
    for (const url of garage.urls) {
      const filename = `seed_garage_${garage.garageId}_photo_${idx}.jpg`;
      try {
        const publicUrl = await downloadAndUploadImage(url, filename);
        newUrls.push(publicUrl);
        idx++;
      } catch (err) {
        console.error(err);
      }
    }
    newMapping.push({ garageId: garage.garageId, oldUrls: garage.urls, newUrls });
  }

  console.log("Updating seed.sql...");
  const seedPath = path.join(__dirname, 'database', 'seed.sql');
  let seedContent = fs.readFileSync(seedPath, 'utf8');

  for (const map of newMapping) {
    for (let i = 0; i < map.oldUrls.length; i++) {
        seedContent = seedContent.split(map.oldUrls[i]).join(map.newUrls[i]);
    }
  }

  fs.writeFileSync(seedPath, seedContent, 'utf8');
  console.log("Done! seed.sql has been updated.");
}

main().catch(console.error);
