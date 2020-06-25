const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

const conectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_MONGO, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
      useFindAndModify: false,
      useCreateIndex: true

    })
    console.log('DB Connected');
  } catch (err) {
    console.log('There was a bug : ');
    console.log(err);
    process.exit(1);
  }
}

module.exports = conectDB;