import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, queryAll, queryOne, runQuery, saveDb } from './db.ts';
import { requireAuth, requireAdmin, AuthenticatedRequest, generateToken } from './auth.ts';

const router = express.Router();

// Helper to log audit actions
function logAudit(userId: number | null, userName: string, action: string, details: string, ip: string = '127.0.0.1') {
  try {
    const db = getDbSync();
    db.run(
      'INSERT INTO audit_logs (user_id, user_name, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [userId, userName, action, details, ip]
    );
    saveDb();
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

function getDbSync() {
  // Safe helper
  return (getDb as any).cachedDb;
}

// Ensure db is loaded
getDb().then(db => {
  (getDb as any).cachedDb = db;
});

// ==========================================
// AUTHENTICATION
// ==========================================
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Adresse e-mail et mot de passe requis.' });
    }

    const db = await getDb();
    const user = queryOne(db, 'SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const authUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role
    };

    const token = generateToken(authUser);
    logAudit(user.id, user.full_name, 'CONNEXION', `Connexion réussie (${user.email})`, req.ip);

    res.json({
      token,
      user: authUser
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la connexion.' });
  }
});

router.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

router.post('/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Veuillez saisir votre mot de passe actuel et le nouveau mot de passe.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit comporter au moins 6 caractères.' });
    }

    const db = await getDb();
    const user = queryOne(db, 'SELECT * FROM users WHERE id = ?', [req.user!.id]);
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: 'Le mot de passe actuel est erroné.' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    runQuery(db, 'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, req.user!.id]);
    logAudit(req.user!.id, req.user!.full_name, 'MODIFICATION_MOT_DE_PASSE', 'Mise à jour du mot de passe utilisateur');

    res.json({ success: true, message: 'Mot de passe modifié avec succès.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe.' });
  }
});

// ==========================================
// DASHBOARD
// ==========================================
router.get('/dashboard/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();

    // 1. Total references
    const refCount = queryOne(db, 'SELECT COUNT(*) as count FROM products WHERE is_archived = 0')?.count || 0;

    // 2. Total quantity in stock & total valuation
    const stockVal = queryOne(db, `
      SELECT 
        COALESCE(SUM(current_stock), 0) as total_quantity,
        COALESCE(SUM(current_stock * purchase_price), 0) as total_valuation
      FROM products 
      WHERE is_archived = 0
    `);

    // 3. Low stock and out of stock
    const lowStockCount = queryOne(db, `
      SELECT COUNT(*) as count 
      FROM products 
      WHERE is_archived = 0 AND current_stock > 0 AND current_stock <= min_stock_alert
    `)?.count || 0;

    const outOfStockCount = queryOne(db, `
      SELECT COUNT(*) as count 
      FROM products 
      WHERE is_archived = 0 AND current_stock = 0
    `)?.count || 0;

    // 4. Today's entries & exits (using local date string YYYY-MM-DD)
    const todayEntries = queryOne(db, `
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(quantity), 0) as total_qty
      FROM stock_movements 
      WHERE type = 'ENTREE' AND date(created_at) = date('now')
    `);

    const todayExits = queryOne(db, `
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(quantity), 0) as total_qty
      FROM stock_movements 
      WHERE type = 'SORTIE' AND date(created_at) = date('now')
    `);

    // 5. Recent movements (latest 8)
    const recentMovements = queryAll(db, `
      SELECT 
        m.*,
        p.name as product_name,
        p.sku as product_sku,
        p.unit as product_unit
      FROM stock_movements m
      JOIN products p ON m.product_id = p.id
      ORDER BY m.id DESC
      LIMIT 8
    `);

    // 6. Products needing restock (current_stock <= min_stock_alert)
    const restockNeeded = queryAll(db, `
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.current_stock,
        p.min_stock_alert,
        p.unit,
        p.purchase_price,
        c.name as category_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_archived = 0 AND p.current_stock <= p.min_stock_alert
      ORDER BY (p.current_stock - p.min_stock_alert) ASC, p.current_stock ASC
      LIMIT 8
    `);

    // 7. Last 7 days movement volume chart
    const chartData = queryAll(db, `
      WITH RECURSIVE dates(d) AS (
        SELECT date('now', '-6 days')
        UNION ALL
        SELECT date(d, '+1 day') FROM dates WHERE d < date('now')
      )
      SELECT 
        dates.d as date,
        COALESCE(SUM(CASE WHEN m.type = 'ENTREE' THEN m.quantity ELSE 0 END), 0) as entries_qty,
        COALESCE(SUM(CASE WHEN m.type = 'SORTIE' THEN m.quantity ELSE 0 END), 0) as exits_qty
      FROM dates
      LEFT JOIN stock_movements m ON date(m.created_at) = dates.d
      GROUP BY dates.d
      ORDER BY dates.d ASC
    `);

    // 8. Category distribution
    const categoryStats = queryAll(db, `
      SELECT 
        c.name as category_name,
        COUNT(p.id) as product_count,
        COALESCE(SUM(p.current_stock), 0) as total_stock,
        COALESCE(SUM(p.current_stock * p.purchase_price), 0) as total_value
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_archived = 0
      GROUP BY c.id
      ORDER BY total_value DESC
      LIMIT 5
    `);

    res.json({
      totalReferences: refCount,
      totalQuantity: stockVal?.total_quantity || 0,
      totalValuation: stockVal?.total_valuation || 0,
      lowStockCount,
      outOfStockCount,
      todayEntriesCount: todayEntries?.count || 0,
      todayEntriesQty: todayEntries?.total_qty || 0,
      todayExitsCount: todayExits?.count || 0,
      todayExitsQty: todayExits?.total_qty || 0,
      recentMovements,
      restockNeeded,
      chartData,
      categoryStats
    });
  } catch (err: any) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques.' });
  }
});

