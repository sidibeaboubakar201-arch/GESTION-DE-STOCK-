import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'securstock.sqlite');

let dbInstance: Database | null = null;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.error('Failed to load existing database file, creating a new one', err);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Enable foreign keys
  dbInstance.run('PRAGMA foreign_keys = ON;');

  // Initialize schema
  initializeSchema(dbInstance);

  return dbInstance;
}

export function saveDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to persist SQLite database to disk:', err);
  }
}

export function getDbSync(): Database {
  if (!dbInstance) {
    throw new Error('Database not initialized yet. Call await getDb() first.');
  }
  return dbInstance;
}

function initializeSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'magasinier')),
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      contact_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      barcode TEXT,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      brand TEXT NOT NULL,
      description TEXT,
      purchase_price INTEGER NOT NULL CHECK(purchase_price >= 0),
      selling_price INTEGER CHECK(selling_price >= 0),
      current_stock INTEGER NOT NULL DEFAULT 0 CHECK(current_stock >= 0),
      min_stock_alert INTEGER NOT NULL DEFAULT 5 CHECK(min_stock_alert >= 0),
      unit TEXT NOT NULL DEFAULT 'Pièce',
      location TEXT,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movement_number TEXT UNIQUE NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id),
      type TEXT NOT NULL CHECK(type IN ('ENTREE', 'SORTIE', 'AJUSTEMENT_INVENTAIRE')),
      quantity INTEGER NOT NULL,
      stock_before INTEGER NOT NULL,
      stock_after INTEGER NOT NULL,
      unit_price INTEGER,
      reason TEXT NOT NULL,
      document_reference TEXT,
      partner_name TEXT,
      supplier_id INTEGER REFERENCES suppliers(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      user_name TEXT NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_number TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('EN_COURS', 'VALIDE', 'ANNULE')),
      notes TEXT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      user_name TEXT NOT NULL,
      total_items INTEGER DEFAULT 0,
      total_discrepancies INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      theoretical_stock INTEGER NOT NULL,
      counted_stock INTEGER NOT NULL,
      discrepancy INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      adjusted INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_movements_type ON stock_movements(type);
    CREATE INDEX IF NOT EXISTS idx_movements_date ON stock_movements(created_at);
  `);

  // Seed default categories if empty
  const catCount = db.exec('SELECT COUNT(*) as count FROM categories')[0]?.values[0][0] as number;
  if (!catCount || catCount === 0) {
    const initialCategories = [
      ['Caméras de surveillance', 'CAM', 'Caméras IP, dômes, tubes, PTZ et caméras solaires'],
      ['Enregistreurs DVR et NVR', 'REC', 'Enregistreurs vidéo 4/8/16/32 voies, disques durs spécialisés'],
      ['Alarmes anti-intrusion', 'ALM', 'Centrales d\'alarme sans fil, sirènes intérieures et extérieures'],
      ['Détecteurs de mouvement et d\'ouverture', 'DET', 'Capteurs infrarouges, contacts magnétiques, bris de verre'],
      ['Contrôle d\'accès et badges', 'ACC', 'Lecteurs biométriques, claviers à code, gâches électriques et badges RFID'],
      ['Interphones et visiophones', 'INT', 'Visiophones IP, portiers vidéo filaires et combinés audio'],
      ['Câbles et connectiques', 'CAB', 'Câbles RJ45 Cat6, coaxiaux KX6, connecteurs BNC et RJ45'],
      ['Alimentations et batteries', 'PWR', 'Boîtiers d\'alimentation 12V secourus, batteries étanches 12V 7Ah'],
      ['Extincteurs et équipements incendie', 'INC', 'Extincteurs CO2, poudre ABC, détecteurs optiques de fumée'],
      ['Équipements de protection individuelle', 'EPI', 'Casques de chantier, gilets haute visibilité, gants d\'électricien'],
      ['Matériel électrique', 'ELEC', 'Disjoncteurs, goulottes de câblage, prises ondulées et parafoudres'],
      ['Accessoires et pièces de rechange', 'ACCES', 'Supports muraux, boîtiers étanches de raccordement, visserie'],
      ['Autres produits', 'AUTRE', 'Consommables et matériels divers de sécurité']
    ];

    const catStmt = db.prepare('INSERT INTO categories (name, code, description) VALUES (?, ?, ?)');
    for (const [name, code, desc] of initialCategories) {
      catStmt.run([name, code, desc]);
    }
    catStmt.free();
  }

  // Seed default users if empty
  const userCount = db.exec('SELECT COUNT(*) as count FROM users')[0]?.values[0][0] as number;
  if (!userCount || userCount === 0) {
    // Admin password: Admin@2026
    const adminHash = bcrypt.hashSync('Admin@2026', 10);
    // Magasinier password: Magasin@2026
    const magasinierHash = bcrypt.hashSync('Magasin@2026', 10);

    const userStmt = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `);

    userStmt.run(['admin@securstock.com', adminHash, 'Aboubacar SIDIBE (Administrateur)', 'admin', '+225 07 00 00 01']);
    userStmt.run(['magasinier@securstock.com', magasinierHash, 'Koffi KOUAME (Magasinier Principal)', 'magasinier', '+225 05 00 00 02']);
    userStmt.free();
  }

  // Seed demonstration suppliers and products if empty
  const prodCount = db.exec('SELECT COUNT(*) as count FROM products')[0]?.values[0][0] as number;
  if (!prodCount || prodCount === 0) {
    seedDemoData(db);
  }

  saveDb();
}

