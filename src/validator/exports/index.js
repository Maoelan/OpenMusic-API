const InvariantError = require('../../exceptions/InvariantError');
const { ExportPlaylistsPayloadSchema } = require('./schema');

const ExportsValidator = {
  validateExportPlaylistsPayload(payload) {
    const { error } = ExportPlaylistsPayloadSchema.validate(payload);
    if (error) {
      throw new InvariantError(error.message);
    }
  },
};

module.exports = ExportsValidator;
