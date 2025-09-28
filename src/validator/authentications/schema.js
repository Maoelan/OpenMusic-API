const Joi = require('joi');

const PostAuthenticationPayloadSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

const RefreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

module.exports = {
  PostAuthenticationPayloadSchema,
  PutAuthenticationPayloadSchema: RefreshTokenSchema,
  DeleteAuthenticationPayloadSchema: RefreshTokenSchema,
};