// ==========================================
// PRODUCTS
// ==========================================
router.get('/products', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const { search, category_id, status, sort_by, sort_dir } = req.query;

    let sql = `
      SELECT 
        p.*,
        c.name as category_name,
        c.code as category_code
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Archived filter
    if (status === 'archived') {
      sql += ' AND p.is_archived = 1';
    } else {
      sql += ' AND p.is_archived = 0';
      if (status === 'out_of_stock') {
        sql += ' AND p.current_stock = 0';
      } else if (status === 'low_stock') {
        sql += ' AND p.current_stock > 0 AND p.current_stock <= p.min_stock_alert';
      } else if (status === 'in_stock') {
        sql += ' AND p.current_stock > p.min_stock_alert';
      } else if (status === 'restock') {
        sql += ' AND p.current_stock <= p.min_stock_alert';
      }
    }

    if (category_id) {
      sql += ' AND p.category_id = ?';
      params.push(Number(category_id));
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = `%${search.trim().toLowerCase()}%`;
      sql += ' AND (LOWER(p.name) LIKE ? OR LOWER(p.sku) LIKE ? OR LOWER(p.brand) LIKE ? OR LOWER(COALESCE(p.barcode, "")) LIKE ?)';
      params.push(q, q, q, q);
    }

    // Sorting
    const validSortCols: Record<string, string> = {
      name: 'p.name',
      sku: 'p.sku',
      current_stock: 'p.current_stock',
      purchase_price: 'p.purchase_price',
      selling_price: 'p.selling_price',
      category: 'c.name',
      created_at: 'p.created_at'
    };
    const col = validSortCols[String(sort_by)] || 'p.id';
    const dir = sort_dir === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${col} ${dir}`;

    const products = queryAll(db, sql, params);
    res.json(products);
  } catch (err: any) {
    console.error('Products error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits.' });
  }
});

router.get('/products/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const product = queryOne(db, `
      SELECT p.*, c.name as category_name, c.code as category_code
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé.' });
    }

    // Get product movement history
    const movements = queryAll(db, `
      SELECT m.*, u.full_name as recorder_name
      FROM stock_movements m
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.product_id = ?
      ORDER BY m.id DESC
      LIMIT 15
    `, [product.id]);

    res.json({
      ...product,
      movements
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la récupération de la fiche produit.' });
  }
});

router.post('/products', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      sku,
      barcode,
      name,
      category_id,
      brand,
      description,
      purchase_price,
      selling_price,
      current_stock,
      min_stock_alert,
      unit,
      location
    } = req.body;

    if (!sku || !name || !category_id || !brand || purchase_price === undefined) {
      return res.status(400).json({ error: 'Champs obligatoires manquants : SKU, Nom, Catégorie, Marque, Prix d\'achat.' });
    }

    const pPrice = Math.round(Number(purchase_price));
    const sPrice = selling_price !== undefined && selling_price !== '' ? Math.round(Number(selling_price)) : null;
    const initialStock = Math.max(0, Math.round(Number(current_stock) || 0));
    const minStock = Math.max(0, Math.round(Number(min_stock_alert) || 5));

    if (pPrice < 0) {
      return res.status(400).json({ error: 'Le prix d\'achat ne peut pas être négatif.' });
    }
    if (sPrice !== null && sPrice < 0) {
      return res.status(400).json({ error: 'Le prix de vente ne peut pas être négatif.' });
    }

    const db = await getDb();

    // Check SKU uniqueness
    const existing = queryOne(db, 'SELECT id FROM products WHERE LOWER(sku) = LOWER(?)', [sku.trim()]);
    if (existing) {
      return res.status(400).json({ error: `La référence SKU "${sku}" existe déjà dans la base de données.` });
    }

    // Begin atomic product creation
    db.run('BEGIN TRANSACTION;');

    try {
      const insertStmt = db.prepare(`
        INSERT INTO products (
          sku, barcode, name, category_id, brand, description,
          purchase_price, selling_price, current_stock, min_stock_alert,
          unit, location, is_archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);

      insertStmt.run([
        sku.trim().toUpperCase(),
        barcode ? barcode.trim() : null,
        name.trim(),
        Number(category_id),
        brand.trim(),
        description ? description.trim() : null,
        pPrice,
        sPrice,
        initialStock,
        minStock,
        unit || 'Pièce',
        location ? location.trim() : null
      ]);
      insertStmt.free();

      const newId = db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0] as number;

      // If initial stock > 0, generate initial entry movement
      if (initialStock > 0) {
        const movNumber = `ENT-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(Date.now()).slice(-4)}`;
        const movStmt = db.prepare(`
          INSERT INTO stock_movements (
            movement_number, product_id, type, quantity, stock_before,
            stock_after, unit_price, reason, user_id, user_name, comment
          ) VALUES (?, ?, 'ENTREE', ?, 0, ?, ?, 'Stock initial lors de la création du produit', ?, ?, 'Création de fiche')
        `);
        movStmt.run([
          movNumber,
          newId,
          initialStock,
          initialStock,
          pPrice,
          req.user!.id,
          req.user!.full_name
        ]);
        movStmt.free();
      }

      db.run('COMMIT;');
      saveDb();

      logAudit(req.user!.id, req.user!.full_name, 'CREATION_PRODUIT', `Création du produit ${name} (${sku}) avec stock ${initialStock}`);

      const createdProduct = queryOne(db, 'SELECT * FROM products WHERE id = ?', [newId]);
      res.status(201).json(createdProduct);
    } catch (err: any) {
      db.run('ROLLBACK;');
      throw err;
    }
  } catch (err: any) {
    console.error('Product create error:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la création du produit.' });
  }
});

router.put('/products/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      sku,
      barcode,
      name,
      category_id,
      brand,
      description,
      purchase_price,
      selling_price,
      min_stock_alert,
      unit,
      location
    } = req.body;

    const db = await getDb();
    const existing = queryOne(db, 'SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }

    if (sku && sku.trim().toUpperCase() !== existing.sku) {
      const dup = queryOne(db, 'SELECT id FROM products WHERE LOWER(sku) = LOWER(?) AND id != ?', [sku.trim(), id]);
      if (dup) {
        return res.status(400).json({ error: `La référence SKU "${sku}" est déjà utilisée par un autre article.` });
      }
    }

    const pPrice = purchase_price !== undefined ? Math.max(0, Math.round(Number(purchase_price))) : existing.purchase_price;
    const sPrice = selling_price !== undefined && selling_price !== '' ? Math.max(0, Math.round(Number(selling_price))) : existing.selling_price;
    const minStock = min_stock_alert !== undefined ? Math.max(0, Math.round(Number(min_stock_alert))) : existing.min_stock_alert;

    runQuery(db, `
      UPDATE products SET
        sku = ?,
        barcode = ?,
        name = ?,
        category_id = ?,
        brand = ?,
        description = ?,
        purchase_price = ?,
        selling_price = ?,
        min_stock_alert = ?,
        unit = ?,
        location = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      (sku || existing.sku).trim().toUpperCase(),
      barcode !== undefined ? (barcode ? barcode.trim() : null) : existing.barcode,
      (name || existing.name).trim(),
      category_id !== undefined ? Number(category_id) : existing.category_id,
      (brand || existing.brand).trim(),
      description !== undefined ? (description ? description.trim() : null) : existing.description,
      pPrice,
      sPrice,
      minStock,
      unit || existing.unit,
      location !== undefined ? (location ? location.trim() : null) : existing.location,
      id
    ]);

    logAudit(req.user!.id, req.user!.full_name, 'MODIFICATION_PRODUIT', `Modification du produit ${existing.sku}`);

    const updated = queryOne(db, 'SELECT * FROM products WHERE id = ?', [id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour du produit.' });
  }
});

