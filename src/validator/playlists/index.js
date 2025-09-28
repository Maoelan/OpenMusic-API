const InvariantError = require('../../exceptions/InvariantError');
const {
  PostPlaylistPayloadSchema,
  PostPlaylistSongPayloadSchema,
} = require('./schema');

const PlaylistsValidator = {
  validatePostPlaylistPayload(payload) {
    const { error } = PostPlaylistPayloadSchema.validate(payload);
    if (error) {
      throw new InvariantError(error.message);
    }
  },

  validatePostPlaylistSongPayload(payload) {
    const { error } = PostPlaylistSongPayloadSchema.validate(payload);
    if (error) {
      throw new InvariantError(error.message);
    }
  },
};

module.exports = PlaylistsValidator;
