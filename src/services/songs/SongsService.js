const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');
const { mapDBToModel } = require('../../utils/songs');

class SongsService {
  constructor(cacheService) {
    this._pool = new Pool();
    this._cacheService = cacheService;
  }

  async addSong({
    title,
    year,
    genre,
    performer,
    duration,
    albumId,
  }) {
    const id = `song-${nanoid(16)}`;

    const query = {
      text: `
        INSERT INTO songs
          (id, title, year, genre, performer, duration, album_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
      `,
      values: [id, title, year, genre, performer, duration, albumId],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0]?.id) {
      throw new InvariantError('Lagu gagal ditambahkan');
    }

    await this._cacheService.delete('songs:all');
    if (albumId) await this._cacheService.delete(`album:${albumId}`);

    return result.rows[0].id;
  }

  async getSongs({ title, performer } = {}) {
    if (title || performer) {
      let baseQuery = 'SELECT id, title, performer FROM songs';
      const conditions = [];
      const values = [];

      if (title) {
        values.push(`%${title}%`);
        conditions.push(`title ILIKE $${values.length}`);
      }

      if (performer) {
        values.push(`%${performer}%`);
        conditions.push(`performer ILIKE $${values.length}`);
      }

      if (conditions.length) {
        baseQuery += ` WHERE ${conditions.join(' AND ')}`;
      }

      const result = await this._pool.query({ text: baseQuery, values });
      return result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        performer: row.performer,
      }));
    }

    try {
      const result = await this._cacheService.get('songs:all');
      return JSON.parse(result);
    } catch (error) {
      const query = {
        text: 'SELECT id, title, performer FROM songs',
      };

      const result = await this._pool.query(query);
      const songs = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        performer: row.performer,
      }));

      await this._cacheService.set('songs:all', JSON.stringify(songs));
      return songs;
    }
  }

  async getSongById(id) {
    try {
      const result = await this._cacheService.get(`song:${id}`);
      return JSON.parse(result);
    } catch (error) {
      const query = {
        text: 'SELECT * FROM songs WHERE id = $1',
        values: [id],
      };

      const result = await this._pool.query(query);

      if (!result.rows.length) {
        throw new NotFoundError('Lagu tidak ditemukan');
      }

      const song = result.rows.map(mapDBToModel)[0];

      await this._cacheService.set(`song:${id}`, JSON.stringify(song));
      return song;
    }
  }

  async editSongById(
    id,
    {
      title, year, genre, performer, duration, albumId,
    },
  ) {
    const query = {
      text: `
        UPDATE songs SET title = $1, year = $2, genre = $3,
          performer = $4, duration = $5, album_id = $6
        WHERE id = $7
        RETURNING id
      `,
      values: [title, year, genre, performer, duration, albumId, id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Gagal memperbarui lagu. Id tidak ditemukan');
    }

    await this._cacheService.delete(`song:${id}`);
    await this._cacheService.delete('songs:all');
    if (albumId) await this._cacheService.delete(`album:${albumId}`);
  }

  async deleteSongById(id) {
    const query = {
      text: 'DELETE FROM songs WHERE id = $1 RETURNING id, album_id',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Lagu gagal dihapus. Id tidak ditemukan');
    }

    await this._cacheService.delete(`song:${id}`);
    await this._cacheService.delete('songs:all');
    if (result.rows[0].album_id) {
      await this._cacheService.delete(`album:${result.rows[0].album_id}`);
    }
  }
}

module.exports = SongsService;
