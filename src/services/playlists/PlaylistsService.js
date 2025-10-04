const { nanoid } = require('nanoid');
const { Pool } = require('pg');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');
const AuthorizationError = require('../../exceptions/AuthorizationError');

class PlaylistsService {
  constructor(collaborationsService, cacheService) {
    this._pool = new Pool();
    this._collaborationsService = collaborationsService;
    this._cacheService = cacheService;
  }

  async addPlaylist({ name, owner }) {
    const id = `playlist-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO playlists VALUES ($1, $2, $3) RETURNING id',
      values: [id, name, owner],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0]?.id) {
      throw new InvariantError('Playlist gagal ditambahkan');
    }

    await this._cacheService.delete(`playlists:${owner}`);

    return result.rows[0].id;
  }

  async getPlaylists(owner) {
    try {
      const result = await this._cacheService.get(`playlists:${owner}`);
      return JSON.parse(result);
    } catch (error) {
      const query = {
        text: `
          SELECT playlists.id, playlists.name, users.username
          FROM playlists
          LEFT JOIN users ON playlists.owner = users.id
          LEFT JOIN collaborations ON playlists.id = collaborations.playlist_id
          WHERE playlists.owner = $1 OR collaborations.user_id = $1
          GROUP BY playlists.id, playlists.name, users.username
        `,
        values: [owner],
      };

      const result = await this._pool.query(query);

      await this._cacheService.set(`playlists:${owner}`, JSON.stringify(result.rows));

      return result.rows;
    }
  }

  async deletePlaylistById(id) {
    const playlistResult = await this._pool.query({
      text: 'SELECT owner FROM playlists WHERE id = $1',
      values: [id],
    });

    if (!playlistResult.rows.length) {
      throw new NotFoundError('Playlist tidak ditemukan');
    }

    const { owner } = playlistResult.rows[0];

    const deleteResult = await this._pool.query({
      text: 'DELETE FROM playlists WHERE id = $1 RETURNING id',
      values: [id],
    });

    if (!deleteResult.rows.length) {
      throw new NotFoundError('Playlist gagal dihapus. Id tidak ditemukan');
    }

    await this._cacheService.delete(`playlists:${owner}`);
    await this._cacheService.delete(`playlist:${id}`);
  }

  async addPlaylistSong(playlistId, songId) {
    const id = `playlist-song-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO playlist_songs VALUES($1, $2, $3) RETURNING id',
      values: [id, playlistId, songId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new InvariantError('Lagu gagal ditambahkan ke playlist');
    }

    await this._cacheService.delete(`playlist:${playlistId}`);
  }

  async getPlaylistSongs(playlistId) {
    try {
      const result = await this._cacheService.get(`playlist:${playlistId}`);
      return JSON.parse(result);
    } catch (error) {
      const playlistQuery = {
        text: `
          SELECT playlists.id, playlists.name, users.username
          FROM playlists
          LEFT JOIN users ON playlists.owner = users.id
          WHERE playlists.id = $1
        `,
        values: [playlistId],
      };

      const playlistResult = await this._pool.query(playlistQuery);

      if (!playlistResult.rows.length) {
        throw new NotFoundError('Playlist tidak ditemukan');
      }

      const songsQuery = {
        text: `
          SELECT songs.id, songs.title, songs.performer
          FROM songs
          LEFT JOIN playlist_songs ON songs.id = playlist_songs.song_id
          WHERE playlist_songs.playlist_id = $1
        `,
        values: [playlistId],
      };

      const songsResult = await this._pool.query(songsQuery);

      const playlist = {
        ...playlistResult.rows[0],
        songs: songsResult.rows,
      };

      await this._cacheService.set(`playlist:${playlistId}`, JSON.stringify(playlist));

      return playlist;
    }
  }

  async deletePlaylistSong(playlistId, songId) {
    const query = {
      text: `
        DELETE FROM playlist_songs
        WHERE playlist_id = $1 AND song_id = $2
        RETURNING id
      `,
      values: [playlistId, songId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new InvariantError('Lagu gagal dihapus');
    }

    await this._cacheService.delete(`playlist:${playlistId}`);
  }

  async addPlaylistActivity(playlistId, songId, userId, action) {
    const id = `activity-${nanoid(16)}`;
    const time = new Date().toISOString();

    const query = {
      text: `
        INSERT INTO playlist_song_activities
          (id, playlist_id, song_id, user_id, action, time)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
      `,
      values: [id, playlistId, songId, userId, action, time],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0]?.id) {
      throw new InvariantError('Activity gagal ditambahkan ke playlist');
    }

    return result.rows[0].id;
  }

  async getPlaylistActivity(playlistId) {
    const query = {
      text: `
        SELECT users.username, songs.title,
          playlist_song_activities.action,
          playlist_song_activities.time
        FROM playlist_song_activities
        JOIN users ON users.id = playlist_song_activities.user_id
        JOIN songs ON songs.id = playlist_song_activities.song_id
        WHERE playlist_song_activities.playlist_id = $1
        ORDER BY playlist_song_activities.time ASC
      `,
      values: [playlistId],
    };

    const result = await this._pool.query(query);
    return result.rows;
  }

  async verifySongExists(songId) {
    const query = {
      text: 'SELECT id FROM songs WHERE id = $1',
      values: [songId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Lagu tidak ditemukan');
    }
  }

  async verifyPlaylistOwner(id, owner) {
    const query = {
      text: 'SELECT * FROM playlists WHERE id = $1',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Playlist tidak ditemukan');
    }

    if (result.rows[0].owner !== owner) {
      throw new AuthorizationError('Anda tidak berhak mengakses resource ini');
    }
  }

  async verifyPlaylistAccess(playlistId, userId) {
    try {
      await this.verifyPlaylistOwner(playlistId, userId);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      try {
        await this._collaborationsService.verifyCollaborator(
          playlistId,
          userId,
        );
      } catch {
        throw error;
      }
    }
  }
}

module.exports = PlaylistsService;