router.post('/products/:id/archive', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const existing = queryOne(db, 'SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }

    const newStatus = existing.is_archived === 1 ? 0 : 1;
    runQuery(db, 'UPDATE products SET is_archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);

    logAudit(
      req.user!.id,
      req.user!.full_name,
      newStatus === 1 ? 'ARCHIVAGE_PRODUIT' : 'DESARCHIVAGE_PRODUIT',
      `Produit ${existing.sku} (${existing.name}) ${newStatus === 1 ? 'archivé' : 'désarchivé'}`
    );

    res.json({
      success: true,
      is_archived: newStatus,
      message: newStatus === 1 ? 'Produit archivé avec succès.' : 'Produit restauré avec succès.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors du changement de statut du produit.' });
  }
});

// CSV Export for products
router.get('/products/export/csv', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const products = queryAll(db, `
      SELECT 
        p.id, p.sku, p.barcode, p.name, c.name as category_name, p.brand,
        p.purchase_price, p.selling_price, p.current_stock, p.min_stock_alert,
        p.unit, p.location, p.is_archived, p.created_at
      FROM products p
      JOIN categories c ON p.category_id = c.id
      ORDER BY p.sku ASC
    `);

    // Build CSV with semicolon separator and UTF-8 BOM for Microsoft Excel
    const header = ['ID', 'Référence SKU', 'Code-barres', 'Nom du produit', 'Catégorie', 'Marque', 'Prix Achat (FCFA)', 'Prix Vente (FCFA)', 'Stock Actuel', 'Seuil Min', 'Unité', 'Emplacement', 'Archivé', 'Date Création'];
    const rows = products.map(p => [
      p.id,
      `"${(p.sku || '').replace(/"/g, '""')}"`,
      `"${(p.barcode || '').replace(/"/g, '""')}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.category_name || '').replace(/"/g, '""')}"`,
      `"${(p.brand || '').replace(/"/g, '""')}"`,
      p.purchase_price,
      p.selling_price || '',
      p.current_stock,
      p.min_stock_alert,
      `"${(p.unit || '').replace(/"/g, '""')}"`,
      `"${(p.location || '').replace(/"/g, '""')}"`,
      p.is_archived ? 'OUI' : 'NON',
      p.created_at
    ]);

    const csvContent = '\uFEFF' + [header.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="SecurStock_Catalogue_Produits_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de l\'exportation CSV.' });
  }
});

// CSV Import for products
router.post('/products/import/csv', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Aucun produit valide trouvé dans le fichier importé.' });
    }

    const db = await getDb();
    const categories = queryAll(db, 'SELECT id, name, code FROM categories');
    const catMapByName = new Map<string, number>();
    for (const c of categories) {
      catMapByName.set(c.name.toLowerCase(), c.id);
      catMapByName.set(c.code.toLowerCase(), c.id);
    }
    const defaultCatId = categories[0]?.id || 1;

    let createdCount = 0;
    let updatedCount = 0;
    let errors: string[] = [];

    db.run('BEGIN TRANSACTION;');

    try {
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const sku = String(item.sku || item.reference || item.ref || '').trim().toUpperCase();
        const name = String(item.name || item.nom || '').trim();
        if (!sku || !name) {
          errors.push(`Ligne ${idx + 1}: SKU ou nom manquant.`);
          continue;
        }

        const catName = String(item.category || item.categorie || '').trim().toLowerCase();
        const catId = catMapByName.get(catName) || defaultCatId;
        const brand = String(item.brand || item.marque || 'Générique').trim();
        const purchasePrice = Math.max(0, Math.round(Number(item.purchase_price || item.prix_achat) || 0));
        const sellingPrice = item.selling_price || item.prix_vente ? Math.max(0, Math.round(Number(item.selling_price || item.prix_vente))) : null;
        const stock = Math.max(0, Math.round(Number(item.stock || item.quantite) || 0));
        const minStock = Math.max(0, Math.round(Number(item.min_stock || item.seuil) || 5));
        const unit = String(item.unit || item.unite || 'Pièce').trim();
        const location = String(item.location || item.emplacement || '').trim() || null;
        const barcode = String(item.barcode || item.code_barre || '').trim() || null;

        const existing = queryOne(db, 'SELECT id, current_stock FROM products WHERE LOWER(sku) = LOWER(?)', [sku]);
        if (existing) {
          // Update details
          db.run(`
            UPDATE products SET
              name = ?, category_id = ?, brand = ?, purchase_price = ?,
              selling_price = ?, min_stock_alert = ?, unit = ?, location = ?, barcode = COALESCE(?, barcode),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [name, catId, brand, purchasePrice, sellingPrice, minStock, unit, location, barcode, existing.id]);
          updatedCount++;
        } else {
          // Create product
          db.run(`
            INSERT INTO products (
              sku, barcode, name, category_id, brand, purchase_price,
              selling_price, current_stock, min_stock_alert, unit, location, is_archived
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
          `, [sku, barcode, name, catId, brand, purchasePrice, sellingPrice, stock, minStock, unit, location]);
          createdCount++;
        }
      }

      db.run('COMMIT;');
      saveDb();

      logAudit(req.user!.id, req.user!.full_name, 'IMPORT_CSV_PRODUITS', `Import CSV : ${createdCount} créés, ${updatedCount} mis à jour`);

      res.json({
        success: true,
        createdCount,
        updatedCount,
        errors
      });
    } catch (err: any) {
      db.run('ROLLBACK;');
      throw err;
    }
  } catch (err: any) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'importation CSV.' });
  }
});

// ==========================================
// CATEGORIES
// ==========================================
router.get('/categories', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const categories = queryAll(db, `
      SELECT 
        c.*,
        COUNT(p.id) as product_count,
        COALESCE(SUM(p.current_stock), 0) as total_stock,
        COALESCE(SUM(p.current_stock * p.purchase_price), 0) as total_valuation
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_archived = 0
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la récupération des catégories.' });
  }
});

router.post('/categories', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Nom et code de catégorie requis.' });
    }

    const db = await getDb();
    const existing = queryOne(db, 'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)', [name.trim(), code.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'Une catégorie portant ce nom ou ce code existe déjà.' });
    }

    const resQuery = runQuery(db, 'INSERT INTO categories (name, code, description) VALUES (?, ?, ?)', [
      name.trim(),
      code.trim().toUpperCase(),
      description ? description.trim() : null
    ]);

    logAudit(req.user!.id, req.user!.full_name, 'CREATION_CATEGORIE', `Création de la catégorie ${name} (${code})`);

    const created = queryOne(db, 'SELECT * FROM categories WHERE id = ?', [resQuery.lastInsertRowid]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la création de la catégorie.' });
  }
});

