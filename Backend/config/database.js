const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

// تحديد مسار ملف .env بدقة سواء كان الملف الحالي في المجلد الرئيسي أو داخل مجلد فرعي
const envPath = fs.existsSync(path.resolve(__dirname, '.env')) 
  ? path.resolve(__dirname, '.env') 
  : path.resolve(__dirname, '../.env');

require('dotenv').config({ path: envPath });

const databaseUrl = process.env.DATABASE_URL;

const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, {
      dialect: 'postgres',
      logging: process.env.DB_LOGGING === 'true' ? console.log : false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    })
  : new Sequelize(
      process.env.DB_NAME || 'pg_kids_db',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD || undefined,
      {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        dialect: 'postgres',
        logging: process.env.DB_LOGGING === 'true' ? console.log : false,
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        }
      }
    );

module.exports = sequelize;