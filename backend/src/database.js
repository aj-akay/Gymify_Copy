import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { sampleGyms } from './data/sample-gyms.js';

const migrationPath = fileURLToPath(new URL('../database/migrations/001-initial.sql', import.meta.url));
const defaultDatabasePath = fileURLToPath(new URL('../data/gymify.sqlite', import.meta.url));

function seedDatabase(database) {
  const insertGym = database.prepare(`
    INSERT INTO gyms (
      id, name, area, address, monthly, day, category, description,
      hours, image, featured, sample, contact_url, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEquipment = database.prepare('INSERT OR IGNORE INTO equipment (name) VALUES (?)');
  const getEquipment = database.prepare('SELECT id FROM equipment WHERE name = ?');
  const linkEquipment = database.prepare('INSERT INTO gym_equipment (gym_id, equipment_id) VALUES (?, ?)');
  const insertAmenity = database.prepare('INSERT OR IGNORE INTO amenities (name) VALUES (?)');
  const getAmenity = database.prepare('SELECT id FROM amenities WHERE name = ?');
  const linkAmenity = database.prepare('INSERT INTO gym_amenities (gym_id, amenity_id) VALUES (?, ?)');

  database.exec('BEGIN IMMEDIATE');
  try {
    for (const gym of sampleGyms) {
      insertGym.run(
        gym.id, gym.name, gym.area, gym.address, gym.monthly, gym.day,
        gym.category, gym.description, gym.hours, gym.image, Number(gym.featured),
        Number(gym.sample), gym.contactUrl, gym.sortOrder,
      );
      for (const name of gym.equipment) {
        insertEquipment.run(name);
        linkEquipment.run(gym.id, getEquipment.get(name).id);
      }
      for (const name of gym.amenities) {
        insertAmenity.run(name);
        linkAmenity.run(gym.id, getAmenity.get(name).id);
      }
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function openDatabase(path = process.env.GYMIFY_DATABASE_PATH || defaultDatabasePath) {
  const databasePath = path === ':memory:' ? path : resolve(path);
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });

  const database = new Database(databasePath);
  database.exec('PRAGMA foreign_keys = ON;');
  const version = database.prepare('PRAGMA user_version').get().user_version;
  if (version < 1) {
    database.exec('BEGIN IMMEDIATE');
    try {
      database.exec(readFileSync(migrationPath, 'utf8'));
      database.exec('PRAGMA user_version = 1;');
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  if (database.prepare('SELECT COUNT(*) AS count FROM gyms').get().count === 0) {
    seedDatabase(database);
  }

  return database;
}

function readNames(database, table, joinTable, gymIds) {
  if (gymIds.length === 0) return new Map();
  const placeholders = gymIds.map(() => '?').join(', ');
  const rows = database.prepare(`
    SELECT link.gym_id AS gymId, item.name
    FROM ${joinTable} AS link
    JOIN ${table} AS item ON item.id = link.${table === 'equipment' ? 'equipment' : 'amenity'}_id
    WHERE link.gym_id IN (${placeholders})
    ORDER BY item.name
  `).all(...gymIds);
  const namesByGym = new Map(gymIds.map((id) => [id, []]));
  for (const row of rows) namesByGym.get(row.gymId).push(row.name);
  return namesByGym;
}

export function listGyms(database, { query, budget, equipment, amenities, sort, featured, ids }) {
  const conditions = [];
  const parameters = [];

  if (query) {
    conditions.push('(LOWER(name) LIKE ? OR LOWER(area) LIKE ? OR LOWER(category) LIKE ?)');
    const searchTerm = `%${query.toLocaleLowerCase()}%`;
    parameters.push(searchTerm, searchTerm, searchTerm);
  }
  if (budget !== undefined) {
    conditions.push('monthly <= ?');
    parameters.push(budget);
  }
  if (featured !== undefined) {
    conditions.push('featured = ?');
    parameters.push(Number(featured));
  }
  if (ids) {
    conditions.push(`id IN (${ids.map(() => '?').join(', ')})`);
    parameters.push(...ids);
  }
  for (const name of equipment) {
    conditions.push(`EXISTS (
      SELECT 1 FROM gym_equipment AS link
      JOIN equipment AS item ON item.id = link.equipment_id
      WHERE link.gym_id = gyms.id AND item.name = ?
    )`);
    parameters.push(name);
  }
  for (const name of amenities) {
    conditions.push(`EXISTS (
      SELECT 1 FROM gym_amenities AS link
      JOIN amenities AS item ON item.id = link.amenity_id
      WHERE link.gym_id = gyms.id AND item.name = ?
    )`);
    parameters.push(name);
  }

  const ordering = sort === 'low'
    ? 'monthly ASC, sort_order ASC'
    : sort === 'high'
      ? 'monthly DESC, sort_order ASC'
      : 'featured DESC, sort_order ASC';
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = database.prepare(`SELECT * FROM gyms ${where} ORDER BY ${ordering}`).all(...parameters);
  return attachRelations(database, rows);
}

export function getGymById(database, id) {
  const row = database.prepare('SELECT * FROM gyms WHERE id = ?').get(id);
  return row ? attachRelations(database, [row])[0] : null;
}

export function getGymFilterOptions(database) {
  return {
    equipment: database.prepare('SELECT name FROM equipment ORDER BY name').all().map((row) => row.name),
    amenities: database.prepare('SELECT name FROM amenities ORDER BY name').all().map((row) => row.name),
  };
}

function attachRelations(database, rows) {
  const ids = rows.map((row) => row.id);
  const equipment = readNames(database, 'equipment', 'gym_equipment', ids);
  const amenities = readNames(database, 'amenities', 'gym_amenities', ids);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    area: row.area,
    address: row.address,
    monthly: row.monthly,
    day: row.day,
    category: row.category,
    description: row.description,
    equipment: equipment.get(row.id),
    amenities: amenities.get(row.id),
    hours: row.hours,
    image: row.image,
    featured: Boolean(row.featured),
    sample: Boolean(row.sample),
    contactUrl: row.contact_url,
  }));
}