router.put('/categories/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;
    const db = await getDb();

    const existing = queryOne(db, 'SELECT * FROM categories WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Catégorie introuvable.' });
    }

    runQuery(db, 'UPDATE categories SET name = ?, code = ?, description = ? WHERE id = ?', [
      name ? name.trim() : existing.name,
      code ? code.trim().toUpperCase() : existing.code,
      description !== undefined ? (description ? description.trim() : null) : existing.description,
      id
    ]);

    logAudit(req.user!.id, req.user!.full_name, 'MODIFICATION_CATEGORIE', `Modification de la catégorie ${existing.name}`);

    const updated = queryOne(db, 'SELECT * FROM categories WHERE id = ?', [id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la catégorie.' });
  }
});

router.delete('/categories/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    // Check if products exist in category
    const prodCount = queryOne(db, 'SELECT COUNT(*) as count FROM products WHERE category_id = ?', [id])?.count || 0;
    if (prodCount > 0) {
      return res.status(400).json({
        error: `Impossible de supprimer cette catégorie car ${prodCount} produit(s) y sont rattachés. Réassignez les produits au préalable.`
      });
    }

    runQuery(db, 'DELETE FROM categories WHERE id = ?', [id]);
    logAudit(req.user!.id, req.user!.full_name, 'SUPPRESSION_CATEGORIE', `Suppression de la catégorie ID ${id}`);

    res.json({ success: true, message: 'Catégorie supprimée avec succès.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la suppression de la catégorie.' });
  }
});

// ==========================================
// SUPPLIERS (FOURNISSEURS)
// ==========================================
router.get('/suppliers', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const suppliers = queryAll(db, `
      SELECT 
        s.*,
        COUNT(DISTINCT m.id) as movements_count,
        COALESCE(SUM(CASE WHEN m.type = 'ENTREE' THEN m.quantity ELSE 0 END), 0) as total_items_received,
        COALESCE(SUM(CASE WHEN m.type = 'ENTREE' THEN m.quantity * COALESCE(m.unit_price, 0) ELSE 0 END), 0) as total_purchased_value
      FROM suppliers s
      LEFT JOIN stock_movements m ON s.id = m.supplier_id
      GROUP BY s.id
      ORDER BY s.name ASC
    `);
    res.json(suppliers);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la récupération des fournisseurs.' });
  }
});

router.get('/suppliers/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const supplier = queryOne(db, 'SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    if (!supplier) {
      return res.status(404).json({ error: 'Fournisseur introuvable.' });
    }

    // Receipts history
    const history = queryAll(db, `
      SELECT 
        m.*,
        p.name as product_name,
        p.sku as product_sku,
        p.unit as product_unit
      FROM stock_movements m
      JOIN products p ON m.product_id = p.id
      WHERE m.supplier_id = ?
      ORDER BY m.id DESC
      LIMIT 25
    `, [supplier.id]);

    res.json({
      ...supplier,
      history
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la récupération de la fiche fournisseur.' });
  }
});

router.post('/suppliers', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, contact_name, phone, email, address, notes } = req.body;
    if (!name || !contact_name || !phone || !address) {
      return res.status(400).json({ error: 'Nom de l\'entreprise, contact, téléphone et adresse sont obligatoires.' });
    }

    const db = await getDb();
    const existing = queryOne(db, 'SELECT id FROM suppliers WHERE LOWER(name) = LOWER(?)', [name.trim()]);
    if (existing) {
      return res.status(400).json({ error: `Un fournisseur nommé "${name}" existe déjà.` });
    }

    const result = runQuery(db, `
      INSERT INTO suppliers (name, contact_name, phone, email, address, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      name.trim(),
      contact_name.trim(),
      phone.trim(),
      email ? email.trim() : null,
      address.trim(),
      notes ? notes.trim() : null
    ]);

    logAudit(req.user!.id, req.user!.full_name, 'CREATION_FOURNISSEUR', `Création du fournisseur ${name}`);

    const created = queryOne(db, 'SELECT * FROM suppliers WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la création du fournisseur.' });
  }
});

router.put('/suppliers/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, contact_name, phone, email, address, notes } = req.body;
    const db = await getDb();

    const existing = queryOne(db, 'SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Fournisseur introuvable.' });
    }

    runQuery(db, `
      UPDATE suppliers SET
        name = ?,
        contact_name = ?,
        phone = ?,
        email = ?,
        address = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name ? name.trim() : existing.name,
      contact_name ? contact_name.trim() : existing.contact_name,
      phone ? phone.trim() : existing.phone,
      email !== undefined ? (email ? email.trim() : null) : existing.email,
      address ? address.trim() : existing.address,
      notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
      id
    ]);

    logAudit(req.user!.id, req.user!.full_name, 'MODIFICATION_FOURNISSEUR', `Mise à jour du fournisseur ${existing.name}`);

    const updated = queryOne(db, 'SELECT * FROM suppliers WHERE id = ?', [id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour du fournisseur.' });
  }
});

router.delete('/suppliers/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const hasMovements = queryOne(db, 'SELECT COUNT(*) as count FROM stock_movements WHERE supplier_id = ?', [id])?.count || 0;
    if (hasMovements > 0) {
      return res.status(400).json({
        error: `Impossible de supprimer ce fournisseur car ${hasMovements} mouvement(s) de stock y sont historiquement associés.`
      });
    }

    runQuery(db, 'DELETE FROM suppliers WHERE id = ?', [id]);
    logAudit(req.user!.id, req.user!.full_name, 'SUPPRESSION_FOURNISSEUR', `Suppression du fournisseur ID ${id}`);

    res.json({ success: true, message: 'Fournisseur supprimé avec succès.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la suppression du fournisseur.' });
  }
});

