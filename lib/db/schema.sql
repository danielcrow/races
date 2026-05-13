-- PostgreSQL Schema for Race Timing Application
-- Optimized for performance with proper indexes

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Races table
CREATE TABLE IF NOT EXISTS races (
    id SERIAL PRIMARY KEY,
    race_id INTEGER NOT NULL UNIQUE,
    race_name VARCHAR(500) NOT NULL,
    race_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_races_date ON races(race_date DESC);

-- Athletes table
CREATE TABLE IF NOT EXISTS athletes (
    id SERIAL PRIMARY KEY,
    athlete_id INTEGER NOT NULL UNIQUE,
    bib_number VARCHAR(50),
    notes TEXT,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    full_name VARCHAR(510) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    gender VARCHAR(20),
    date_of_birth DATE,
    passcode VARCHAR(8), -- 8-character passcode for athlete profile access
    passcode_created_at TIMESTAMP, -- Track when passcode was generated
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_athletes_name ON athletes(last_name, first_name);
CREATE INDEX idx_athletes_full_name ON athletes(full_name);
CREATE INDEX idx_athletes_bib ON athletes(bib_number);

-- Full-text search index for athlete names
CREATE INDEX idx_athletes_name_search ON athletes USING gin(to_tsvector('english', full_name));

-- Splits table (denormalized for performance)
CREATE TABLE IF NOT EXISTS splits (
    id SERIAL PRIMARY KEY,
    race_id INTEGER NOT NULL,
    athlete_id INTEGER NOT NULL,
    split_description VARCHAR(255),
    split_datetime TIMESTAMP,
    previous_split_datetime TIMESTAMP,
    split_seconds DECIMAL(10, 3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (race_id) REFERENCES races(race_id) ON DELETE CASCADE,
    FOREIGN KEY (athlete_id) REFERENCES athletes(athlete_id) ON DELETE CASCADE
);

CREATE INDEX idx_splits_race ON splits(race_id);
CREATE INDEX idx_splits_athlete ON splits(athlete_id);
CREATE INDEX idx_splits_race_athlete ON splits(race_id, athlete_id);
CREATE INDEX idx_splits_description ON splits(race_id, split_description);

-- Race results materialized view for fast queries
CREATE TABLE IF NOT EXISTS race_results (
    id SERIAL PRIMARY KEY,
    race_id INTEGER NOT NULL,
    athlete_id INTEGER NOT NULL,
    position INTEGER,
    bib_number VARCHAR(50),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    full_name VARCHAR(510),
    gender VARCHAR(20),
    age_on_dec31 INTEGER, -- Age on December 31st of race year
    age_category VARCHAR(10), -- BTF age category code (e.g., 'SEN', 'V40', 'U16')
    age_category_name VARCHAR(50), -- BTF age category name (e.g., 'Senior', 'Veteran 40-44')
    total_seconds DECIMAL(10, 3),
    total_time VARCHAR(50),
    is_relay BOOLEAN DEFAULT FALSE,
    relay_names TEXT[], -- Array of individual names in relay team
    splits JSONB, -- Store splits as JSON for fast access
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(race_id, athlete_id)
);

CREATE INDEX idx_race_results_race ON race_results(race_id);
CREATE INDEX idx_race_results_position ON race_results(race_id, position);
CREATE INDEX idx_race_results_athlete ON race_results(athlete_id);
CREATE INDEX idx_race_results_splits ON race_results USING gin(splits);
CREATE INDEX idx_race_results_gender ON race_results(race_id, gender);
CREATE INDEX idx_race_results_age_category ON race_results(race_id, age_category);
CREATE INDEX idx_race_results_relay ON race_results(race_id, is_relay);

-- Athlete statistics (pre-calculated for performance)
CREATE TABLE IF NOT EXISTS athlete_stats (
    id SERIAL PRIMARY KEY,
    athlete_id INTEGER NOT NULL UNIQUE,
    total_races INTEGER DEFAULT 0,
    best_position INTEGER,
    average_position DECIMAL(10, 2),
    best_time_seconds DECIMAL(10, 3),
    average_time_seconds DECIMAL(10, 3),
    first_race_date TIMESTAMP,
    last_race_date TIMESTAMP,
    races JSONB, -- Array of race summaries
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_athlete_stats_athlete ON athlete_stats(athlete_id);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_races_updated_at BEFORE UPDATE ON races
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_athletes_updated_at BEFORE UPDATE ON athletes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_race_results_updated_at BEFORE UPDATE ON race_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_athlete_stats_updated_at BEFORE UPDATE ON athlete_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Made with Bob