function seedDemoData(db: Database) {
  // Demo Suppliers
  const supStmt = db.prepare(`
    INSERT INTO suppliers (name, contact_name, phone, email, address, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  supStmt.run([
    'Hikvision Distribution West Africa',
    'Marc DUPONT',
    '+225 27 22 45 80',
    'contact@hikvision-wa.com',
    'Zone 3, Boulevard de Marseille, Abidjan',
    'Fournisseur officiel matériel vidéosurveillance et contrôle d\'accès'
  ]);
  supStmt.run([
    'Dahua Security CI',
    'Alain KABLAN',
    '+225 21 35 12 90',
    'commercial@dahua-ci.com',
    'Plateau, Rue du Commerce, Abidjan',
    'Partenaire pour caméras thermiques et enregistreurs NVR'
  ]);
  supStmt.run([
    'Sécurité Incendie Plus',
    'Mamadou TRAORE',
    '+225 27 20 22 11',
    'ventes@incendie-plus.ci',
    'Zone Industrielle Yopougon, Abidjan',
    'Fournisseur extincteurs NF, RIA et détecteurs de fumée'
  ]);
  supStmt.run([
    'Câblerie & Connectique Pro',
    'Sébastien KOFFI',
    '+225 07 48 99 33',
    'info@cablerie-pro.ci',
    'Treichville, Avenue 16, Abidjan',
    'Câblage réseau Cat6 cuivre pur, goulottes et baies de brassage'
  ]);
  supStmt.free();

  // Fetch category IDs
  const categories = queryAll(db, 'SELECT id, code FROM categories');
  const catMap: Record<string, number> = {};
  for (const c of categories) {
    catMap[c.code] = c.id;
  }

  // Demo Products with realistic security gear and FCFA prices
  const demoProducts = [
    {
      sku: 'CAM-HIK-2CD2047G2',
      barcode: '6941264082214',
      name: 'Caméra Tube IP ColorVu 4MP Hikvision',
      cat: 'CAM',
      brand: 'Hikvision',
      desc: 'Caméra extérieure IP 4 Mégapixels avec vision nocturne couleur 24/7, objectif 2.8mm, IP67.',
      purchase: 45000,
      selling: 75000,
      stock: 18,
      min: 5,
      unit: 'Pièce',
      loc: 'Rayon A-01'
    },
    {
      sku: 'CAM-DAH-HDW1200T',
      barcode: '6939554910452',
      name: 'Caméra Dôme HDCVI 2MP Dahua Eyeball',
      cat: 'CAM',
      brand: 'Dahua',
      desc: 'Caméra dôme analogique HD 1080p, IR 30m, objectif fixe 3.6mm, boîtier métallique étanche.',
      purchase: 16500,
      selling: 28000,
      stock: 35,
      min: 10,
      unit: 'Pièce',
      loc: 'Rayon A-02'
    },
    {
      sku: 'CAM-SOL-PTZ4G',
      barcode: '6942008819031',
      name: 'Caméra PTZ Solaire 4G Autonome 2K',
      cat: 'CAM',
      brand: 'SecurVision',
      desc: 'Caméra autonome avec panneau solaire 20W, batterie rechargeable intégrée, carte SIM 4G.',
      purchase: 85000,
      selling: 145000,
      stock: 4, // Stock faible
      min: 5,
      unit: 'Pièce',
      loc: 'Rayon A-03'
    },
    {
      sku: 'NVR-HIK-7608NI-K2',
      barcode: '6941264077654',
      name: 'Enregistreur NVR 8 Voies PoE 4K Hikvision',
      cat: 'REC',
      brand: 'Hikvision',
      desc: 'NVR 8 canaux avec 8 ports PoE intégrés, décodage 4K H.265+, support 2 disques SATA jusqu\'à 16To.',
      purchase: 82000,
      selling: 135000,
      stock: 8,
      min: 3,
      unit: 'Pièce',
      loc: 'Rayon B-01'
    },
    {
      sku: 'HDD-WD-PURZ-4TB',
      barcode: '718037856704',
      name: 'Disque Dur Surveillance 4To WD Purple',
      cat: 'REC',
      brand: 'Western Digital',
      desc: 'Disque dur interne 3.5 pouces SATA III 64Mo cache 5400 RPM conçu pour vidéosurveillance continue 24/7.',
      purchase: 62000,
      selling: 89000,
      stock: 12,
      min: 4,
      unit: 'Pièce',
      loc: 'Rayon B-02'
    },
    {
      sku: 'ALM-AJX-HUB2-PLUS',
      barcode: '4820202930112',
      name: 'Centrale d\'Alarme sans fil Ajax Hub 2 Plus',
      cat: 'ALM',
      brand: 'Ajax Systems',
      desc: 'Centrale intelligente 200 détecteurs, Ethernet, Wi-Fi et double carte SIM 4G, transmission photo rapide.',
      purchase: 165000,
      selling: 245000,
      stock: 3, // Stock faible
      min: 4,
      unit: 'Kit',
      loc: 'Rayon C-01'
    },
    {
      sku: 'DET-AJX-MOTIONCAM',
      barcode: '4820202930259',
      name: 'Détecteur de Mouvement avec Caméra Ajax MotionCam',
      cat: 'DET',
      brand: 'Ajax Systems',
      desc: 'Détecteur infrarouge sans fil immunisé aux animaux jusqu\'à 20kg avec vérification photo des alertes.',
      purchase: 48000,
      selling: 78000,
      stock: 15,
      min: 6,
      unit: 'Pièce',
      loc: 'Rayon C-02'
    },
    {
      sku: 'ACC-ZK-F22-BIO',
      barcode: '840139102844',
      name: 'Terminal Pointeuse & Contrôle d\'Accès Biométrique ZKTeco',
      cat: 'ACC',
      brand: 'ZKTeco',
      desc: 'Lecteur d\'empreintes digitales ultra-fin avec clavier tactile, badge RFID et interface TCP/IP, Wiegand.',
      purchase: 75000,
      selling: 125000,
      stock: 0, // Rupture de stock
      min: 3,
      unit: 'Pièce',
      loc: 'Rayon D-01'
    },
    {
      sku: 'ACC-VENT-MAG-280',
      barcode: '741289003411',
      name: 'Ventouse Électromagnétique 280kg avec Équerre ZL',
      cat: 'ACC',
      brand: 'SecurDoor',
      desc: 'Force de rétention 280kg (600lbs) 12V DC avec voyant LED d\'état et contact de position de porte.',
      purchase: 22000,
      selling: 38000,
      stock: 14,
      min: 5,
      unit: 'Kit',
      loc: 'Rayon D-02'
    },
    {
      sku: 'CAB-RJ45-CAT6-UTP',
      barcode: '3700142809112',
      name: 'Bobine Câble Réseau RJ45 Cat6 UTP 305m Cuivre Pur',
      cat: 'CAB',
      brand: 'Nexans Pro',
      desc: 'Touret de câble Ethernet catégorie 6 100% cuivre 23AWG pour liaisons caméras IP et bornes PoE.',
      purchase: 48000,
      selling: 72000,
      stock: 9,
      min: 3,
      unit: 'Rouleau',
      loc: 'Zone Câblage'
    },
    {
      sku: 'PWR-BOX-12V-10A',
      barcode: '6940028192033',
      name: 'Boîtier Alimentation Secourue 12V 10A 9 Sorties Fusibles',
      cat: 'PWR',
      brand: 'PowerSecur',
      desc: 'Coffret métallique avec emplacement batterie 12V 7Ah, protection contre surtensions et courts-circuits.',
      purchase: 24000,
      selling: 42000,
      stock: 11,
      min: 4,
      unit: 'Pièce',
      loc: 'Rayon E-01'
    },
    {
      sku: 'PWR-BAT-12V-7AH',
      barcode: '793573199801',
      name: 'Batterie Plomb Étanche AGM 12V 7Ah sans Entretien',
      cat: 'PWR',
      brand: 'Yuasa',
      desc: 'Batterie de secours au plomb pour centrales d\'alarme, portiers vidéo et alimentations secourues.',
      purchase: 9500,
      selling: 16000,
      stock: 26,
      min: 8,
      unit: 'Pièce',
      loc: 'Rayon E-02'
    },
    {
      sku: 'INC-EXT-ABC-6KG',
      barcode: '3482910045123',
      name: 'Extincteur à Poudre Polyvalente ABC 6kg Pressurisé',
      cat: 'INC',
      brand: 'Sicli Protect',
      desc: 'Extincteur agréé NF pour feux de classe A (solides), B (liquides) et C (gaz), livré avec manomètre.',
      purchase: 28000,
      selling: 45000,
      stock: 7,
      min: 5,
      unit: 'Pièce',
      loc: 'Hangar Sécurité'
    },
    {
      sku: 'EPI-CASQ-CHNT-BLC',
      barcode: '3295249122340',
      name: 'Casque de Sécurité Chantier Ventilé Blanc Delta Plus',
      cat: 'EPI',
      brand: 'Delta Plus',
      desc: 'Casque en polypropylène haute résistance avec harnais coiffe 8 points de fixation et jugulaire.',
      purchase: 4200,
      selling: 7500,
      stock: 0, // Rupture
      min: 6,
      unit: 'Pièce',
      loc: 'Rayon EPI'
    }
  ];

  const prodStmt = db.prepare(`
    INSERT INTO products (
      sku, barcode, name, category_id, brand, description,
      purchase_price, selling_price, current_stock, min_stock_alert,
      unit, location, is_archived
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  for (const p of demoProducts) {
    const catId = catMap[p.cat] || Object.values(catMap)[0];
    prodStmt.run([
      p.sku,
      p.barcode,
      p.name,
      catId,
      p.brand,
      p.desc,
      p.purchase,
      p.selling,
      p.stock,
      p.min,
      p.unit,
      p.loc
    ]);
  }
  prodStmt.free();

  // Create initial stock movements for these products
  const products = queryAll(db, 'SELECT id, sku, name, current_stock, purchase_price FROM products');
  const movStmt = db.prepare(`
    INSERT INTO stock_movements (
      movement_number, product_id, type, quantity, stock_before,
      stock_after, unit_price, reason, document_reference, partner_name,
      supplier_id, user_id, user_name, comment, created_at
    ) VALUES (?, ?, 'ENTREE', ?, 0, ?, ?, 'Réception initiale de stock', ?, ?, 1, 1, 'Aboubacar SIDIBE (Administrateur)', ?, datetime('now', '-3 days'))
  `);

  let count = 1;
  for (const prod of products) {
    if (prod.current_stock > 0) {
      const movNumber = `ENT-202610-${String(count).padStart(4, '0')}`;
      movStmt.run([
        movNumber,
        prod.id,
        prod.current_stock,
        prod.current_stock,
        prod.purchase_price,
        `BL-INIT-${count}`,
        'Hikvision Distribution West Africa',
        'Stockage initial validé lors de la mise en service du magasin'
      ]);
      count++;
    }
  }
  movStmt.free();

  // Add one recent stock out to test history
  if (products.length > 0) {
    const p1 = products[0];
    const outStmt = db.prepare(`
      INSERT INTO stock_movements (
        movement_number, product_id, type, quantity, stock_before,
        stock_after, unit_price, reason, document_reference, partner_name,
        user_id, user_name, comment, created_at
      ) VALUES (?, ?, 'SORTIE', 2, ?, ?, ?, 'Installation chez un client', 'DEV-2026-88', 'Banque Atlantique CI', 2, 'Koffi KOUAME (Magasinier Principal)', 'Installation de 2 caméras pour l''agence Plateau', datetime('now', '-1 days'))
    `);
    outStmt.run([
      `SOR-202610-0001`,
      p1.id,
      p1.current_stock + 2,
      p1.current_stock,
      p1.purchase_price
    ]);
    outStmt.free();
  }

  // Add an audit log
  db.run(`
    INSERT INTO audit_logs (user_id, user_name, action, details, ip_address)
    VALUES (1, 'Aboubacar SIDIBE (Administrateur)', 'INITIALISATION', 'Initialisation de la base de données et chargement du stock de départ', '127.0.0.1')
  `);
}

// SQL query helpers
export function queryAll<T = any>(db: Database, sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = any>(db: Database, sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function runQuery(db: Database, sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
  saveDb();
  
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0] as number;
  const changes = db.exec('SELECT changes() as cnt')[0]?.values[0][0] as number;
  return { lastInsertRowid: lastId, changes };
}