// ==========================================
// STOCK MOVEMENTS (ENTREES & SORTIES)
// ==========================================

// Helper to generate unique movement sequence number
function generateMovementNumber(db: any, type: 'ENTREE' | 'SORTIE' | 'AJUSTEMENT_INVENTAIRE') {
  const prefix = type === 'ENTREE' ? 'ENT' : type === 'SORTIE' ? 'SOR' : 'REG';
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Count movements for this month and prefix
  const count = queryOne(db, `
    SELECT COUNT(*) as count 
    FROM stock_movements 
    WHERE movement_number LIKE ?
  `, [`${prefix}-${yearMonth}-%`])?.count || 0;

  const nextSeq = String(count + 1).padStart(4, '0');
  return `${prefix}-${yearMonth}-${nextSeq}`;
}

// 1. Stock In (Entrées)
router.post('/movements/in', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      product_id,
      quantity,
      unit_price,
      supplier_id,
      document_reference,
      reason,
      comment
    } = req.body;

    if (!product_id || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ error: 'Veuillez sélectionner un produit et renseigner une quantité positive (> 0).' });
    }

    const qty = Math.round(Number(quantity));
    const db = await getDb();

    const product = queryOne(db, 'SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }
    if (product.is_archived === 1) {
      return res.status(400).json({ error: 'Impossible d\'enregistrer une entrée sur un produit archivé.' });
    }

    let supplierName: string | null = null;
    if (supplier_id) {
      const sup = queryOne(db, 'SELECT name FROM suppliers WHERE id = ?', [supplier_id]);
      supplierName = sup?.name || null;
    }

    const purchasePrice = unit_price !== undefined && unit_price !== '' ? Math.max(0, Math.round(Number(unit_price))) : product.purchase_price;

    db.run('BEGIN TRANSACTION;');

    try {
      const stockBefore = product.current_stock;
      const stockAfter = stockBefore + qty;
      const movNumber = generateMovementNumber(db, 'ENTREE');

      const movStmt = db.prepare(`
        INSERT INTO stock_movements (
          movement_number, product_id, type, quantity, stock_before,
          stock_after, unit_price, reason, document_reference, partner_name,
          supplier_id, user_id, user_name, comment
        ) VALUES (?, ?, 'ENTREE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      movStmt.run([
        movNumber,
        product.id,
        qty,
        stockBefore,
        stockAfter,
        purchasePrice,
        reason || 'Réception fournisseur',
        document_reference ? document_reference.trim() : null,
        supplierName,
        supplier_id ? Number(supplier_id) : null,
        req.user!.id,
        req.user!.full_name,
        comment ? comment.trim() : null
      ]);
      movStmt.free();

      // Update product current stock (and update purchase price if specified)
      db.run(`
        UPDATE products 
        SET current_stock = ?,
            purchase_price = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [stockAfter, purchasePrice, product.id]);

      db.run('COMMIT;');
      saveDb();

      logAudit(
        req.user!.id,
        req.user!.full_name,
        'ENTREE_STOCK',
        `Entrée de ${qty} ${product.unit}(s) pour ${product.name} (${product.sku}). Nouveau stock : ${stockAfter}. N° ${movNumber}`
      );

      const createdMovement = queryOne(db, `
        SELECT m.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit
        FROM stock_movements m
        JOIN products p ON m.product_id = p.id
        WHERE m.movement_number = ?
      `, [movNumber]);

      res.status(201).json({
        success: true,
        movement: createdMovement,
        new_stock: stockAfter
      });
    } catch (err: any) {
      db.run('ROLLBACK;');
      throw err;
    }
  } catch (err: any) {
    console.error('Stock in error:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de l\'enregistrement de l\'entrée de stock.' });
  }
});

// 2. Stock Out (Sorties)
router.post('/movements/out', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      product_id,
      quantity,
      reason,
      recipient_name,
      document_reference,
      comment
    } = req.body;

    if (!product_id || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ error: 'Produit et quantité positive (> 0) obligatoires.' });
    }

    const qty = Math.round(Number(quantity));
    const db = await getDb();

    const product = queryOne(db, 'SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }
    if (product.is_archived === 1) {
      return res.status(400).json({ error: 'Impossible de sortir du stock pour un produit archivé.' });
    }

    // CRITICAL SECURITY RULE: Out quantity cannot exceed current available stock!
    if (qty > product.current_stock) {
      return res.status(400).json({
        error: `Opération impossible : quantité demandée (${qty} ${product.unit}) supérieure au stock disponible (${product.current_stock} ${product.unit}).`
      });
    }

    db.run('BEGIN TRANSACTION;');

    try {
      const stockBefore = product.current_stock;
      const stockAfter = stockBefore - qty;
      const movNumber = generateMovementNumber(db, 'SORTIE');

      const movStmt = db.prepare(`
        INSERT INTO stock_movements (
          movement_number, product_id, type, quantity, stock_before,
          stock_after, unit_price, reason, document_reference, partner_name,
          user_id, user_name, comment
        ) VALUES (?, ?, 'SORTIE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      movStmt.run([
        movNumber,
        product.id,
        qty,
        stockBefore,
        stockAfter,
        product.purchase_price,
        reason || 'Vente',
        document_reference ? document_reference.trim() : null,
        recipient_name ? recipient_name.trim() : null,
        req.user!.id,
        req.user!.full_name,
        comment ? comment.trim() : null
      ]);
      movStmt.free();

      // Update product current stock atomically
      db.run(`
        UPDATE products 
        SET current_stock = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [stockAfter, product.id]);

      db.run('COMMIT;');
      saveDb();

      logAudit(
        req.user!.id,
        req.user!.full_name,
        'SORTIE_STOCK',
        `Sortie de ${qty} ${product.unit}(s) pour ${product.name} (${product.sku}). Motif : ${reason}. Nouveau stock : ${stockAfter}. N° ${movNumber}`
      );

      const createdMovement = queryOne(db, `
        SELECT m.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit
        FROM stock_movements m
        JOIN products p ON m.product_id = p.id
        WHERE m.movement_number = ?
      `, [movNumber]);

      res.status(201).json({
        success: true,
        movement: createdMovement,
        new_stock: stockAfter
      });
    } catch (err: any) {
      db.run('ROLLBACK;');
      throw err;
    }
  } catch (err: any) {
    console.error('Stock out error:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de l\'enregistrement de la sortie de stock.' });
  }
});

