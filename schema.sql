-- Database Schema for Zenith Dealers Meet Helper

-- 1. Sequences for auto-generating codes
CREATE SEQUENCE IF NOT EXISTS brand_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS category_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS channel_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS employee_code_seq START 1;

-- 2. Brands table
CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    brand_name VARCHAR(100) NOT NULL UNIQUE,
    brand_code VARCHAR(3) DEFAULT LPAD(nextval('brand_code_seq')::text, 3, '0') UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    category_code VARCHAR(3) DEFAULT LPAD(nextval('category_code_seq')::text, 3, '0') UNIQUE NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Channels table
CREATE TABLE IF NOT EXISTS channels (
    id SERIAL PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL UNIQUE,
    channel_code VARCHAR(3) DEFAULT LPAD(nextval('channel_code_seq')::text, 3, '0') UNIQUE NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Employees table
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_name VARCHAR(100) NOT NULL,
    employee_code VARCHAR(6) DEFAULT LPAD(nextval('employee_code_seq')::text, 6, '0') UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    mobile VARCHAR(15) UNIQUE,
    designation VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. GST Slabs table
CREATE TABLE IF NOT EXISTS gst (
    id SERIAL PRIMARY KEY,
    gst_name VARCHAR(50) NOT NULL UNIQUE,
    gst_rate NUMERIC(5,2) NOT NULL UNIQUE,
    description TEXT,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. HSN Codes table
CREATE TABLE IF NOT EXISTS hsn_codes (
    id SERIAL PRIMARY KEY,
    hsn_code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    gst_id INT REFERENCES gst(id) ON DELETE SET NULL,
    gst_rate NUMERIC(5,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
