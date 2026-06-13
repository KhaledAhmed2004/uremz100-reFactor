const mongoose = require('mongoose');

async function check() {
  await mongoose.connect('mongodb://localhost:27017/uremz100');
  const db = mongoose.connection;
  const content = await db.collection('contents').findOne({});
  console.log(content);
  process.exit(0);
}
check();