// List all movements with filters
router.get('/movements', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const { type, product_id, category_id, start_date, end_date, search, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT 
        m.*,
        p.name as product_name,
        p.sku as product_sku,
        p.unit as product_unit,
        c.name as category_name
      FROM stock_movements m
      JOIN products p ON m.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (type) {
      sql += ' AND m.type = ?';
      params.push(type);
    }
    if (product_id) {
      sql += ' AND m.product_id = ?';
      params.push(Number(product_id));
    }
    if (category_id) {
      sql += ' AND p.category_id = ?';
      params.push(Number(category_id));
    }
    if (start_date) {
      sql += ' AND date(m.created_at) >= date(?)';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND date(m.created_at) <= date(?)';
      params.push(end_date);
    }
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = `%${search.trim().toLowerCase()}%`;
      sql += ' AND (LOWER(m.movement_number) LIKE ? OR LOWER(p.name) LIKE ? OR LOWER(p.sku) LIKE ? OR LOWER(COALESCE(m.partner_name, "")) LIKE ? OR LOWER(COALESCE(m.document_reference, "")) LIKE ?)';
      params.push(q, q, q, q, q);
    }

    sql += ' ORDER BY m.id DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const movements = queryAll(db, sql, params);

    // Total count for pagination
    const totalCount = queryOne(db, 'SELECT COUNT(*) as count FROM stock_movements')?.count || 0;

    res.json({
      movements,
      totalCount
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la récupération des mouvements.' });
  }
});

// CSV Export for movements
router.get('/movements/export/csv', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const movements = queryAll(db, `
      SELECT 
        m.created_at,
        m.movement_number,
        p.sku as product_sku,
        p.name as product_name,
        c.name as category_name,
        m.type,
        m.quantity,
        m.stock_before,
        m.stock_after,
        m.unit_price,
        m.reason,
        m.document_reference,
        m.partner_name,
        m.user_name,
        m.comment
      FROM stock_movements m
      JOIN products p ON m.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      ORDER BY m.id DESC
    `);

    const header = [
      'Date et Heure',
      'N° Mouvement',
      'Référence SKU',
      'Produit',
      'Catégorie',
      'Type',
      'Quantité',
      'Stock Avant',
      'Stock Après',
      'Prix Unitaire (FCFA)',
      'Motif',
      'Réf. Document',
      'Tiers (Fournisseur/Client)',
      'Utilisateur Responsable',
      'Commentaire'
    ];

    const rows = movements.map(m => [
      m.created_at,
      m.movement_number,
      `"${(m.product_sku || '').replace(/"/g, '""')}"`,
      `"${(m.product_name || '').replace(/"/g, '""')}"`,
      `"${(m.category_name || '').replace(/"/g, '""')}"`,
      m.type,
      m.type === 'SORTIE' ? -m.quantity : m.quantity,
      m.stock_before,
      m.stock_after,
      m.unit_price || '',
      `"${(m.reason || '').replace(/"/g, '""')}"`,
      `"${(m.document_reference || '').replace(/"/g, '""')}"`,
      `"${(m.partner_name || '').replace(/"/g, '""')}"`,
      `"${(m.user_name || '').replace(/"/g, '""')}"`,
      `"${(m.comment || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [header.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="SecurStock_Historique_Mouvements_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de l\'exportation CSV des mouvements.' });
  }
});

// ==========================================
// PHYSICAL INVENTORY (INVENTAIRE PHYSIQUE)
// ==========================================
router.get('/inventory/active', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    
    // Check if there is an in-progress inventory session
    let session = queryOne(db, 'SELECT * FROM inventory_sessions WHERE status = "EN_COURS" ORDER BY id DESC LIMIT 1');
    
    // Also fetch all active products for the inventory worksheet
    const products = queryAll(db, `
      SELECT 
        p.id, p.sku, p.name, p.brand, p.current_stock as theoretical_stock,
        p.min_stock_alert, p.unit, p.location, p.purchase_price,
        c.name as category_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_archived = 0
      ORDER BY c.name ASC, p.name ASC
    `);

    let items: any[] = [];
    if (session) {
      items = queryAll(db, `
        SELECT i.*, p.sku, p.name, p.unit, p.location, c.name as category_name
        FROM inventory_items i
        JOIN products p ON i.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        WHERE i.session_id = ?
      `, [session.id]);
    }

    res.json({
      activeSession: session,
      items,
      catalogProducts: products
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors du chargement de l\'inventaire.' });
  }
});

// Start a new inventory session
router.post('/inventory/start', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { notes } = req.body;
    const db = await getDb();

    // Check existing
    const existing = queryOne(db, 'SELECT id, session_number FROM inventory_sessions WHERE status = "EN_COURS"');
    if (existing) {
      return res.status(400).json({
        error: `Une session d'inventaire (${existing.session_number}) est déjà en cours. Veuillez la valider ou l'annuler avant d'en ouvrir une nouvelle.`
      });
    }

    const sessionNum = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
    
    db.run('BEGIN TRANSACTION;');

    try {
      db.run(`
        INSERT INTO inventory_sessions (session_number, status, notes, user_id, user_name)
        VALUES (?, 'EN_COURS', ?, ?, ?)
      `, [sessionNum, notes ? notes.trim() : 'Inventaire physique périodique', req.user!.id, req.user!.full_name]);

      const sessionId = db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0] as number;

      // Populate snapshot of active products
      const products = queryAll(db, 'SELECT id, current_stock, purchase_price FROM products WHERE is_archived = 0');
      const itemStmt = db.prepare(`
        INSERT INTO inventory_items (session_id, product_id, theoretical_stock, counted_stock, discrepancy, unit_price)
        VALUES (?, ?, ?, ?, 0, ?)
      `);

      for (const p of products) {
        itemStmt.run([sessionId, p.id, p.current_stock, p.current_stock, p.purchase_price]);
      }
      itemStmt.free();

      db.run('UPDATE inventory_sessions SET total_items = ? WHERE id = ?', [products.length, sessionId]);

      db.run('COMMIT;');
      saveDb();

      logAudit(req.user!.id, req.user!.full_name, 'OUVERTURE_INVENTAIRE', `Ouverture de la session d'inventaire ${sessionNum} (${products.length} articles)`);

      const session = queryOne(db, 'SELECT * FROM inventory_sessions WHERE id = ?', [sessionId]);
      res.status(201).json({ success: true, session });
    } catch (err: any) {
      db.run('ROLLBACK;');
      throw err;
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de l\'ouverture de la session d\'inventaire.' });
  }
});

