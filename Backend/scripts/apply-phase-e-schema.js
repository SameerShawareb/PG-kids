require('dotenv').config();

const { DataTypes } = require('sequelize');
const { sequelize } = require('../models');

const ensureColumn = async ({ queryInterface, tableName, columnName, spec, transaction }) => {
  const table = await queryInterface.describeTable(tableName, { transaction });
  if (table[columnName]) return 'skipped';
  await queryInterface.addColumn(tableName, columnName, spec, { transaction });
  return 'applied';
};

const ensureIndex = async ({ queryInterface, tableName, indexName, fields, transaction }) => {
  const indexes = await queryInterface.showIndex(tableName, { transaction });
  if (indexes.some((idx) => idx.name === indexName)) return 'skipped';
  await queryInterface.addIndex(tableName, fields, { name: indexName, transaction });
  return 'applied';
};

const applyPhaseESchema = async () => {
  const queryInterface = sequelize.getQueryInterface();

  const operations = [
    {
      key: 'users.phone',
      run: ({ transaction }) => ensureColumn({
        queryInterface,
        tableName: 'users',
        columnName: 'phone',
        spec: { type: DataTypes.STRING(20), allowNull: true },
        transaction,
      }),
    },
    {
      key: 'users.preferred_language',
      run: ({ transaction }) => ensureColumn({
        queryInterface,
        tableName: 'users',
        columnName: 'preferred_language',
        spec: { type: DataTypes.STRING(8), allowNull: true },
        transaction,
      }),
    },
    {
      key: 'users.is_active',
      run: ({ transaction }) => ensureColumn({
        queryInterface,
        tableName: 'users',
        columnName: 'is_active',
        spec: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        transaction,
      }),
    },
    {
      key: 'users.password_changed_at',
      run: ({ transaction }) => ensureColumn({
        queryInterface,
        tableName: 'users',
        columnName: 'password_changed_at',
        spec: { type: DataTypes.DATE, allowNull: true },
        transaction,
      }),
    },
    {
      key: 'users.parent_pin_hash',
      run: ({ transaction }) => ensureColumn({
        queryInterface,
        tableName: 'users',
        columnName: 'parent_pin_hash',
        spec: { type: DataTypes.STRING, allowNull: true },
        transaction,
      }),
    },
    {
      key: 'users.parent_pin_updated_at',
      run: ({ transaction }) => ensureColumn({
        queryInterface,
        tableName: 'users',
        columnName: 'parent_pin_updated_at',
        spec: { type: DataTypes.DATE, allowNull: true },
        transaction,
      }),
    },
    {
      key: 'child_profiles.profile_locked',
      run: ({ transaction }) => ensureColumn({
        queryInterface,
        tableName: 'child_profiles',
        columnName: 'profile_locked',
        spec: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        transaction,
      }),
    },
    {
      key: 'index:idx_users_is_active_model',
      run: ({ transaction }) => ensureIndex({
        queryInterface,
        tableName: 'users',
        indexName: 'idx_users_is_active_model',
        fields: ['is_active'],
        transaction,
      }),
    },
    {
      key: 'index:idx_users_preferred_language_model',
      run: ({ transaction }) => ensureIndex({
        queryInterface,
        tableName: 'users',
        indexName: 'idx_users_preferred_language_model',
        fields: ['preferred_language'],
        transaction,
      }),
    },
    {
      key: 'index:idx_child_profiles_profile_locked_model',
      run: ({ transaction }) => ensureIndex({
        queryInterface,
        tableName: 'child_profiles',
        indexName: 'idx_child_profiles_profile_locked_model',
        fields: ['profile_locked'],
        transaction,
      }),
    },
  ];

  const results = [];

  await sequelize.transaction(async (transaction) => {
    for (const operation of operations) {
      const status = await operation.run({ transaction });
      results.push({ key: operation.key, status });
    }
  });

  return results;
};

applyPhaseESchema()
  .then(async (results) => {
    const applied = results.filter((item) => item.status === 'applied').map((item) => item.key);
    const skipped = results.filter((item) => item.status === 'skipped').map((item) => item.key);

    console.log(`✅ Phase E schema check completed. Applied ${applied.length} operation(s), skipped ${skipped.length} existing operation(s).`);
    console.log(`APPLIED: ${applied.length ? applied.join(', ') : 'none'}`);
    console.log(`SKIPPED: ${skipped.length ? skipped.join(', ') : 'none'}`);
  })
  .catch((err) => {
    console.error('❌ Failed to apply Phase E schema:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
