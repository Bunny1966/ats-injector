import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

import { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

// Initialize global Supabase client (for auth verification only)
export const supabase = createClient(supabaseUrl, supabaseKey);

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
      };
      supabase: SupabaseClient<any, "public", any>;
    }
  }
}

/**
 * Middleware to verify Supabase JWT token
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn('Auth error', { error: error?.message });
      res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
      return;
    }

    // Create an authenticated client for this specific request
    const authSupabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Attach user and authenticated client to request
    req.user = {
      id: user.id,
      email: user.email,
    };
    req.supabase = authSupabase;

    next();
  } catch (error) {
    logger.error('Auth middleware error', { error });
    res.status(500).json({ success: false, error: 'Internal server error during authentication' });
  }
};
