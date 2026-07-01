require('dotenv').config();

const { DataTypes } = require('sequelize');
const { sequelize } = require('../models');

const addVideoUrlColumn = async () => {
  const queryInterface = sequelize.getQueryInterface();

  await sequelize.transaction(async (transaction) => {
    const table = await queryInterface.describeTable('contents', { transaction });

    if (table.video_url) {
      console.log('ℹ️ Column "video_url" already exists on table "contents".');
      return;
    }

    await queryInterface.addColumn('contents', 'video_url', {
      type: DataTypes.STRING(2000),
      allowNull: true,
    }, { transaction });

    console.log('✅ Added column "video_url" to table "contents".');
  });
};

addVideoUrlColumn()
  .catch((err) => {
    console.error('❌ Failed to add "video_url" column:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
