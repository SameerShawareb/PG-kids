const assert = require('assert');
const bcrypt = require('bcrypt');

const models = require('../models');
const auditModule = require('../utils/audit');

const { User } = models;

const originalFindByPk = User.findByPk;
const originalWriteAuditLog = auditModule.writeAuditLog;

const createMockRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

const createUserRecord = async ({ id, parentPin }) => {
  const state = {
    parentPinHash: parentPin ? await bcrypt.hash(parentPin, 4) : null,
  };

  return {
    id,
    password_hash: await bcrypt.hash('CorrectPass!1', 4),
    get parent_pin_hash() {
      return state.parentPinHash;
    },
    async update(changes) {
      if (Object.prototype.hasOwnProperty.call(changes, 'parent_pin_hash')) {
        state.parentPinHash = changes.parent_pin_hash;
      }
      return this;
    },
  };
};

const invokeRemove = async ({ removeParentPin, userId, body }) => {
  const req = { user: { id: userId }, body };
  const res = createMockRes();
  await removeParentPin(req, res);
  return res;
};

(async () => {
  const auditCalls = [];

  try {
    auditModule.writeAuditLog = async (entry) => {
      auditCalls.push(entry);
    };

    delete require.cache[require.resolve('../controllers/authController')];
    const { removeParentPin } = require('../controllers/authController');

    const noPinUser = await createUserRecord({ id: 101, parentPin: null });
    const activePinUser = await createUserRecord({ id: 202, parentPin: '1234' });

    User.findByPk = async (id) => {
      if (id === 101) return noPinUser;
      if (id === 202) return activePinUser;
      return null;
    };

    const noPinRes = await invokeRemove({ removeParentPin, userId: 101, body: {} });
    assert.strictEqual(noPinRes.statusCode, 409, 'No PIN should return 409');
    assert.strictEqual(noPinRes.body.success, false, 'No PIN response should be non-success');
    assert.strictEqual(noPinRes.body.message, 'No parent PIN is configured');
    assert.deepStrictEqual(noPinRes.body.data, { has_parent_pin: false });

    const wrongPinRes = await invokeRemove({ removeParentPin, userId: 202, body: { current_pin: '9999' } });
    assert.strictEqual(wrongPinRes.statusCode, 401, 'Wrong PIN should be rejected');
    assert.strictEqual(wrongPinRes.body.success, false);

    const wrongPasswordRes = await invokeRemove({
      removeParentPin,
      userId: 202,
      body: { current_password: 'WrongPass!1' },
    });
    assert.strictEqual(wrongPasswordRes.statusCode, 401, 'Wrong password should be rejected');
    assert.strictEqual(wrongPasswordRes.body.success, false);

    const successRes = await invokeRemove({ removeParentPin, userId: 202, body: { current_pin: '1234' } });
    assert.strictEqual(successRes.statusCode, 200, 'Correct PIN should remove parent PIN');
    assert.strictEqual(successRes.body.success, true);
    assert.deepStrictEqual(successRes.body.data, { has_parent_pin: false });

    const repeatRes = await invokeRemove({ removeParentPin, userId: 202, body: { current_pin: '1234' } });
    assert.strictEqual(repeatRes.statusCode, 409, 'Repeated removal should return 409 after success');
    assert.strictEqual(repeatRes.body.success, false);

    assert.strictEqual(auditCalls.length, 1, 'Audit should be written only for actual removal');
    assert.strictEqual(auditCalls[0].action, 'PARENT_PIN_REMOVED');

    console.log('Parent PIN removal smoke test passed.');
  } catch (err) {
    console.error('Parent PIN removal smoke test failed:', err.message);
    process.exitCode = 1;
  } finally {
    User.findByPk = originalFindByPk;
    auditModule.writeAuditLog = originalWriteAuditLog;
    delete require.cache[require.resolve('../controllers/authController')];
  }
})();
