-- Database Schema for Zenith Dealers Meet Helper

-- 1. Dealers table
CREATE TABLE IF NOT EXISTS dealers (
    id SERIAL PRIMARY KEY,
    dealer_name VARCHAR(100) NOT NULL,
    shop_name VARCHAR(150) NOT NULL,
    region VARCHAR(100) NOT NULL,
    mobile VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(100),
    rsvp_status VARCHAR(50) DEFAULT 'Pending', -- Pending, Attending, Declined
    attendance_status VARCHAR(50) DEFAULT 'Registered', -- Registered, Checked-In, Absent
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Check-ins & Accommodations
CREATE TABLE IF NOT EXISTS checkins (
    id SERIAL PRIMARY KEY,
    dealer_id INT REFERENCES dealers(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    hotel_room_no VARCHAR(20),
    transport_mode VARCHAR(50), -- Flight, Train, Car, Bus
    transport_details VARCHAR(200),
    remarks TEXT
);

-- 3. Agenda & Schedules
CREATE TABLE IF NOT EXISTS agenda (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    speaker VARCHAR(100),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    venue VARCHAR(100) DEFAULT 'Main Hall'
);

-- 4. Feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    dealer_id INT REFERENCES dealers(id) ON DELETE SET NULL,
    session_rating INT CHECK (session_rating BETWEEN 1 AND 5),
    food_rating INT CHECK (food_rating BETWEEN 1 AND 5),
    overall_rating INT CHECK (overall_rating BETWEEN 1 AND 5),
    comments TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Admin Settings / System Config
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
