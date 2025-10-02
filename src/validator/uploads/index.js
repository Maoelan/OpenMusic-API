const InvariantError = require('../../exceptions/InvariantError');
const { ImageHeadersSchema } = require('./schema');

const UploadsValidator = {
  validateImageHeaders(headers) {
    const { error } = ImageHeadersSchema.validate(headers);
    if (error) {
      throw new InvariantError(error.message);
    }
  },
};

module.exports = UploadsValidator;