// Update counted quantities during inventory
router.post('/inventory/save-counts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { session_id, counts } = req.body; // counts: { [product_id: number]: number }
    if (!session_id || !counts) {
      return res.status(400).json({ error: 'Données d\'inventaire incomplètes.' });
    }

    const db = await getDb();
    const session = queryOne(db, 'SELECT * FROM inventory_sessions WHERE id = ? AND status = "EN_COURS"', [session_id]);
    if (!session) {
      return res.status(404).json({ error: 'Session d\'inventaire introuvable ou déjà clôturée.' });
    }

    db.run('BEGIN TRANSACTION;');

    try {
      const updateStmt = db.prepare(`
        UPDATE inventory_items
        SET counted_stock = ?,
            discrepancy = ? - theoretical_stock
        WHERE session_id = ? AND product_id = ?
      `);

      let discrepancyCount = 0;
      for (const [productId, countedVal] of Object.entries(counts)) {
        const counted = Math.max(0, Math.round(Number(countedVal)));
        const item = queryOne(db, 'SELECT theoretical_stock FROM inventory_items WHERE session_id = ? AND product_id = ?', [session_id, productId]);
        if (item) {
          const diff = counted - item.theoretical_stock;
          if (diff !== 0) discrepancyCount++;
          updateStmt.run([counted, counted, session_id, Number(productId)]);
        }
      }
      updateStmt.free();

      db.run('UPDATE inventory_sessions SET total_discrepancies = ? WHERE id = ?', [discrepancyCount, session_id]);

      db.run('COMMIT;');
      saveDb();

      res.json({ success: true, message: 'Comptages enregistrés temporairement.' });
    } catch (err: any) {
      db.run('ROLLBACK;');
      throw err;
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement des comptages.' });
  }
});

// Validate and adjust stock permanently
router.post('/inventory/validate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { session_id, notes } = req.body;
    const db = await getDb();

    const session = queryOne(db, 'SELECT * FROM inventory_sessions WHERE id = ? AND status = "EN_COURS"', [session_id]);
    if (!session) {
      return res.status(404).json({ error: 'Session d\'inventaire introuvable ou déjà clôturée.' });
    }

    // Get all items in session
    const items = queryAll(db, `
      SELECT i.*, p.sku, p.name, p.current_stock as actual_live_stock
      FROM inventory_items i
      JOIN products p ON i.product_id = p.id
      WHERE i.session_id = ?
    `, [session_id]);

    db.run('BEGIN TRANSACTION;');

    try {
      let adjustedCount = 0;

      for (const item of items) {
        const diff = item.counted_stock - item.theoretical_stock;
        if (diff !== 0) {
          adjustedCount++;
          const regNumber = generateMovementNumber(db, 'AJUSTEMENT_INVENTAIRE');

          // Record adjustment movement for transparency & traceability
          const movStmt = db.prepare(`
            INSERT INTO stock_movements (
              movement_number, product_id, type, quantity, stock_before,
              stock_after, unit_price, reason, document_reference, user_id, user_name, comment
            ) VALUES (?, ?, 'AJUSTEMENT_INVENTAIRE', ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const reasonText = diff > 0 
            ? `Régularisation inventaire : Surplus constaté (+${diff})`
            : `Régularisation inventaire : Manquant constaté (${diff})`;

          movStmt.run([
            regNumber,
            item.product_id,
            Math.abs(diff),
            item.theoretical_stock,
            item.counted_stock,
            item.unit_price,
            reasonText,
            session.session_number,
            req.user!.id,
            req.user!.full_name,
            `Inventaire physique validé le ${new Date().toLocaleDateString('fr-FR')}`
          ]);
          movStmt.free();

          // Update product live stock
          db.run(`
            UPDATE products 
            SET current_stock = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [item.counted_stock, item.product_id]);

          // Mark item as adjusted
          db.run('UPDATE inventory_items SET adjusted = 1 WHERE id = ?', [item.id]);
        }
      }

      // Finalize session
      db.run(`
        UPDATE inventory_sessions 
        SET status = 'VALIDE',
            total_discrepancies = ?,
            notes = COALESCE(?, notes),
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [adjustedCount, notes ? notes.trim() : null, session_id]);

      db.run('COMMIT;');
      saveDb();

      logAudit(
        req.user!.id,
        req.user!.full_name,
        'VALIDATION_INVENTAIRE',
        `Validation de l'inventaire ${session.session_number} : ${adjustedCount} écart(s) régularisé(s)`
      );

      res.json({
        success: true,
        message: `Inventaire clôturé avec succès. ${adjustedCount} produit(s) ont fait l'objet d'un mouvement de régularisation automatique.`,
        adjustedCount
      });
    } catch (err: any) {
      db.run('ROLLBACK;');
      throw err;
    }
  } catch (err: any) {
    console.error('Inventory validation error:', err);
    res.status(500).json({ error: 'Erreur lors de la validation de l\'inventaire.' });
  }
});

// Cancel active inventory session
router.post('/inventory/cancel', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { session_id } = req.body;
    const db = await getDb();

    const session = queryOne(db, 'SELECT * FROM inventory_sessions WHERE id = ? AND status = "EN_COURS"', [session_id]);
    if (!session) {
      return res.status(404).json({ error: 'Session introuvable.' });
    }

    runQuery(db, 'UPDATE inventory_sessions SET status = "ANNULE", completed_at = CURRENT_TIMESTAMP WHERE id = ?', [session_id]);
    logAudit(req.user!.id, req.user!.full_name, 'ANNULATION_INVENTAIRE', `Annulation de la session d'inventaire ${session.session_number}`);

    res.json({ success: true, message: 'Session d\'inventaire annulée sans modification de stock.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de l\'annulation de l\'inventaire.' });
  }
});

