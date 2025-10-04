const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');

class AlbumLikesService {
  constructor(cacheService) {
    this._pool = new Pool();
    this._cacheService = cacheService;
  }

  async addAlbumLike(userId, albumId) {
    await this.verifyAlbumExists(albumId);
    await this.verifyAlbumNotLiked(userId, albumId);

    const id = `like-${nanoid(16)}`;

    const query = {
      text: `
        INSERT INTO user_album_likes (id, user_id, album_id) 
        VALUES ($1, $2, $3)
      `,
      values: [id, userId, albumId],
    };

    await this._pool.query(query);

    await this._cacheService.delete(`album_likes:${albumId}`);
  }

  async removeAlbumLike(userId, albumId) {
    const query = {
      text: `
        DELETE FROM user_album_likes
        WHERE user_id = $1 AND album_id = $2
        RETURNING id
      `,
      values: [userId, albumId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Album tidak ditemukan atau belum disukai');
    }

    await this._cacheService.delete(`album_likes:${albumId}`);
  }

  async getAlbumLikesCount(albumId) {
    await this.verifyAlbumExists(albumId);

    try {
      const result = await this._cacheService.get(`album_likes:${albumId}`);
      return { likes: JSON.parse(result), fromCache: true };
    } catch (error) {
      const query = {
        text: 'SELECT COUNT(*) FROM user_album_likes WHERE album_id = $1',
        values: [albumId],
      };

      const result = await this._pool.query(query);
      const likes = parseInt(result.rows[0].count, 10);

      await this._cacheService.set(`album_likes:${albumId}`, JSON.stringify(likes));

      return { likes, fromCache: false };
    }
  }

  async verifyAlbumExists(albumId) {
    const query = {
      text: 'SELECT id FROM albums WHERE id = $1',
      values: [albumId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Album tidak ditemukan');
    }
  }

  async verifyAlbumNotLiked(userId, albumId) {
    const query = {
      text: `
        SELECT id FROM user_album_likes WHERE user_id = $1 AND album_id = $2
      `,
      values: [userId, albumId],
    };

    const result = await this._pool.query(query);

    if (result.rows.length > 0) {
      throw new InvariantError('Album sudah disukai sebelumnya');
    }
  }
}

module.exports = AlbumLikesService;
