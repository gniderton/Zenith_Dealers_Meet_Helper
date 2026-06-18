-- Database Schema for Zenith Dealers Meet Helper

-- 1. Sequences for auto-generating codes
CREATE SEQUENCE IF NOT EXISTS brand_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS category_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS channel_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS employee_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS product_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS route_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS customer_code_seq START 1;

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

-- 8. Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    brand_id INT REFERENCES brands(id) ON DELETE SET NULL,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    hsn_id INT REFERENCES hsn_codes(id) ON DELETE SET NULL,
    tax_id INT REFERENCES gst(id) ON DELETE SET NULL,
    product_code VARCHAR(50) UNIQUE,
    product_name VARCHAR(200) NOT NULL UNIQUE,
    ean_code VARCHAR(50),
    mrp NUMERIC(15,2) DEFAULT 0.00,
    purchase_rate NUMERIC(15,5) DEFAULT 0.00,
    distributor_rate NUMERIC(15,5) DEFAULT 0.00,
    wholesale_rate NUMERIC(15,5) DEFAULT 0.00,
    dealer_rate NUMERIC(15,5) DEFAULT 0.00,
    retail_rate NUMERIC(15,5) DEFAULT 0.00,
    case_quantity INT DEFAULT 1,
    uom VARCHAR(20) DEFAULT 'Pcs',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Trigger to auto-generate 9-digit product_code
CREATE OR REPLACE FUNCTION generate_product_code()
RETURNS TRIGGER AS $$
DECLARE
    b_code VARCHAR(3);
    c_code VARCHAR(3);
    p_seq INT;
    p_code VARCHAR(3);
BEGIN
    SELECT brand_code INTO b_code FROM brands WHERE id = NEW.brand_id;
    IF b_code IS NULL THEN b_code := '000'; END IF;

    SELECT category_code INTO c_code FROM categories WHERE id = NEW.category_id;
    IF c_code IS NULL THEN c_code := '000'; END IF;

    p_seq := nextval('product_code_seq');
    p_code := LPAD(p_seq::text, 3, '0');

    NEW.product_code := b_code || c_code || p_code;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_generate_product_code
BEFORE INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION generate_product_code();

-- 10. Routes table
CREATE TABLE IF NOT EXISTS routes (
    id SERIAL PRIMARY KEY,
    route_name VARCHAR(100) NOT NULL UNIQUE,
    route_code VARCHAR(3) DEFAULT LPAD(nextval('route_code_seq')::text, 3, '0') UNIQUE NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Customers table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(200) NOT NULL,
    customer_phone VARCHAR(15),
    email VARCHAR(100),
    gstin VARCHAR(20),
    pan VARCHAR(10),
    route_id INT REFERENCES routes(id) ON DELETE SET NULL,
    employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
    channel_id INT REFERENCES channels(id) ON DELETE SET NULL,
    customer_code VARCHAR(10) DEFAULT LPAD(nextval('customer_code_seq')::text, 4, '0') UNIQUE NOT NULL,
    whatsapp_number VARCHAR(15),
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    location_lat NUMERIC(10, 8),
    location_lng NUMERIC(11, 8),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
