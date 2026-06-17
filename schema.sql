-- Database Schema for Zenith Dealers Meet Helper

-- Create sequence for brand codes if it does not exist
CREATE SEQUENCE IF NOT EXISTS brand_code_seq START 1;

-- 1. Brands table
CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    brand_name VARCHAR(100) NOT NULL UNIQUE,
    brand_code VARCHAR(3) DEFAULT LPAD(nextval('brand_code_seq')::text, 3, '0') UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    status VARCHAR(20) DEFAULT 'Active', -- Active, Inactive
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
