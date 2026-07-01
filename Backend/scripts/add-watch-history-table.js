require('dotenv').config();

const { DataTypes } = require('sequelize');
const { sequelize } = require('../models');

const addWatchHistoryTable = async () => {
  const queryInterface = sequelize.getQueryInterface();

  await sequelize.transaction(async (transaction) => {
    const tableExists = await queryInterface
      .showAllTables({ transaction })
      .then((tables) => tables.map((name) => String(name)).includes('watch_history'));

    if (!tableExists) {
      await queryInterface.createTable('watch_history', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        profileId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'child_profiles', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        contentId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'contents', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        last_watched_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        watch_count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        last_position_seconds: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        completion_percent: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      }, { transaction });

      await queryInterface.addIndex('watch_history', ['profileId'], {
        name: 'idx_watch_history_profile_id',
        transaction,
      });
      await queryInterface.addIndex('watch_history', ['contentId'], {
        name: 'idx_watch_history_content_id',
        transaction,
      });
      await queryInterface.addIndex('watch_history', ['profileId', 'last_watched_at'], {
        name: 'idx_watch_history_profile_last_watched',
        transaction,
      });
      await queryInterface.addIndex('watch_history', ['profileId', 'contentId'], {
        name: 'uniq_watch_history_profile_content',
        unique: true,
        transaction,
      });

      console.log('✅ Table "watch_history" created successfully.');
      return;
    }

    const table = await queryInterface.describeTable('watch_history', { transaction });

    if (!table.last_position_seconds) {
      await queryInterface.addColumn('watch_history', 'last_position_seconds', {
        type: DataTypes.INTEGER,
        allowNull: true,
      }, { transaction });
    }

    if (!table.completion_percent) {
      await queryInterface.addColumn('watch_history', 'completion_percent', {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      }, { transaction });
    }

    console.log('ℹ️ Table "watch_history" already exists, ensured optional columns are present.');
  });
};

addWatchHistoryTable()
  .catch((err) => {
    console.error('❌ Failed to prepare "watch_history" table:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