// Past inventory sessions history
router.get('/inventory/history', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const sessions = queryAll(db, `
      SELECT 
        s.*,
        COUNT(i.id) as counted_items_count
      FROM inventory_sessions s
      LEFT JOIN inventory_items i ON s.id = i.session_id
      GROUP BY s.id
      ORDER BY s.id DESC
    `);
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors du chargement de l\'historique des inventaires.' });
  }
});

// ==========================================
// REPORTS & ANALYTICS
// ==========================================
router.get('/reports/valuation', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();

    // Valuation summary by category
    const byCategory = queryAll(db, `
      SELECT 
        c.id,
        c.name as category_name,
        COUNT(p.id) as product_count,
        COALESCE(SUM(p.current_stock), 0) as total_units,
        COALESCE(SUM(p.current_stock * p.purchase_price), 0) as total_cost_value,
        COALESCE(SUM(p.current_stock * COALESCE(p.selling_price, p.purchase_price)), 0) as total_retail_value
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_archived = 0
      GROUP BY c.id
      ORDER BY total_cost_value DESC
    `);

    // Top 10 highest valued stock items
    const topValuedProducts = queryAll(db, `
      SELECT 
        p.id, p.sku, p.name, p.brand, p.current_stock, p.unit, p.purchase_price,
        (p.current_stock * p.purchase_price) as stock_value,
        c.name as category_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_archived = 0 AND p.current_stock > 0
      ORDER BY stock_value DESC
      LIMIT 10
    `);

    // Global totals
    const globalTotal = queryOne(db, `
      SELECT 
        COUNT(id) as total_products,
        COALESCE(SUM(current_stock), 0) as total_quantity,
        COALESCE(SUM(current_stock * purchase_price), 0) as total_valuation
      FROM products
      WHERE is_archived = 0
    `);

    res.json({
      byCategory,
      topValuedProducts,
      globalTotal
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors du calcul de la valorisation de stock.' });
  }
});

// Periodic movements report (monthly/weekly breakdown)
router.get('/reports/movements-period', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const { months = 6 } = req.query;

    const monthlyBreakdown = queryAll(db, `
      SELECT 
        strftime('%Y-%m', created_at) as month,
        SUM(CASE WHEN type = 'ENTREE' THEN quantity ELSE 0 END) as total_entries_qty,
        SUM(CASE WHEN type = 'SORTIE' THEN quantity ELSE 0 END) as total_exits_qty,
        SUM(CASE WHEN type = 'AJUSTEMENT_INVENTAIRE' THEN quantity ELSE 0 END) as total_adjustments_qty,
        SUM(CASE WHEN type = 'ENTREE' THEN quantity * COALESCE(unit_price, 0) ELSE 0 END) as entries_financial_value
      FROM stock_movements
      WHERE created_at >= date('now', '-' || ? || ' months')
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month ASC
    `, [Number(months)]);

    res.json(monthlyBreakdown);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors du rapport périodique.' });
  }
});

// ==========================================
// USER MANAGEMENT & AUDIT LOGS (ADMIN ONLY)
// ==========================================
router.get('/users', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const users = queryAll(db, 'SELECT id, email, full_name, role, phone, created_at, updated_at FROM users ORDER BY id ASC');
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
  }
});

router.post('/users', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, full_name, role, phone } = req.body;
    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Email, mot de passe, nom complet et rôle sont obligatoires.' });
    }
    if (!['admin', 'magasinier'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide (admin ou magasinier uniquement).' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit comporter au moins 6 caractères.' });
    }

    const db = await getDb();
    const existing = queryOne(db, 'SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'Un utilisateur avec cette adresse e-mail existe déjà.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = runQuery(db, `
      INSERT INTO users (email, password_hash, full_name, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `, [email.trim().toLowerCase(), passwordHash, full_name.trim(), role, phone ? phone.trim() : null]);

    logAudit(req.user!.id, req.user!.full_name, 'CREATION_UTILISATEUR', `Création du compte utilisateur ${email} (rôle: ${role})`);

    const created = queryOne(db, 'SELECT id, email, full_name, role, phone, created_at FROM users WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur.' });
  }
});

router.put('/users/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { email, full_name, role, phone, password } = req.body;
    const db = await getDb();

    const existing = queryOne(db, 'SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    let passwordHash = existing.password_hash;
    if (password && password.trim().length >= 6) {
      passwordHash = bcrypt.hashSync(password.trim(), 10);
    }

    runQuery(db, `
      UPDATE users SET
        email = ?,
        password_hash = ?,
        full_name = ?,
        role = ?,
        phone = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      email ? email.trim().toLowerCase() : existing.email,
      passwordHash,
      full_name ? full_name.trim() : existing.full_name,
      role ? role : existing.role,
      phone !== undefined ? (phone ? phone.trim() : null) : existing.phone,
      id
    ]);

    logAudit(req.user!.id, req.user!.full_name, 'MODIFICATION_UTILISATEUR', `Mise à jour du compte utilisateur ID ${id}`);

    const updated = queryOne(db, 'SELECT id, email, full_name, role, phone, updated_at FROM users WHERE id = ?', [id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la modification de l\'utilisateur.' });
  }
});

router.delete('/users/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (Number(id) === req.user!.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte administrateur.' });
    }

    const db = await getDb();
    runQuery(db, 'DELETE FROM users WHERE id = ?', [id]);
    logAudit(req.user!.id, req.user!.full_name, 'SUPPRESSION_UTILISATEUR', `Suppression du compte utilisateur ID ${id}`);

    res.json({ success: true, message: 'Utilisateur supprimé avec succès.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'utilisateur.' });
  }
});

router.get('/audit-logs', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const logs = queryAll(db, 'SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100');
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la récupération des journaux d\'audit.' });
  }
});

// Backup / Export of whole database
router.get('/backup/export', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const backup = {
      version: '1.0',
      export_date: new Date().toISOString(),
      store_currency: 'FCFA',
      tables: {
        categories: queryAll(db, 'SELECT * FROM categories'),
        suppliers: queryAll(db, 'SELECT * FROM suppliers'),
        products: queryAll(db, 'SELECT * FROM products'),
        stock_movements: queryAll(db, 'SELECT * FROM stock_movements'),
        inventory_sessions: queryAll(db, 'SELECT * FROM inventory_sessions'),
        inventory_items: queryAll(db, 'SELECT * FROM inventory_items'),
        users: queryAll(db, 'SELECT id, email, full_name, role, phone, created_at FROM users')
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="SecurStock_Sauvegarde_${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(backup);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la création de la sauvegarde.' });
  }
});

export default router;
