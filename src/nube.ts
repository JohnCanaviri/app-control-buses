// Conexión con Supabase (la base de datos en internet).
// La clave «publishable» está hecha para ir dentro de la app: los datos los protege la seguridad
// por filas de supabase/02_aprobaciones.sql en adelante: solo las cuentas que el administrador aprobó
// ven los datos (todas los mismos), y solo el administrador puede borrar.
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://tofegvvjhqvagzgnfyyy.supabase.co';
export const SUPABASE_CLAVE = 'sb_publishable_drUr2BHP8x2koxWYWdaZDA_L_A7aNVo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_CLAVE, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
