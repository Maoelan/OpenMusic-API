const InvariantError = require('../../exceptions/InvariantError');
const { CollaborationPayloadSchema } = require('./schema');

const CollaborationsValidator = {
  validateCollaborationPayload(payload) {
    const { error } = CollaborationPayloadSchema.validate(payload);
    if (error) {
      throw new InvariantError(error.message);
    }
  },
};

module.exports = CollaborationsValidator;
