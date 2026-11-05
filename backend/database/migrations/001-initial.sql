CREATE TABLE gyms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  address TEXT NOT NULL,
  monthly INTEGER NOT NULL CHECK (monthly >= 0),
  day INTEGER NOT NULL CHECK (day >= 0),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  hours TEXT NOT NULL,
  image TEXT NOT NULL,
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  sample INTEGER NOT NULL DEFAULT 1 CHECK (sample IN (0, 1)),
  contact_url TEXT,
  sort_order INTEGER NOT NULL
);

CREATE TABLE equipment (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE amenities (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE gym_equipment (
  gym_id TEXT NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  PRIMARY KEY (gym_id, equipment_id)
);

CREATE TABLE gym_amenities (
  gym_id TEXT NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  amenity_id INTEGER NOT NULL REFERENCES amenities(id) ON DELETE RESTRICT,
  PRIMARY KEY (gym_id, amenity_id)
);

CREATE INDEX gyms_featured_sort_order ON gyms(featured DESC, sort_order);
CREATE INDEX gym_equipment_equipment_id ON gym_equipment(equipment_id, gym_id);
CREATE INDEX gym_amenities_amenity_id ON gym_amenities(amenity_id, gym_id);
