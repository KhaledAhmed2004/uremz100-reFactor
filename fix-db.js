const mongoose = require('mongoose');

async function fixDB() {
  await mongoose.connect('mongodb://localhost:27017/uremz100');
  const db = mongoose.connection;
  
  // Rename 'poster' to 'posterUrl' in 'contents' collection
  const result = await db.collection('contents').updateMany(
    { poster: { $exists: true } },
    { $rename: { 'poster': 'posterUrl' } }
  );
  console.log(`Renamed poster to posterUrl in ${result.modifiedCount} documents.`);
  
  process.exit(0);
}
fixDB();
