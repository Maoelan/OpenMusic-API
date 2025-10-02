const UploadsHandler = require('./handler');
const routes = require('./routes');

module.exports = {
  name: 'uploads',
  version: '1.0.0',
  async register(server, { storageService, albumsService, validator }) {
    const uploadsHandler = new UploadsHandler(
      storageService,
      albumsService,
      validator,
    );
    server.route(routes(uploadsHandler));
  },
};
