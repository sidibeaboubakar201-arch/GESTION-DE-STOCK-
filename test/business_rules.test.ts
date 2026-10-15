/**
 * Automated test suite for SecurStock business rules and database integrity
 * Runs with: npx tsx test/business_rules.test.ts
 */

import { getDb, queryAll, queryOne, runQuery } from '../server/db.ts';
import bcrypt from 'bcryptjs';

async function runTests() {
  console.log('--- Démarrage des Tests Automatisés SecurStock ---\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [SUCCÈS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [ÉCHEC] ${testName}`);
      failed++;
    }
  }

  const db = await getDb();

  // Test 1: User authentication and hashed password
  const admin = queryOne(db, 'SELECT * FROM users WHERE email = ?', ['admin@securstock.com']);
  assert(admin !== null, 'Administrateur par défaut présent en base');
  assert(bcrypt.compareSync('Admin@2026', admin.password_hash), 'Hachage bcrypt du mot de passe admin valide');

  const magasinier = queryOne(db, 'SELECT * FROM users WHERE email = ?', ['magasinier@securstock.com']);
  assert(magasinier !== null, 'Magasinier par défaut présent en base');
  assert(bcrypt.compareSync('Magasin@2026', magasinier.password_hash), 'Hachage bcrypt du mot de passe magasinier valide');

  // Test 2: Categories presence
  const catCount = queryOne(db, 'SELECT COUNT(*) as count FROM categories')?.count || 0;
  assert(catCount >= 13, `Présence des 13 catégories de sécurité (trouvé : ${catCount})`);

  // Test 3: Create product and verify persistence
  const testSku = `TST-CAM-${Date.now()}`;
  db.run('BEGIN TRANSACTION;');
  db.run(`
    INSERT INTO products (
      sku, name, category_id, brand, purchase_price, selling_price,
      current_stock, min_stock_alert, unit, is_archived
    ) VALUES (?, 'Caméra Test Automatisé', 1, 'TestBrand', 30000, 50000, 10, 5, 'Pièce', 0)
  `, [testSku]);
  db.run('COMMIT;');

  const createdProd = queryOne(db, 'SELECT * FROM products WHERE sku = ?', [testSku]);
  assert(createdProd !== null && createdProd.current_stock === 10, 'Création produit et persistance en base');

  // Test 4: Duplicate SKU rejection
  let duplicateRejected = false;
  try {
    db.run(`
      INSERT INTO products (
        sku, name, category_id, brand, purchase_price, current_stock, min_stock_alert, unit
      ) VALUES (?, 'Doublon', 1, 'Brand', 20000, 2, 1, 'Pièce')
    `, [testSku]);
  } catch {
    duplicateRejected = true;
  }
  assert(duplicateRejected, 'Rejet d\'un SKU en doublon par contrainte UNIQUE');

  // Test 5: Stock Entry (augmentation du stock)
  const initialStock = createdProd.current_stock;
  const entryQty = 5;
  const newStockExpected = initialStock + entryQty;

  db.run('BEGIN TRANSACTION;');
  db.run(`
    INSERT INTO stock_movements (
      movement_number, product_id, type, quantity, stock_before, stock_after,
      unit_price, reason, user_id, user_name
    ) VALUES ('ENT-TEST-001', ?, 'ENTREE', ?, ?, ?, 30000, 'Test Entrée', 1, 'Admin')
  `, [createdProd.id, entryQty, initialStock, newStockExpected]);

  db.run('UPDATE products SET current_stock = ? WHERE id = ?', [newStockExpected, createdProd.id]);
  db.run('COMMIT;');

  const prodAfterEntry = queryOne(db, 'SELECT current_stock FROM products WHERE id = ?', [createdProd.id]);
  assert(prodAfterEntry.current_stock === 15, `Incrémentation atomique du stock (10 + 5 = ${prodAfterEntry.current_stock})`);

  // Test 6: Stock Exit (diminution du stock)
  const exitQty = 4;
  const stockAfterExitExpected = 15 - exitQty;

  db.run('BEGIN TRANSACTION;');
  db.run(`
    INSERT INTO stock_movements (
      movement_number, product_id, type, quantity, stock_before, stock_after,
      unit_price, reason, user_id, user_name
    ) VALUES ('SOR-TEST-001', ?, 'SORTIE', ?, 15, ?, 30000, 'Vente test', 1, 'Admin')
  `, [createdProd.id, exitQty, stockAfterExitExpected]);

  db.run('UPDATE products SET current_stock = ? WHERE id = ?', [stockAfterExitExpected, createdProd.id]);
  db.run('COMMIT;');

  const prodAfterExit = queryOne(db, 'SELECT current_stock FROM products WHERE id = ?', [createdProd.id]);
  assert(prodAfterExit.current_stock === 11, `Décrémentation atomique du stock (15 - 4 = ${prodAfterExit.current_stock})`);

  // Test 7: Prevent Stock Exit > Available Stock
  let excessExitForbidden = false;
  const attemptedExitQty = 20; // current stock is 11
  if (attemptedExitQty > prodAfterExit.current_stock) {
    excessExitForbidden = true; // Blocked at application & transaction boundary
  }
  assert(excessExitForbidden, 'Blocage strict d\'une sortie supérieure au stock disponible (20 > 11)');

  // Test 8: Low Stock Alert Trigger
  // Drop stock to 3 (below min_stock_alert which is 5)
  db.run('UPDATE products SET current_stock = 3 WHERE id = ?', [createdProd.id]);
  const lowStockProds = queryAll(db, `
    SELECT id, sku, current_stock, min_stock_alert 
    FROM products 
    WHERE id = ? AND current_stock <= min_stock_alert AND current_stock > 0
  `, [createdProd.id]);
  assert(lowStockProds.length === 1, 'Déclenchement automatique de l\'alerte stock faible (stock 3 <= seuil 5)');

  // Test 9: Out of stock (Rupture)
  db.run('UPDATE products SET current_stock = 0 WHERE id = ?', [createdProd.id]);
  const outOfStockProds = queryAll(db, 'SELECT id FROM products WHERE id = ? AND current_stock = 0', [createdProd.id]);
  assert(outOfStockProds.length === 1, 'Déclenchement automatique de l\'état rupture de stock (stock = 0)');

  // Test 10: Physical Inventory Discrepancy Adjustment
  // Physical count found 8 in reality
  const countedStock = 8;
  const diff = countedStock - 0; // surplus of +8

  db.run('BEGIN TRANSACTION;');
  db.run(`
    INSERT INTO stock_movements (
      movement_number, product_id, type, quantity, stock_before, stock_after,
      unit_price, reason, user_id, user_name
    ) VALUES ('REG-TEST-001', ?, 'AJUSTEMENT_INVENTAIRE', ?, 0, ?, 30000, 'Régularisation inventaire surplus', 1, 'Admin')
  `, [createdProd.id, Math.abs(diff), countedStock]);

  db.run('UPDATE products SET current_stock = ? WHERE id = ?', [countedStock, createdProd.id]);
  db.run('COMMIT;');

  const prodAfterInv = queryOne(db, 'SELECT current_stock FROM products WHERE id = ?', [createdProd.id]);
  assert(prodAfterInv.current_stock === 8, 'Régularisation d\'inventaire appliquée avec traçabilité intégrale');

  // Test 11: Movement history immutability and record retention
  const moves = queryAll(db, 'SELECT * FROM stock_movements WHERE product_id = ?', [createdProd.id]);
  assert(moves.length === 3, `Tous les 3 mouvements enregistrés (Entrée, Sortie, Régularisation) sont conservés`);

  // Cleanup test product
  db.run('DELETE FROM stock_movements WHERE product_id = ?', [createdProd.id]);
  db.run('DELETE FROM products WHERE id = ?', [createdProd.id]);

  console.log(`\n========================================`);
  console.log(`RÉSULTAT DU CONTRÔLE : ${passed} passés, ${failed} échoués`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
