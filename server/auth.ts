import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb, queryOne } from './db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'securstock_jwt_secret_key_super_secure_2026';

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'magasinier';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Session non authentifiée. Veuillez vous connecter.' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    const db = await getDb();
    const user = queryOne<AuthUser>(db, 'SELECT id, email, full_name, role FROM users WHERE id = ?', [decoded.id]);
    
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable ou compte révoqué.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Jeton de session invalide ou expiré.' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès interdit. Cette action nécessite les privilèges Administrateur.' });
  }
  next();
}
